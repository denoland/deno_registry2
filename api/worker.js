// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
// S3_BUCKET is passed in as an env var

/**
 * Handles a request
 * @param {Request} request
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  // deno-lint-ignore no-undef
  const resp = await fetch(
    `${Deno.env.get("S3_BUCKET") ?? ""}${url.pathname}`,
    {
      cf: { cacheEverything: true },
    },
  );
  const resp2 = new Response(resp.body, resp);
  resp2.headers.set("Access-Control-Allow-Origin", "*");
  resp2.headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  );
  return resp2;
}

addEventListener("fetch", (event) => {
  return event.respondWith(handleRequest(event.request));
});
