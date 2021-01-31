// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { join, lookup, S3Bucket } from "../deps.ts";

export const s3 = new S3Bucket(
  {
    bucket: Deno.env.get("STORAGE_BUCKET")!,
    region: Deno.env.get("AWS_REGION")!,
    accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    sessionToken: Deno.env.get("AWS_SESSION_TOKEN"),
    endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
  },
);

export const moderationS3 = new S3Bucket(
  {
    bucket: Deno.env.get("MODERATION_BUCKET")!,
    region: Deno.env.get("AWS_REGION")!,
    accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    sessionToken: Deno.env.get("AWS_SESSION_TOKEN"),
    endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
  },
);

export async function getMeta(
  module: string,
  file: string,
): Promise<Uint8Array | undefined> {
  const resp = await s3.getObject(
    join(module, "meta", file),
    {},
  );
  if (!resp) return undefined;
  return new Uint8Array(await new Response(resp.body).arrayBuffer());
}

export async function getVersionMetaJson(
  module: string,
  version: string,
  file: string,
): Promise<Uint8Array | undefined> {
  const resp = await s3.getObject(
    join(module, "versions", version, "meta", file),
    {},
  );
  if (!resp) return undefined;
  return new Uint8Array(await new Response(resp.body).arrayBuffer());
}

const encoder = new TextEncoder();

export async function uploadMetaJson(
  module: string,
  file: string,
  data: unknown,
): Promise<{ etag: string }> {
  const resp = await s3.putObject(
    join(module, "meta", file),
    encoder.encode(JSON.stringify(data)),
    {
      acl: "public-read",
      // Global module meta data must always be fresh.
      cacheControl: "max-age=10, must-revalidate",
      contentType: "application/json",
    },
  );
  return { etag: resp.etag };
}

export async function uploadVersionRaw(
  module: string,
  version: string,
  file: string,
  contents: Uint8Array,
): Promise<{ etag: string }> {
  const type = lookup(file) ??
    (file.endsWith(".tsx")
      ? "application/typescript; charset=utf-8"
      : file.endsWith(".tsx")
      ? "application/javascript; charset=utf-8"
      : "application/octet-stream");
  const resp = await s3.putObject(
    join(module, "versions", version, "raw", file),
    contents,
    {
      acl: "public-read",
      // Versioned files can be cached indefinitely. (1 year)
      cacheControl: "public, max-age=31536000, immutable",
      contentType: type === "video/mp2t"
        ? "application/typescript; charset=utf-8"
        : type === "text/jsx"
        ? "application/javascript; charset=utf-8"
        : type,
    },
  );
  return { etag: resp.etag };
}

export async function uploadVersionMetaJson(
  module: string,
  version: string,
  file: string,
  data: unknown,
  immutable: boolean,
): Promise<{ etag: string }> {
  const resp = await s3.putObject(
    join(module, "versions", version, "meta", file),
    encoder.encode(JSON.stringify(data)),
    {
      acl: "public-read",
      // Immutable files can be cached indefinitely. (1 year)
      cacheControl: immutable
        ? "public, max-age=31536000, immutable"
        : "max-age=10, must-revalidate",
      contentType: "application/json",
    },
  );
  return { etag: resp.etag };
}

export async function getForbiddenWords(): Promise<Uint8Array | undefined> {
  const resp = await moderationS3.getObject(
    "badwords.txt",
    {},
  );
  if (!resp) return undefined;
  return new Uint8Array(await new Response(resp.body).arrayBuffer());
}
