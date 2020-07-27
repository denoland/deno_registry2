// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/** 
 * This function is responsible for downloading a modules' source code
 * from an origin repository like GitHub and uploading it to S3. This is
 * triggered by an event in the AWS SQS build queue. It contains the ID
 * of the build, which is stored in MongoDB. The build stored in MongoDB
 * contain all relevant information that is required to upload the module:
 * the module name, GitHub repository, version, subdirectory ect.
 */

import { join, walk, SQSEvent, Context } from "../../deps.ts";
import { Build, Database } from "../../utils/database.ts";
import { clone } from "../../utils/git.ts";
import {
  uploadVersionMeta,
  uploadVersionRaw,
  uploadMeta,
  getMeta,
} from "../../utils/storage.ts";
import type { DirectoryListingFile } from "../../utils/types.ts";
import { asyncPool } from "../../utils/util.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const MAX_FILE_SIZE = 100_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function handler(
  event: SQSEvent,
  context: Context,
): Promise<void> {
  for (const record of event.Records) {
    const { buildID } = JSON.parse(record.body);
    const build = await database.getBuild(buildID);
    if (build === null) {
      throw new Error("Build does not exist!");
    }
    switch (build.options.type) {
      case "github":
        try {
          await publishGithub(build);
        } catch (err) {
          console.log("error", err, err?.response);
          await database.saveBuild({
            ...build,
            status: "error",
            message: err.message,
          });
        }
        break;
      default:
        throw new Error(`Unknown build type: ${build.options.type}`);
    }
  }
}

async function publishGithub(
  build: Build,
) {
  console.log(
    `Publishing ${build.options.moduleName} at ${build.options.ref} from GitHub`,
  );
  await database.saveBuild({
    ...build,
    status: "publishing",
  });

  const { options: { moduleName, repository, ref, version, subdir } } = build;

  // Clone the repository from GitHub
  const cloneURL = `https://github.com/${repository}`;
  const clonePath = await clone(cloneURL, ref);
  
  console.log("Finished clone");

  try {
    // Upload files to S3
    const skippedFiles: string[] = [];
    const pendingUploads: Promise<void>[] = [];
    const directory: DirectoryListingFile[] = [];

    // Create path that has possible subdir prefix
    const path = (subdir === undefined ? clonePath : join(clonePath, subdir))
      .replace(
        /\/$/,
        "",
      );

    // Walk all files in the repository (that start with the subdir if present)
    const entries = [];
    for await (
      const entry of walk(path, {
        includeFiles: true,
        includeDirs: true,
      })
    ) {
      entries.push(entry);
    }

    console.log("Total files in repo", entries.length);

    // Pool requests because of https://github.com/denoland/deno_registry2/issues/15
    await asyncPool(95, entries, async (entry) => {
      // If this is a file in the .git folder, ignore it
      if (
        entry.path.startsWith(join(path, ".git/")) ||
        entry.path === join(path, ".git")
      ) {
        return;
      }

      const filename = entry.path.substring(path.length);
      if (entry.isFile) {
        const file = await Deno.open(entry.path);
        const body = await Deno.readAll(file);
        if (body.length > MAX_FILE_SIZE) {
          skippedFiles.push(filename);
          return;
        }
        directory.push(
          { path: filename, size: body.length, type: "file" },
        );
        await uploadVersionRaw(
          moduleName,
          version,
          filename,
          body,
        );
        file.close();
      } else {
        directory.push({ path: filename, size: undefined, type: "dir" });
      }
    });

    const versionsBody = await getMeta(moduleName, "versions.json");
    const versions = versionsBody
      ? JSON.parse(decoder.decode(versionsBody))
      : { versions: [] };
    await uploadMeta(
      moduleName,
      "versions.json",
      encoder.encode(
        JSON.stringify(
          { latest: version, versions: [version, ...versions.versions] },
        ),
      ),
    );

    // Calculate directory sizes
    // TODO: make more efficient
    for (const entry of directory) {
      if (entry.type === "dir") {
        entry.size = 0;
        for (
          const f of directory.filter(
            (f) => f.type === "file" && f.path.startsWith(entry.path),
          )
        ) {
          entry.size += f.size ?? 0;
        }
      }
    }

    // Upload directory listing to S3
    await uploadVersionMeta(
      moduleName,
      version,
      "meta.json",
      encoder.encode(JSON.stringify({
        uploaded_at: new Date().toISOString(),
        directory_listing: directory,
        upload_options: {
          type: "github",
          repository,
          subdir,
          ref,
        },
      })),
    );

    await database.saveBuild({
      ...build,
      status: "success",
      message:
        `Uploaded ${pendingUploads.length} files. Skipped files due to size: ${
          JSON.stringify(skippedFiles)
        }`,
    });
  } finally {
    // Remove checkout
    await Deno.remove(clonePath, { recursive: true });
  }
}
