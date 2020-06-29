// This file is for testing agains production. It will be removed once we have proper tests.

import { readJsonSync } from "./deps.ts";

const webhook = readJsonSync("./testdata/create_webhook.json") as object;
const refs = ["0.0.1", "0.0.2", "0.0.3", "0.0.4"];
for (const ref of refs) {
  const req = await fetch(
    "https://r7syvcjpxa.execute-api.us-east-2.amazonaws.com/webhook/gh/ltest",
    {
      headers: {
        "Content-Type": "application/json",
        "x-github-event": "create",
      },
      method: "POST",
      body: JSON.stringify({ ...webhook, ref }),
    },
  );
  console.log(req.status, req.statusText);
  console.log(await req.json());
}
