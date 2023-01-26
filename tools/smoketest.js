// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
const getURI = "https://api.deno.land/modules/oak";

const errs = [];

const get = fetch(getURI)
  .then((res) => {
    if (res.status >= 500) {
      errs.push(`${getURI} failed with status code ${res.status}`);
    }
    return res.json();
  })
  .then((res) => {
    if (!res.success || res.error) {
      errs.push(`${getURI} failed: ${res.error}`);
    }
    if (res.success && res.data?.name != "oak") {
      errs.push(`${getURI} to return the oak framework module`);
    }
  })
  .catch((err) => {
    errs.push(`${getURI} error: ${err}`);
  });

await get.then(() => {
  if (errs.length > 0) {
    console.log(errs.join("\n"));
    Deno.exit(1);
  }
});
