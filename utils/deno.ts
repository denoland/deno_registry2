// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
const decoder = new TextDecoder();

export interface DepGraph {
  [file: string]: Dep;
}

export interface Dep {
  size: number;
  deps: string[];
}

export async function runDenoInfo(
  options: { entrypoint: string; denoDir: string },
): Promise<DepGraph> {
  const p = Deno.run({
    cmd: [
      "deno",
      "info",
      "--json",
      "--unstable",
      "--no-check",
      options.entrypoint,
    ],
    env: {
      "DENO_DIR": options.denoDir,
    },
    stdout: "piped",
    stderr: "inherit",
  });
  const file = await p.output();
  const status = await p.status();
  p.close();
  if (!status.success) {
    throw new Error(`Failed to run deno info for ${options.entrypoint}`);
  }
  const text = decoder.decode(file);
  const { files } = JSON.parse(text);
  return files;
}
