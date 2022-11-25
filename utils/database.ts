// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import { Bson, MongoClient, MongoCollection, MongoDatabase } from "../deps.ts";

export type DBModule = Omit<Module, "name"> & { _id: string };
export type ScoredModule = DBModule & { search_score: number };

export interface Module {
  name: string;
  type: string;
  // deno-lint-ignore camelcase
  repo_id: number;
  owner: string;
  repo: string;
  description: string;
  // deno-lint-ignore camelcase
  star_count: number;
  // deno-lint-ignore camelcase
  is_unlisted: boolean;
  // deno-lint-ignore camelcase
  created_at: Date;
}

export interface SearchOptions {
  limit: number;
  page: number;
  query?: string;
  sort?: Sort | "random" | "search_order";
}

export type ListModuleResult = [SearchOptions, ScoredModule[]];

export type Sort = "stars" | "newest" | "oldest";

export type BuildStatus =
  | "queued"
  | "success"
  | "error"
  | "publishing"
  | "analyzing_dependencies";

const sort = {
  stars: { "star_count": -1 },
  newest: { "created_at": -1 },
  oldest: { "created_at": 1 },
  random: null,
  // deno-lint-ignore camelcase
  search_order: null,
};

export const SortValues = Object.keys(sort);

export interface SearchResult {
  name: string;
  description: string;
  // deno-lint-ignore camelcase
  star_count: number;
  // deno-lint-ignore camelcase
  search_score: number;
}

export interface RecentlyAddedModuleResult {
  name: string;
  description: string;
  // deno-lint-ignore camelcase
  star_count: number;
  // deno-lint-ignore camelcase
  created_at: Date;
}

export interface RecentlyAddedUploadedVersions {
  name: string;
  version: string;
  // deno-lint-ignore camelcase
  created_at: Date;
}

export interface Build {
  id: string;
  // deno-lint-ignore camelcase
  created_at: Date;
  options: {
    moduleName: string;
    type: string;
    repository: string;
    ref: string;
    version: string;
    subdir?: string;
  };
  status: BuildStatus;
  message?: string;
  stats?: BuildStats;
}

export interface BuildStats {
  // deno-lint-ignore camelcase
  total_files: number;
  // deno-lint-ignore camelcase
  total_size: number;
}

export class Database {
  protected db: MongoDatabase;
  _modules: MongoCollection<DBModule>;
  _builds: MongoCollection<Omit<Build, "id"> & { _id: Bson.ObjectId }>;

  constructor(db: MongoDatabase) {
    this.db = db;
    this._modules = db.collection<DBModule>("modules");
    this._builds = db.collection<Omit<Build, "id"> & { _id: Bson.ObjectId }>(
      "builds",
    );
  }

  static async connect(mongoUri: string): Promise<Database> {
    const mongo = new MongoClient();
    const db = await mongo.connect(mongoUri);
    return new Database(db);
  }

  _entryToModule(entry: DBModule): Module {
    return {
      name: entry._id,
      type: entry.type,
      repo_id: entry.repo_id,
      owner: entry.owner,
      repo: entry.repo,
      description: entry.description,
      star_count: entry.star_count,
      is_unlisted: entry.is_unlisted ?? false,
      created_at: entry.created_at,
    };
  }

  async getModule(name: string): Promise<Module | null> {
    const entry = await this._modules.findOne({ _id: name.toString() });
    if (entry === undefined) return null;
    return this._entryToModule(entry);
  }

  async saveModule(module: Module): Promise<void> {
    await this._modules.updateOne(
      { _id: module.name },
      {
        $set: {
          _id: module.name,
          type: module.type,
          repo_id: module.repo_id,
          owner: module.owner,
          repo: module.repo,
          description: module.description,
          star_count: module.star_count,
          is_unlisted: module.is_unlisted,
          created_at: module.created_at ?? new Date(),
        },
      },
      { upsert: true },
    );
  }

