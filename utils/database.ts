import { createClient } from "../deps.ts";

const dynamodb = createClient({ region: Deno.env.get("AWS_REGION")! });

const MODULE_ENTRIES_TABLE = Deno.env.get("MODULE_ENTRIES_TABLE");

export interface DatabaseEntry {
  name: string;
  type: "github";
  repository: string;
}

export async function getEntry(
  name: string,
): Promise<DatabaseEntry | undefined> {
  const doc = await dynamodb.getItem({
    Key: { name },
    TableName: MODULE_ENTRIES_TABLE,
  });
  return doc.Item;
}

export async function saveEntry(entry: DatabaseEntry): Promise<void> {
  await dynamodb.putItem({
    Item: entry,
    TableName: MODULE_ENTRIES_TABLE,
  });
}
