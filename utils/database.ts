// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { MongoClient } from "../deps.ts";

const mongo = new MongoClient();
mongo.connectWithUri(Deno.env.get("MONGO_URI")!);

const db = mongo.database("production");
const modules = db.collection<DBModule>("modules");

export interface DBModule {
  _id: string;
  type: string;
  repository: string;
  description: string;
  star_count: number;
}

export interface Module {
  name: string;
  type: string;
  repository: string;
  description: string;
  star_count: number;
}

export async function getEntry(name: string): Promise<Module | null> {
  // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
  // deno-lint-ignore no-explicit-any
  const entry = await modules.findOne({ _id: name.toString() } as any);
  if (entry === null) return null;
  return {
    name: entry._id,
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
      // deno-lint-ignore no-explicit-any
      _id: module.name as any,
    },
    {
      // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
      // deno-lint-ignore no-explicit-any
      _id: module.name as any,
      type: module.type,
      repository: module.repository,
      description: module.description,
      star_count: module.star_count,
    },
    { upsert: true }
  );
}

export async function listEntries(
  limit: number,
  page: number,
  query?: string
): Promise<(Module & { search_score: number })[]> {
  if (typeof limit !== "number") {
    throw new Error("limit must be a number");
  }
  if (typeof page !== "number") {
    throw new Error("page must be a number");
  }
  if (page <= 0) {
    throw new Error("page must be 1 or larger");
  }
  if (query !== undefined && typeof query !== "string") {
    throw new Error("query value must be undefined or a string");
  }

  // If search is present, add a search step to the aggregation pipeline
  const searchAggregation = query
    ? [
        {
          $search: {
            text: {
              query: query,
              path: ["_id", "description"],
              fuzzy: {},
            },
          },
        },
        {
          $addFields: {
            search_score: {
              $meta: "searchScore",
            },
          },
        },
        {
          $sort: {
            search_score: -1,
          },
        },
      ]
    : [
        {
          $sort: {
            star_count: -1,
          },
        },
      ];

  //  Query the database
  const docs = (await modules.aggregate([
    ...searchAggregation,
    {
      $skip: (page - 1) * limit,
    },
    {
      $limit: limit,
    },
  ])) as (DBModule & { search_score: number })[];

  // Transform the results
  return docs.map((doc) => ({
    name: doc._id,
    type: doc.type,
    repository: doc.repository,
    description: doc.description,
    star_count: doc.star_count,
    search_score: doc.search_score,
  }));
}

export async function countEntries(): Promise<number> {
  return modules.count();
}
