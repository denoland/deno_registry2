const S3_BUCKET =
  "http://deno-registry-prod-storagebucket-d7uq3yal946u.s3-website-us-east-1.amazonaws.com";

/**
 * Handles a request
 * @param {Request} request 
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  return fetch(`${S3_BUCKET}${url.pathname}`);
}

addEventListener("fetch", (event) => {
  return event.respondWith(handleRequest(event.request));
});
