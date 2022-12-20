// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

/**
 * This function is responsible for downloading a modules' source code
 * from an origin repository like GitHub and uploading it to S3. This is
 * triggered by an event in the AWS SQS build queue. It contains the ID
 * of the build, which is stored in MongoDB. The build stored in MongoDB
 * contain all relevant information that is required to upload the module:
 * the module name, GitHub repository, version, subdirectory ect.
 */

import {
  Context,
  join,
  pooledMap,
  readAll,
  SQSEvent,
  walk,
} from "../../deps.ts";
import { Build, Database } from "../../utils/database.ts";
import { Database as Datastore } from "../../utils/datastore_database.ts";
import { clone } from "../../utils/git.ts";
import {
  getMeta,
  uploadMetaJson,
  uploadVersionMetaJson,
  uploadVersionRaw,
} from "../../utils/storage.ts";
import type { DirectoryListingFile } from "../../utils/types.ts";
import { collectAsyncIterable, directorySize } from "../../utils/utils.ts";

const database = await Database.connect(Deno.env.get("MONGO_URI")!);
const datastore = new Datastore();

const apilandURL = Deno.env.get("APILAND_URL")!;
const apilandAuthToken = Deno.env.get("APILAND_AUTH_TOKEN")!;

const DEFAULT_MAX_TOTAL_SIZE = 1024 * 1024 * 20; // 20 mb in total

const decoder = new TextDecoder();

export async function handler(
  event: SQSEvent,
  _context: Context,
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
          return;
        }
        break;
      default:
        throw new Error(`Unknown build type: ${build.options.type}`);
    }

    let message = "Published module.";

    // send a webhook request to apiland to do further indexing of the module
    // this is temporary until apiland subsumes the functionality of registry2
    const res = await fetch(apilandURL, {
      method: "POST",
      body: JSON.stringify({
        event: "create",
        module: build.options.moduleName,
        version: build.options.version,
      }),
      headers: {
        "authorization": `bearer ${apilandAuthToken}`,
        "content-type": "application/json",
      },
    });

    if (res.status !== 200) {
      console.error(
        "failed to post webhook to apiland",
        apilandURL,
        res.status,
        res.statusText,
      );
      message += " Failed to post webhook to apiland.";
    }

    // consume body, to not leak resources
    await res.text();

    await database.saveBuild({
      ...build,
      status: "success",
      message: message,
    });
  }
}

async function publishGithub(build: Build) {
  console.log(
    `Publishing ${build.options.moduleName} at ${build.options.ref} from GitHub`,
  );
  const quota = await datastore.getOwnerQuota(
    build.options.repository.split("/")[0] as string,
  );
  await database.saveBuild({
    ...build,
    status: "publishing",
  });

  const { options: { moduleName, repository, ref, version, subdir } } = build;

  // Clone the repository from GitHub
  const cloneURL = `https://github.com/${repository}`;
  const clonePath = await clone(cloneURL, ref, subdir);

  console.log("Finished clone");

  try {
    // Create path that has possible subdir prefix
    const path = (subdir === undefined ? clonePath : join(
      clonePath,
      subdir.replace(
        /(^\/|\/$)/g,
        "",
      ),
    ));

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

    const directory: DirectoryListingFile[] = [];

    await collectAsyncIterable(pooledMap(100, entries, async (entry) => {
      const filename = entry.path.substring(path.length);

      // If this is a file in the .git folder, ignore it
      if (filename.startsWith("/.git/") || filename === "/.git") return;

      if (entry.isFile) {
        const stat = await Deno.stat(entry.path);
        directory.push({ path: filename, size: stat.size, type: "file" });
      } else {
        directory.push({ path: filename, size: undefined, type: "dir" });
      }
    }));

    const totalSize = directorySize(directory);

    if (totalSize > (quota?.max_total_size ?? DEFAULT_MAX_TOTAL_SIZE)) {
      const message =
        `Module too large (${totalSize} bytes). Maximum allowed size is ${DEFAULT_MAX_TOTAL_SIZE} bytes.`;
      console.log(message);
      throw new Error(message);
    }

    // Pool requests because of https://github.com/denoland/deno_registry2/issues/15
    await collectAsyncIterable(pooledMap(65, directory, async (entry) => {
      if (entry.type === "file") {
        const file = await Deno.open(join(path, entry.path));
        const body = await readAll(file);
        await uploadVersionRaw(
          moduleName,
          version,
          entry.path,
          body,
        );
        file.close();
      }
    }));

    const versionsBody = await getMeta(moduleName, "versions.json");
    const versions = versionsBody
      ? JSON.parse(decoder.decode(versionsBody))
      : { versions: [] };
    await uploadMetaJson(
      moduleName,
      "versions.json",
      { latest: version, versions: [version, ...versions.versions] },
    );

    // Upload directory listing to S3
    await uploadVersionMetaJson(
      moduleName,
      version,
      {
        directory_listing: directory.sort((a, b) =>
          a.path.localeCompare(b.path, "en-US")
        ),
        uploaded_at: new Date().toISOString(),
        upload_options: {
          type: "github",
          repository,
          subdir,
          ref,
        },
      },
    );
  } finally {
    // Remove checkout
    await Deno.remove(clonePath, { recursive: true });
  }
}
