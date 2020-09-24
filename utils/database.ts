// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { MongoClient, ObjectId } from "../deps.ts";

export type DBModule = Omit<Module, "name"> & { _id: string };
export type ScoredModule = DBModule & { search_score: number };

export interface Module {
  name: string;
  type: string;
  owner: string;
  repo: string;
  description: string;
  star_count: number;
  is_unlisted: boolean;
  created_at: Date;
}

export interface SearchResult {
  name: string;
  description: string;
  star_count: number;
  search_score: number;
}

export interface RecentlyAddedModuleResult {
  name: string;
  description: string;
  star_count: number;
  created_at: Date;
}

export interface RecentlyAddedUploadedVersions {
  name: string;
  version: string;
  created_at: Date;
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

  _entryToModule(entry: DBModule): Module {
    return {
      name: entry._id,
      type: entry.type,
      owner: entry.owner,
      repo: entry.repo,
      description: entry.description,
      star_count: entry.star_count,
      is_unlisted: entry.is_unlisted ?? false,
      created_at: entry.created_at,
    };
  }

  async getModule(name: string): Promise<Module | null> {
    // TODO: https://github.com/manyuanrong/deno_mongo/issues/76
    // deno-lint-ignore no-explicit-any
    const entry = await this._modules.findOne({ _id: name.toString() } as any);
    if (entry === null) return null;
    return this._entryToModule(entry);
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
        created_at: module.created_at ?? new Date(),
      },
      { upsert: true },
    );
  }

  async listModules(
    limit: number,
    page: number,
    query?: string,
  ): Promise<ScoredModule[]> {
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
    ])) as ScoredModule[];

    return docs;
  }

  async listAllModules(): Promise<Module[]> {
    const entries = await this._modules.find({});
    return entries.map(this._entryToModule);
  }

  async listAllModuleNames(): Promise<string[]> {
    const results = await this._modules.aggregate([
      {
        $match: {
          is_unlisted: { $not: { $eq: true } },
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ]) as { _id: string }[];
    return results.map((o) => o._id);
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

  async countAllVersions(): Promise<number> {
    return this._builds.count({});
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

  async listRecentlyAddedModules(): Promise<RecentlyAddedModuleResult[]> {
    const results = await this._modules.aggregate([
      {
        $match: {
          is_unlisted: { $not: { $eq: true } },
        },
      },
      {
        $sort: {
          created_at: -1,
        },
      },
      {
        $limit: 10,
      },
    ]) as DBModule[];
    return results.map((doc) => ({
      name: doc._id,
      description: doc.description,
      star_count: doc.star_count,
      created_at: doc.created_at,
    }));
  }

  async listRecentlyUploadedVersions(): Promise<
    RecentlyAddedUploadedVersions[]
  > {
    const results = await this._builds.aggregate([
      {
        $sort: {
          created_at: -1,
        },
      },
      {
        $limit: 10,
      },
    ]) as Build[];
    return results.map((doc) => ({
      name: doc.options.moduleName,
      version: doc.options.version,
      created_at: doc.created_at,
    }));
  }
}
