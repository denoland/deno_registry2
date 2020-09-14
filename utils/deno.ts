const decoder = new TextDecoder();

export interface Dep {
  name: string;
  size: string;
  deps: Dep[];
}

export async function runDenoInfo(
  options: { entrypoint: string; denoDir: string },
): Promise<Dep> {
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
  const { deps } = JSON.parse(text);
  return deps;
}
