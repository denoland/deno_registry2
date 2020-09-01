const listURI = "https://api.deno.land/modules?page=1&limit=20&query=deno";
const getURI = "https://api.deno.land/modules/oak";

const errs = [];

const search = fetch(listURI)
  .then((res) => {
    if (res.status >= 500) {
      errs.push(`${listURI} failed with status code ${res.status}`);
    }
    return res.json();
  })
  .then((res) => {
    if (!res.success || res.error) {
      errs.push(`${listURI} failed: ${res.error}`);
    }
    if (res.success && res.data?.total_count < 1) {
      errs.push(`${listURI} expected to return at least one result`);
    }
  })
  .catch((err) => {
    errs.push(`${listURI} error: ${err}`);
  });

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

await Promise.all([search, get]).then(() => {
  if (errs.length > 0) {
    console.log(errs.join("\n"));
    Deno.exit(1);
  }
});
