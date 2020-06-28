// This file is for testing agains production. It will be removed once we have proper tests.

import { create } from "./testdata/webhook.ts";

const refs = ["v5.0.0", "v5.1.0", "v5.1.1", "v5.2.0", "v5.3.0", "v5.3.1"];
for (const ref of refs) {
  const req = await fetch(
    "https://eg1bas7v2c.execute-api.us-east-2.amazonaws.com/webhook/gh/ltest",
    {
      headers: {
        "Content-Type": "application/json",
        "x-github-event": "create",
      },
      method: "POST",
      body: JSON.stringify(create(ref)),
    },
  );
  console.log(req.status, req.statusText);
  console.log(await req.json());
}
