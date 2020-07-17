// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { MongoClient, ObjectId } from "../deps.ts";

const mongo = new MongoClient();
mongo.connectWithUri(Deno.env.get("MONGO_URI")!);

const db = mongo.database("production");
const modules = db.collection<DBModule>(
  "modules",
);

type DBModule = Omit<Module, "id"> & { _id: string };

export interface Module {
  name: string;
  type: string;
  repository: string;
  description: string;
  star_count: number;
}

export interface SearchResult {
  name: string;
  description: string;
  star_count: number;
  search_score: number;
}

export async function getModule(name: string): Promise<Module | null> {
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

export async function saveModule(module: Module): Promise<void> {
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
    { upsert: true },
  );
}

export async function listModules(
  limit: number,
  page: number,
  query?: string,
): Promise<SearchResult[]> {
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
    description: doc.description,
    star_count: doc.star_count,
    search_score: doc.search_score,
  }));
}

export async function countModules(): Promise<number> {
  return modules.count();
}

const builds = db.collection<Omit<Build, "id"> & { _id: ObjectId }>("builds");

export interface Build {
  id: string;
  options: {
    moduleName: string;
    type: string;
    repository: string;
    ref: string;
    version: string;
    subdir?: string;
  };
  status: string;
  message?: string;
}

export async function getBuild(id: string): Promise<Build | null> {
  const build = await builds.findOne({ _id: ObjectId(id) });
  if (build === null) return null;
  return {
    id: build._id.$oid,
    options: {
      moduleName: build.options.moduleName,
      type: build.options.type,
      repository: build.options.repository,
      ref: build.options.ref,
      version: build.options.version,
      subdir: build.options.subdir,
    },
    status: build.status,
    message: build.message,
  };
}

export async function createBuild(build: Omit<Build, "id">): Promise<string> {
  const id = await builds.insertOne(
    {
      options: {
        moduleName: build.options.moduleName,
        type: build.options.type,
        repository: build.options.repository,
        ref: build.options.ref,
        version: build.options.version,
        subdir: build.options.subdir,
      },
      status: build.status,
      message: build.message,
    },
  );
  return id.$oid;
}

export async function saveBuild(build: Build): Promise<void> {
  await builds.updateOne(
    {
      _id: ObjectId(build.id),
    },
    {
      _id: ObjectId(build.id),
      options: {
        moduleName: build.options.moduleName,
        type: build.options.type,
        repository: build.options.repository,
        ref: build.options.ref,
        version: build.options.version,
        subdir: build.options.subdir,
      },
      status: build.status,
      message: build.message,
    },
    { upsert: true },
  );
}
