import { S3Client, join } from "../deps.ts";

const s3 = new S3Client(
  {
    bucket: Deno.env.get("STORAGE_BUCKET")!,
    region: Deno.env.get("AWS_REGION")!,
    accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
);

export async function getMeta(
  module: string,
  file: string,
): Promise<Uint8Array | undefined> {
  return s3.getObject(
    join(module, "meta", file),
    {},
  );
}

export async function uploadMeta(
  module: string,
  file: string,
  contents: Uint8Array,
): Promise<{ etag: string }> {
  const resp = await s3.putObject(
    join(module, "meta", file),
    contents,
    { acl: "public-read" },
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
    { acl: "public-read" },
  );
  return { etag: resp.etag };
}

export async function uploadVersionMeta(
  module: string,
  version: string,
  file: string,
  contents: Uint8Array,
): Promise<{ etag: string }> {
  const resp = await s3.putObject(
    join(module, "versions", version, "meta", file),
    contents,
    { acl: "public-read" },
  );
  return { etag: resp.etag };
}
