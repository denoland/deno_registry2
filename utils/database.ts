// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { MongoClient } from "../deps.ts";

const mongo = new MongoClient();
mongo.connectWithUri(Deno.env.get("MONGO_URI")!);

const db = mongo.database("staging");
const modules = db.collection("modules");

export interface DatabaseEntry {
  name: string;
  type: string;
  repository: string;
  description: string;
  star_count: number;
}

export async function getEntry(
  name: string
): Promise<DatabaseEntry | undefined> {
  return modules.findOne({ name: name.toString() });
}

export async function saveEntry(entry: DatabaseEntry): Promise<void> {
  await modules.insertOne(entry);
}
