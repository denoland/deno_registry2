// Copyright 2020 the Deno authors. All rights reserved. MIT license.

export async function clone(url: string, tag: string): Promise<string> {
  const tmp = await Deno.makeTempDir();
  const clone = Deno.run({
    cmd: [
      "git",
      "clone",
      "--depth",
      "1",
      "--recursive",
      "-b",
      tag,
      url,
      tmp,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const cloneRes = await clone.status();
  if (!cloneRes.success) {
    throw new Error(`Failed to clone git repository ${url} at tag ${tag}`);
  }
  return tmp;
}
