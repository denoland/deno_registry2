// Copyright 2020 the Deno authors. All rights reserved. MIT license.

export async function clone(url: string, tag: string): Promise<string> {
  const tmp = await Deno.makeTempDir();
  const clone = Deno.run({
    cmd: [
      "git",
      "clone",
      "--depth",
      "1",
      // TODO(lucacasonato): re enable, this is is to slow for the moment
      // "--recursive",
      "-b",
      tag,
      url,
      tmp,
    ],
    stdout: "null",
    stderr: "null",
  });
  // TODO: better error handling
  const cloneRes = await clone.status();
  clone.close();
  if (!cloneRes.success) {
    throw new Error(`Failed to clone git repository ${url} at tag ${tag}`);
  }
  return tmp;
}
