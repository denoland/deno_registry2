// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/** 
 * This function is responsible for downloading a modules' source code
 * from an origin repository like GitHub and uploading it to S3. This is
 * triggered by an event in the AWS SQS build queue. It contains the ID
 * of the build, which is stored in MongoDB. The build stored in MongoDB
 * contain all relevant information that is required to upload the module:
 * the module name, GitHub repository, version, subdirectory ect.
 */

import { Context, join, pooledMap, SQSEvent, walk } from "../../deps.ts";
import { Build, BuildStats, Database } from "../../utils/database.ts";
import { clone } from "../../utils/git.ts";
import {
  getMeta,
  getVersionMetaJson,
  uploadMetaJson,
  uploadVersionMetaJson,
  uploadVersionRaw,
} from "../../utils/storage.ts";
import type { DirectoryListingFile } from "../../utils/types.ts";
import { DepGraph, runDenoInfo } from "../../utils/deno.ts";
import { collectAsyncIterable, directorySize } from "../../utils/utils.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const remoteURL = Deno.env.get("REMOTE_URL")!;

const DEFAULT_MAX_TOTAL_SIZE = 1024 * 1024 * 20; // 20 mb in total

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

    let stats: BuildStats | undefined = undefined;

    switch (build.options.type) {
      case "github":
        try {
          stats = await publishGithub(build);
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

    await analyzeDependencies(build).catch((err) => {
      console.error("failed dependency analysis", build, err, err?.response);
      message += " Failed to run dependency analysis v2.";
    });

    await database.saveBuild({
      ...build,
      status: "success",
      message: message,
      stats,
    });
  }
}

async function publishGithub(
  build: Build,
): Promise<{
  total_files: number;
  total_size: number;
}> {
  console.log(
    `Publishing ${build.options.moduleName} at ${build.options.ref} from GitHub`,
  );
  const quota = await database.getOwnerQuota(
    build.options.repository.split("/")[0] as string,
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
        const body = await Deno.readAll(file);
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
      "meta.json",
      {
        uploaded_at: new Date().toISOString(),
        directory_listing: directory.sort((a, b) =>
          a.path.localeCompare(b.path)
        ),
        upload_options: {
          type: "github",
          repository,
          subdir,
          ref,
        },
      },
      true,
    );

    return {
      total_files: directory.filter((f) => f.type === "file").length,
      total_size: totalSize,
    };
  } finally {
    // Remove checkout
    await Deno.remove(clonePath, { recursive: true });
  }
}

export async function analyzeDependencies(build: Build): Promise<void> {
  console.log(
    `Analyzing dependencies for ${build.options.moduleName}@${build.options.version}`,
  );
  await database.saveBuild({
    ...build,
    status: "analyzing_dependencies",
  });

  const { options: { moduleName, version } } = build;
  const denoDir = await Deno.makeTempDir();
  const prefix = remoteURL.replace("%m", moduleName).replace("%v", version);

  const rawMeta = await getVersionMetaJson(moduleName, version, "meta.json");
  if (!rawMeta) {
    throw new Error("Invalid module");
  }
  const meta: { directory_listing: DirectoryListingFile[] } = JSON.parse(
    decoder.decode(rawMeta),
  );

  let total = 0;
  let skipped = 0;

  const totalGraph: DepGraph = {};

  for await (const file of meta.directory_listing) {
    if (file.type !== "file") {
      continue;
    }

    // Skip non code files
    if (
      !(file.path.endsWith(".js") || file.path.endsWith(".jsx") ||
        file.path.endsWith(".ts") || file.path.endsWith(".tsx"))
    ) {
      continue;
    }

    const url = new URL(prefix);
    url.pathname = join(
      url.pathname,
      file.path,
    );
    const entrypoint = url.toString();

    total++;

    // We can skip analyzing a module if we have already analyzed
    // and this already in the dependency graph.
    if (totalGraph[entrypoint]) {
      skipped++;
      continue;
    }

    const graphToJoin = await runDenoInfo({ entrypoint, denoDir });
    for (const url in graphToJoin) {
      totalGraph[url] = {
        ...graphToJoin[url],
        deps: [...new Set(graphToJoin[url].deps)],
      };
    }
  }

  console.log(">>>>>> total", total, "skipped", skipped);

  await Deno.remove(denoDir, { recursive: true });

  await uploadVersionMetaJson(
    build.options.moduleName,
    build.options.version,
    "deps_v2.json",
    { graph: { nodes: totalGraph } },
    false,
  );
}
