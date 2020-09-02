// S3_BUCKET is passed in as an env var

/**
 * Handles a request
 * @param {Request} request 
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const resp = await fetch(`${S3_BUCKET}${url.pathname}`, {
    cf: { cacheEverything: true },
  });
  const resp2 = new Response(resp.body, resp);
  resp2.headers.set("Access-Control-Allow-Origin", "*");
  return resp2;
}

addEventListener("fetch", (event) => {
  return event.respondWith(handleRequest(event.request));
});
