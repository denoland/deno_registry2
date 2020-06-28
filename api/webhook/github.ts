// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import {
  walk,
  join,
  prettyBytes,
  APIGatewayProxyEvent,
  Context,
  APIGatewayProxyResult,
} from "../../deps.ts";
import { respondJSON } from "../../utils/http.ts";
import { clone } from "../../utils/git.ts";
import {
  getEntry,
  saveEntry,
} from "../../utils/database.ts";
import {
  uploadMeta,
  uploadVersionMeta,
  uploadVersionRaw,
  getMeta,
} from "../../utils/storage.ts";
import { WebhookPayloadCreate } from "../../utils/webhooks.d.ts";

const MAX_FILE_SIZE = 100_000;
const VALID_NAME = /[A-Za-z0-9_]{1,40}/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  // TOOD: Check that request is actually coming from the Cloudflare Worker.

  const moduleName = event.pathParameters?.name;
  if (!moduleName || !VALID_NAME.test(moduleName)) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "module name is not valid",
      }),
    });
  }

  const headers = new Headers(event.headers);

  // Check that event is a GitHub `create` event.
  console.log(headers);
  const ghEvent = headers.get("x-github-event");
  if (ghEvent !== "create") {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        info: "not a create event",
      }),
    });
  }

  // Get ref, ref type, and repository from event
  if (!(headers.get("content-type") ?? "").startsWith("application/json")) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "content-type is not json",
      }),
    });
  }
  if (!event.body) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "no body provided",
      }),
    });
  }
  const webhook = JSON.parse(event.body) as WebhookPayloadCreate;
  const { ref } = webhook;
  const repository = webhook.repository.full_name;
  if (webhook.ref_type !== "tag") {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        info: "created ref is not tag",
      }),
    });
  }

  const entry = await getEntry(moduleName);
  if (entry) {
    // check that entry matches repo
    if (entry.type !== "github" || entry.repository !== repository) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "module name is registered to a different repository",
        }),
      });
    }
  } else {
    // register module to repo
    await saveEntry({
      name: moduleName,
      type: "github",
      repository,
    });
  }

  // TODO: check that ref doesn't already exist

  // Clone the repository from GitHub
  const cloneURL = `https://github.com/${repository}`;
  const path = await clone(cloneURL, ref);

  // Upload files to S3
  const skippedFiles: string[] = [];
  const pendingUploads: Promise<void>[] = [];
  const directory: DirectoryListingFile[] = [];
  let totalBytes = 0;
  for await (
    const entry of walk(path, { includeFiles: true, includeDirs: true })
  ) {
    if (entry.path.startsWith(join(path, ".git"))) continue;
    const filename = entry.path.substring(path.length);
    if (entry.isFile) {
      pendingUploads.push(
        Deno.open(entry.path).then(async (file) => {
          try {
            const body = await Deno.readAll(file);
            if (body.length > MAX_FILE_SIZE) {
              skippedFiles.push(filename);
              return;
            }
            directory.push(
              { path: filename, size: body.length, type: "file" },
            );
            const { etag } = await uploadVersionRaw(
              moduleName,
              ref,
              filename,
              body,
            );
            totalBytes += body.length;
          } catch (err) {
            console.log("err", err);
          } finally {
            file.close();
          }
        }),
      );
    } else {
      directory.push(
        { path: filename, size: undefined, type: "dir" },
      );
    }
  }

  // Upload meta information to S3
  const meta = {
    type: "github",
    repository,
    description: webhook.repository.description,
    star_count: webhook.repository.stargazers_count,
  };
  pendingUploads.push(
    uploadMeta(
      moduleName,
      "meta.json",
      encoder.encode(JSON.stringify(meta)),
    ).then(() => {}),
  );

  // Upload latest version to S3
  pendingUploads.push(
    getMeta(moduleName, "versions.json").then(
      async (body) => {
        const versions = body
          ? JSON.parse(decoder.decode(body))
          : { versions: [] };
        await uploadMeta(
          moduleName,
          "versions.json",
          encoder.encode(
            JSON.stringify(
              { latest: ref, versions: [ref, ...versions.versions] },
            ),
          ),
        );
      },
    ),
  );

  // Wait for all uploads to S3 to complete
  await Promise.all(pendingUploads);

  // Calculate directory sizes
  // TODO: make more efficient
  for (const entry of directory) {
    if (entry.type === "dir") {
      entry.size = 0;
      for (
        const f of directory.filter((f) =>
          f.type === "file" && f.path.startsWith(entry.path)
        )
      ) {
        entry.size += f.size ?? 0;
      }
    }
  }

  // Upload directory listing to S3
  await uploadVersionMeta(
    moduleName,
    ref,
    "directory_listing.json",
    encoder.encode(JSON.stringify(directory)),
  );

  console.log(
    moduleName,
    ref,
    "total bytes uploaded",
    prettyBytes(totalBytes),
  );
  console.log(moduleName, ref, "skipped due to size", skippedFiles);

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        module: moduleName,
        version: ref,
        repository: repository,
        total_bytes_uploaded: totalBytes,
        skipped_due_to_size: skippedFiles,
      },
    }),
  });
}
