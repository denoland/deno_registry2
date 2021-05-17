// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import { join } from "../deps.ts";

export async function clone(
  url: string,
  tag: string,
  subdir?: string,
): Promise<string> {
  const tmp = await Deno.makeTempDir();
  const clone = Deno.run({
    cmd: [
      "git",
      "clone",
      "--depth=1",
      "--filter=blob:none",
      "--sparse",
      // TODO(lucacasonato): re enable, this is is to slow for the moment
      // "--recursive",
      `--branch=${tag}`,
      url,
      tmp,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  // TODO: better error handling
  const cloneRes = await clone.status();
  clone.close();
  if (!cloneRes.success) {
    throw new Error(`Failed to clone git repository ${url} at tag ${tag}`);
  }

  const dir = subdir === undefined ? '/*' : join('/', subdir, '*');
  const checkout = Deno.run({
    cwd: tmp,
    cmd: ["git", "sparse-checkout", "set", dir],
    stdout: "inherit",
    stderr: "inherit",
  });
  // TODO: better error handling
  const checkoutRes = await checkout.status();
  checkout.close();
  if (!checkoutRes.success) {
    throw new Error(
      `Failed to sparse checkout ${dir} from git repository ${url} at tag ${tag}`,
    );
  }
  return tmp;
}
