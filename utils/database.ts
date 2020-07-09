// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { MongoClient } from "../deps.ts";

const mongo = new MongoClient();
mongo.connectWithUri(Deno.env.get("MONGO_URI")!);

const db = mongo.database("production");
const modules = db.collection("modules");

export interface Module {
  name: string;
  type: string;
  repository: string;
  description: string;
  star_count: number;
}

export async function getEntry(name: string): Promise<Module | null> {
  const entry = await modules.findOne({ _id: name.toString() });
  if (entry === null) return null;
  return {
    name: entry.name,
    type: entry.type,
    repository: entry.repository,
    description: entry.description,
    star_count: entry.star_count,
  };
}

export async function saveEntry(module: Module): Promise<void> {
  await modules.insertOne({
    _id: module.name,
    type: module.type,
    repository: module.repository,
    description: module.description,
    star_count: module.star_count,
  });
}
