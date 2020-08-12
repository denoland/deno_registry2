const decoder = new TextDecoder();

export type Dep = [string, Dep[]];

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
  const status = await p.status();
  const file = await p.output();
  p.close();
  if (!status.success) {
    throw new Error(`Failed to run deno info for ${options.entrypoint}`);
  }
  const text = decoder.decode(file);
  const { deps } = JSON.parse(text);
  return deps;
}
