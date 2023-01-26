// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import { MongoClient, MongoCollection, MongoDatabase } from "../deps.ts";

export type DBModule = Omit<Module, "name"> & { _id: string };

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

export class Database {
  protected db: MongoDatabase;
  _modules: MongoCollection<DBModule>;

  constructor(db: MongoDatabase) {
    this.db = db;
    this._modules = db.collection<DBModule>("modules");
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

  async listAllModules(): Promise<Module[]> {
    const entries = this._modules.find({});
    return await entries.map(this._entryToModule);
  }
}
