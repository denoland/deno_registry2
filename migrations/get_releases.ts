const githubToken = Deno.env.get("GITHUB_TOKEN");

if (!githubToken) {
  console.log("please provide $GITHUB_TOKEN");
  Deno.exit(1);
}

const responses = [];

const database = JSON.parse(Deno.readTextFileSync("./database.json"));

let i = 0;

for (const name in database) {
  const entry = database[name];

  const repository = entry.owner + "/" + entry.repo;

  responses.push(
    fetch(`https://api.github.com/repos/${repository}/tags?per_page=100`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
      },
    }).then(
      async (resp) => {
        return {
          name,
          repository,
          status: resp.status,
          data: resp.ok ? await resp.json() : await resp.text(),
        };
      },
    ).catch((err) => {
      return {
        name,
        repository,
        error: err,
      };
    }),
  );

  i++;
  console.log(`${i}/${Object.keys(database).length}`, name);

  await new Promise((r) => setTimeout(r, 50));
}

Deno.writeTextFileSync(
  "./releases.json",
  JSON.stringify(await Promise.all(responses)),
);

export {};
