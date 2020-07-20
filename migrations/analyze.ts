const data = JSON.parse(Deno.readTextFileSync("./data.json"));

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
