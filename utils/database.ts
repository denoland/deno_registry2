// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { MongoClient, ObjectId } from "../deps.ts";

type DBModule = Omit<Module, "id"> & { _id: string };

export interface Module {
  name: string;
  type: string;
  owner: string;
  repo: string;
  description: string;
  star_count: number;
  is_unlisted: boolean;
}

export interface SearchResult {
  name: string;
  description: string;
  star_count: number;
  search_score: number;
}

export interface Build {
  id: string;
  created_at: Date;
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
  stats?: BuildStats;
}

export interface BuildStats {
  total_files: number;
  total_size: number;
  skipped_due_to_size: string[];
}

export interface OwnerQuota {
  owner: string;
  type: string;
  max_modules: number;
}

export type DBOwnerQuota = Omit<OwnerQuota, "owner"> & {
  _id: string;
};

export class Database {
  private mongo = new MongoClient();
  protected db = this.mongo.database("production");
  _modules = this.db.collection<DBModule>("modules");
  _builds = this.db.collection<Omit<Build, "id"> & { _id: ObjectId }>("builds");
  _owner_quotas = this.db.collection<DBOwnerQuota>("owner_quotas");

  constructor(mongoUri: string) {
    this.mongo.connectWithUri(mongoUri);
    if (this.mongo.clientId === null || this.mongo.clientId === undefined) {
      throw new Error("Could not connect to database.");
    }
  }

  async getModule(name: string): Promise<Module | null> {
    // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
    // deno-lint-ignore no-explicit-any
    const entry = await this._modules.findOne({ _id: name.toString() } as any);
    if (entry === null) return null;
    return {
      name: entry._id,
      type: entry.type,
      owner: entry.owner,
      repo: entry.repo,
      description: entry.description,
      star_count: entry.star_count,
      is_unlisted: entry.is_unlisted ?? false,
    };
  }

  async saveModule(module: Module): Promise<void> {
    await this._modules.updateOne(
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
        owner: module.owner,
        repo: module.repo,
        description: module.description,
        star_count: module.star_count,
        is_unlisted: module.is_unlisted,
      },
      { upsert: true },
    );
  }

  async listModules(
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
          $match: {
            is_unlisted: { $not: { $eq: true } },
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
          $match: {
            is_unlisted: { $not: { $eq: true } },
          },
        },
        {
          $sort: {
            star_count: -1,
          },
        },
      ];

    //  Query the database
    const docs = (await this._modules.aggregate([
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

  async countModules(): Promise<number> {
    return this._modules.count({
      is_unlisted: { $not: { $eq: true } },
    });
  }

  async countModulesForRepository(
    owner: string,
    repo: string,
  ): Promise<number> {
    const modules = await this._modules.find({ owner, repo });
    return modules.length;
  }

  async countModulesForOwner(owner: string): Promise<number> {
    const modules = await this._modules.find({ owner });
    return modules.length;
  }

  async getBuild(id: string): Promise<Build | null> {
    const build = await this._builds.findOne({ _id: ObjectId(id) });
    if (build === null) return null;
    return {
      id: build._id.$oid,
      created_at: build.created_at,
      options: build.options,
      status: build.status,
      message: build.message,
      stats: build.stats,
    };
  }

  async getBuildForVersion(
    name: string,
    version: string,
  ): Promise<Build | null> {
    const build = await this._builds.findOne({
      // @ts-expect-error because the deno_mongo typings are incorrect
      "options.moduleName": name,
      "options.version": version,
    });
    if (build === null) return null;
    return {
      id: build._id.$oid,
      created_at: build.created_at,
      options: build.options,
      status: build.status,
      message: build.message,
      stats: build.stats,
    };
  }

  async createBuild(
    build: Omit<Omit<Build, "id">, "created_at">,
  ): Promise<string> {
    const id = await this._builds.insertOne({
      created_at: new Date(),
      options: build.options,
      status: build.status,
      message: build.message,
      stats: build.stats,
    });
    return id.$oid;
  }

  async saveBuild(build: Build): Promise<void> {
    await this._builds.updateOne(
      {
        _id: ObjectId(build.id),
      },
      {
        _id: ObjectId(build.id),
        created_at: build.created_at,
        options: build.options,
        status: build.status,
        message: build.message,
        stats: build.stats,
      },
      { upsert: true },
    );
  }

  async getOwnerQuota(
    owner: string,
  ): Promise<OwnerQuota | null> {
    const ownerQuota = await this._owner_quotas.findOne({
      // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
      // deno-lint-ignore no-explicit-any
      _id: owner as any,
    });
    if (ownerQuota === null) return null;
    return {
      // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
      // deno-lint-ignore no-explicit-any
      owner: ownerQuota._id as string,
      type: ownerQuota.type,
      max_modules: ownerQuota.max_modules,
    };
  }

  async saveOwnerQuota(
    ownerQuota: OwnerQuota,
  ): Promise<void> {
    await this._owner_quotas.updateOne(
      {
        // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
        // deno-lint-ignore no-explicit-any
        _id: ownerQuota.owner as any,
      },
      {
        // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
        // deno-lint-ignore no-explicit-any
        _id: ownerQuota.owner as any,
        type: ownerQuota.type,
        max_modules: ownerQuota.max_modules,
      },
      { upsert: true },
    );
  }
}
