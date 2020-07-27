const data = JSON.parse(Deno.readTextFileSync("./releases.json"));

let totalReleases = 0;

console.log(data.length, "# modules");

console.log("-----------");
console.log("ALL WITHOUT TAGS:");
console.log(
  data.filter((d: any) => d.data.length === 0).map((d: any) => d.name),
);

console.log("-----------");
console.log("MODULES THAT ARE NOT 200");
console.log(
  data.filter((d: any) => d.status !== 200).map((d: any) => d.name),
);

for (const d of data) {
  totalReleases += d.data.length;
}

console.log("-----------");
console.log(totalReleases, "# releases");

export {};
