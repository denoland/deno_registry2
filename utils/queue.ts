// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import { SQSQueue } from "../deps.ts";

const buildsSQS = new SQSQueue(
  {
    queueURL: Deno.env.get("BUILD_QUEUE")!,
    region: Deno.env.get("AWS_REGION")!,
    accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    sessionToken: Deno.env.get("AWS_SESSION_TOKEN"),
  },
);

export async function queueBuild(buildID: string): Promise<void> {
  await buildsSQS.sendMessage({
    body: JSON.stringify({ buildID }),
  });
}
