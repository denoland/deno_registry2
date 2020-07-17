import { SQSClient } from "../deps.ts";

const buildsSQS = new SQSClient(
  {
    queueURL: Deno.env.get("BUILD_QUEUE")!,
    region: Deno.env.get("AWS_REGION")!,
    accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
);

export async function queueBuild(buildID: string): Promise<void> {
  await buildsSQS.sendMessage({
    body: JSON.stringify({ buildID }),
  });
}
