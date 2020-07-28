const oldReleases = JSON.parse(Deno.readTextFileSync("./releases.json"));
const newReleases = JSON.parse(Deno.readTextFileSync("./releases_new.json"));

const releases: Array<[string, string]> = [];

for (const module of newReleases) {
  if (module.status !== 200) {
    console.log(module.name, "status not 200");
    continue;
  }

  for (const release of module.data) {
    releases.push([module.name, release.name]);
  }
}

for (const module of oldReleases) {
  if (module.status !== 200) {
    console.log(module.name, "status not 200");
    continue;
  }

  for (const release of module.data) {
    const i = releases.findIndex(([n, r]) =>
      n === module.name && r === release.name
    );
    releases.splice(i, 1);
  }
}

console.log(releases);