  async listModules(options: SearchOptions): Promise<ListModuleResult> {
    if (typeof options.limit !== "number") {
      throw new Error("limit must be a number");
    }
    if (typeof options.page !== "number") {
      throw new Error("page must be a number");
    }
    if (options.page <= 0) {
      throw new Error("page must be 1 or larger");
    }
    if (options.sort === undefined) {
      options.sort = "stars";
    }

    // The random sort option is not compatible with the 'search' and 'page'
    // options.
    if (options.sort === "random") {
      options.page = 1;
      options.query = undefined;
      const modules = await this._modules.aggregate([
        {
          $match: {
            is_unlisted: { $not: { $eq: true } },
          },
        },
        {
          $sample: {
            size: options.limit,
          },
        },
      ]).toArray() as ScoredModule[];
      return [
        options,
        modules,
      ];
    }

    // If search is present, add a search step to the aggregation pipeline
    let searchAggregation;
    if (options.query) {
      options.sort = "search_order";
      searchAggregation = [
        {
          $search: {
            text: {
              query: options.query,
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
      ];
    } else {
      searchAggregation = [
        {
          $match: {
            is_unlisted: { $not: { $eq: true } },
          },
        },
        {
          $sort: sort[options.sort],
        },
      ];
    }

    //  Query the database
    const docs = (await this._modules.aggregate([
      ...searchAggregation,
      {
        $skip: (options.page - 1) * options.limit,
      },
      {
        $limit: options.limit,
      },
    ]).toArray()) as ScoredModule[];

    return [options, docs];
  }

  async listAllModules(): Promise<Module[]> {
    const entries = this._modules.find({});
    return await entries.map(this._entryToModule);
  }

  async listAllModuleNames(): Promise<string[]> {
    return await this._modules.aggregate<{ _id: string }>([
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
    ]).map((o) => o._id);
  }

  countModules(): Promise<number> {
    return this._modules.countDocuments({
      is_unlisted: { $not: { $eq: true } },
    });
  }

  async countModulesForRepository(
    repoId: number,
  ): Promise<number> {
    return await this._modules.countDocuments({ repo_id: repoId });
  }

  async countModulesForOwner(owner: string): Promise<number> {
    return await this._modules.countDocuments({ owner });
  }

  async deleteModule(name: string): Promise<void> {
    const resp = await this._modules.deleteOne({ _id: name });

    if (!resp) {
      throw new Error(`Failed to delete module [ ${name} ]`);
    }
    return;
  }

  async getBuild(id: string): Promise<Build | null> {
    const build = await this._builds.findOne({ _id: new Bson.ObjectId(id) });
    if (build === undefined) return null;
    return {
      id: build._id.toHexString(),
      created_at: build.created_at,
      options: build.options,
      status: build.status,
      message: build.message,
      stats: build.stats,
    };
  }

  async listSuccessfulBuilds(name: string): Promise<Build[]> {
    const cursor = this._builds.aggregate<Build & { _id: Bson.ObjectId }>([
      {
        $match: {
          "options.moduleName": { $eq: name },
          status: { $eq: "success" as BuildStatus },
        },
      },
    ]);
    return await cursor.map((b) => {
      return {
        id: b._id.toHexString(),
        created_at: b.created_at,
        options: b.options,
        status: b.status,
        message: b.message,
        stats: b.stats,
      };
    });
  }

  async getBuildForVersion(
    name: string,
    version: string,
  ): Promise<Build | null> {
    const build = await this._builds.findOne({
      "options.moduleName": name,
      "options.version": version,
    });
    if (build === undefined) return null;
    return {
      id: build._id.toHexString(),
      created_at: build.created_at,
      options: build.options,
      status: build.status,
      message: build.message,
      stats: build.stats,
    };
  }

  countAllVersions(): Promise<number> {
    return this._builds.countDocuments({});
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
    return id.toHexString();
  }

  async saveBuild(build: Build): Promise<void> {
    await this._builds.updateOne(
      {
        _id: new Bson.ObjectId(build.id),
      },
      {
        $set: {
          _id: new Bson.ObjectId(build.id),
          created_at: build.created_at,
          options: build.options,
          status: build.status,
          message: build.message,
          stats: build.stats,
        },
      },
      { upsert: true },
    );
  }

  async listRecentlyAddedModules(): Promise<RecentlyAddedModuleResult[]> {
    const cursor = this._modules.aggregate<DBModule>([
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
    ]);
    return await cursor.map((doc) => ({
      name: doc._id,
      description: doc.description,
      star_count: doc.star_count,
      created_at: doc.created_at,
    }));
  }

  async listRecentlyUploadedVersions(): Promise<
    RecentlyAddedUploadedVersions[]
  > {
    const cursor = this._builds.aggregate<Build>([
      {
        $sort: {
          created_at: -1,
        },
      },
      {
        $limit: 10,
      },
    ]);
    return await cursor.map((doc) => ({
      name: doc.options.moduleName,
      version: doc.options.version,
      created_at: doc.created_at,
    }));
  }
}
