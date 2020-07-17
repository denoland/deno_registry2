import { join, walk, SQSEvent, Context } from "../../deps.ts";
import { getBuild, Build, saveBuild } from "../../utils/database.ts";
import { clone } from "../../utils/git.ts";
import {
  uploadVersionMeta,
  uploadVersionRaw,
  uploadMeta,
  getMeta,
} from "../../utils/storage.ts";
import type { DirectoryListingFile, VersionInfo } from "../../utils/types.ts";

const MAX_FILE_SIZE = 100_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function handler(
  event: SQSEvent,
  context: Context,
): Promise<void> {
  for (const record of event.Records) {
    const { buildID } = JSON.parse(record.body);
    const build = await getBuild(buildID);
    if (build === null) {
      throw new Error("Build does not exist!");
    }
    switch (build.options.type) {
      case "github":
        try {
          await publishGithub(build);
        } catch (err) {
          console.log("error", err);
          await saveBuild({
            ...build,
            status: "error",
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
  await saveBuild({
    ...build,
    status: "building",
  });

  const { options: { moduleName, repository, ref, version, subdir } } = build;

  // Clone the repository from GitHub
  const cloneURL = `https://github.com/${repository}`;
  const clonePath = await clone(cloneURL, ref);

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
  for await (
    const entry of walk(path, {
      includeFiles: true,
      includeDirs: true,
    })
  ) {
    // If this is a .git file, then ignore
    if (entry.path.startsWith(join(path, ".git/"))) continue;
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
            await uploadVersionRaw(
              moduleName,
              version,
              filename,
              body,
            );
          } catch (err) {
            console.log("err", filename, err);
          } finally {
            file.close();
          }
        }),
      );
      // TODO(lucacasonato): remove this. This is currently necessary because Deno does
      // not cache DNS, and the DNS resolver has a rate limit.
      await new Promise((resolve) => setTimeout(resolve, 100));
    } else {
      directory.push({ path: filename, size: undefined, type: "dir" });
    }
  }

  // Upload latest version to S3
  pendingUploads.push(
    getMeta(moduleName, "versions.json").then(async (body) => {
      const versions = body
        ? JSON.parse(decoder.decode(body))
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
    }),
  );

  // Wait for all uploads to S3 to complete
  await Promise.all(pendingUploads);

  await Deno.remove(clonePath, { recursive: true });

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

  await saveBuild({
    ...build,
    status: "success",
  });
}
