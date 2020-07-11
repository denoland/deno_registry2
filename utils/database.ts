// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { MongoClient } from "../deps.ts";

const mongo = new MongoClient();
mongo.connectWithUri(Deno.env.get("MONGO_URI")!);

const db = mongo.database("production");
const modules = db.collection<Module>("modules");

export interface Module {
  name: string;
  type: string;
  repository: string;
  description: string;
  star_count: number;
}

export async function getEntry(name: string): Promise<Module | null> {
  // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
  const entry = await modules.findOne({ _id: name.toString() } as any);
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
  await modules.updateOne(
    {
      // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
      _id: module.name as any,
    },
    {
      // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
      _id: module.name as any,
      type: module.type,
      repository: module.repository,
      description: module.description,
      star_count: module.star_count,
    },
    { upsert: true }
  );
}
