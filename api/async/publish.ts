// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/** 
 * This function is responsible for downloading a modules' source code
 * from an origin repository like GitHub and uploading it to S3. This is
 * triggered by an event in the AWS SQS build queue. It contains the ID
 * of the build, which is stored in MongoDB. The build stored in MongoDB
 * contain all relevant information that is required to upload the module:
 * the module name, GitHub repository, version, subdirectory ect.
 */

import { join, walk, pooledMap, SQSEvent, Context } from "../../deps.ts";
import { Build, Database, BuildStats } from "../../utils/database.ts";
import { clone } from "../../utils/git.ts";
import {
  uploadVersionMetaJson,
  uploadVersionRaw,
  uploadMetaJson,
  getMeta,
  getVersionMetaJson,
} from "../../utils/storage.ts";
import type { DirectoryListingFile } from "../../utils/types.ts";
import { runDenoInfo } from "../../utils/deno.ts";
import type { Dep } from "../../utils/deno.ts";
import { collectAsyncIterable, directorySize } from "../../utils/utils.ts";
const database = new Database(Deno.env.get("MONGO_URI")!);

const remoteURL = Deno.env.get("REMOTE_URL")!;

const MAX_FILE_SIZE = 2_500_000;

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
  skipped_due_to_size: string[];
  total_size: number;
}> {
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
    await collectAsyncIterable(pooledMap(65, entries, async (entry) => {
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

    const totalSize = directorySize(directory);

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
      skipped_due_to_size: skippedFiles,
      total_size: totalSize,
    };
  } finally {
    // Remove checkout
    await Deno.remove(clonePath, { recursive: true });
  }
}

interface DependencyGraph {
  nodes: {
    [url: string]: {
      size: number;
      deps: string[];
    };
  };
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

  const graph: DependencyGraph = { nodes: {} };

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
    if (graph.nodes[entrypoint]) {
      skipped++;
      continue;
    }

    const dep = await runDenoInfo({ entrypoint, denoDir });
    treeToGraph(graph, dep);
  }

  console.log(">>>>>> total", total, "skipped", skipped);

  await Deno.remove(denoDir, { recursive: true });

  await uploadVersionMetaJson(
    build.options.moduleName,
    build.options.version,
    "deps_v2.json",
    { graph },
    false,
  );
}

function treeToGraph(graph: DependencyGraph, dep: Dep) {
  const url = dep.name;
  if (!graph.nodes[url]) {
    graph.nodes[url] = { deps: [], size: dep.size };
  }
  dep.deps.forEach((dep) => {
    if (!graph.nodes[url].deps.includes(dep.name)) {
      graph.nodes[url].deps.push(dep.name);
    }
  });
  dep.deps.forEach((dep) => treeToGraph(graph, dep));
}
