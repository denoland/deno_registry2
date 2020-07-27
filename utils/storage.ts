// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { S3Bucket, join } from "../deps.ts";

const s3 = new S3Bucket(
  {
    bucket: Deno.env.get("STORAGE_BUCKET")!,
    region: Deno.env.get("AWS_REGION")!,
    accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    sessionToken: Deno.env.get("AWS_SESSION_TOKEN"),
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
  return resp?.body;
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
      // Global module meta data must always be fresh, but it is acceptable
      // to serve stale data for a few minutes.
      cacheControl: "max-age=0, stale-while-revalidate=300",
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
  const resp = await s3.putObject(
    join(module, "versions", version, "raw", file),
    contents,
    {
      acl: "public-read",
      // Versioned files can be cached indefinitely. (1 year)
      cacheControl: "public, max-age=31536000, immutable",
      // TODO(lucacasonato): add content type
    },
  );
  return { etag: resp.etag };
}

export async function uploadVersionMetaJson(
  module: string,
  version: string,
  file: string,
  data: unknown,
): Promise<{ etag: string }> {
  const resp = await s3.putObject(
    join(module, "versions", version, "meta", file),
    encoder.encode(JSON.stringify(data)),
    {
      acl: "public-read",
      // Versioned files can be cached indefinitely. (1 year)
      cacheControl: "public, max-age=31536000, immutable",
      contentType: "application/json",
    },
  );
  return { etag: resp.etag };
}
