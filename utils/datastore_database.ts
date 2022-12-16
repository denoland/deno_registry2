// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import {
  type CommitResponse,
  Datastore,
  datastoreValueToValue,
  entityToObject,
  objectGetKey,
  objectSetKey,
  objectToEntity,
} from "../deps.ts";

export interface OwnerQuota {
  owner: string;
  type: string;
  // deno-lint-ignore camelcase
  max_modules: number;
  // deno-lint-ignore camelcase
  max_total_size?: number;
  blocked: boolean;
  note?: string;
}

export type BuildStatus =
  | "queued"
  | "success"
  | "error"
  | "publishing"
  | "analyzing_dependencies";

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
}

export const kinds = {
  /** An object which contains information about the usage of built-in APIs. */
  LEGACY_OWNER_QUOTAS: "legacy_owner_quotas",
  LEGACY_BUILDS: "legacy_builds",
};

export class Database {
  db: Datastore;

  constructor() {
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY") ?? "";
    const keys = {
      client_email: Deno.env.get("GOOGLE_CLIENT_EMAIL") ?? "",
      private_key:
        (privateKey.startsWith(`"`)
          ? JSON.parse(privateKey)
          : privateKey) as string,
      private_key_id: Deno.env.get("GOOGLE_PRIVATE_KEY_ID") ?? "",
      project_id: Deno.env.get("GOOGLE_PROJECT_ID") ?? "",
      datastore_host: Deno.env.get("DATASTORE_HOST"),
    };
    this.db = new Datastore(keys);
  }

  async getOwnerQuota(
    owner: string,
  ): Promise<OwnerQuota | null> {
    const result = await this.db.lookup(
      this.db.key([kinds.LEGACY_OWNER_QUOTAS, owner]),
    );

    if (result.found && result.found.length) {
      return entityToObject<OwnerQuota>(result.found[0].entity);
    } else {
      return null;
    }
  }

  async saveOwnerQuota(
    ownerQuota: OwnerQuota,
  ): Promise<void> {
    const key = this.db.key([kinds.LEGACY_OWNER_QUOTAS, ownerQuota.owner]);
    objectSetKey(ownerQuota, key);

    for await (
      const _ of this.db.commit([{ upsert: objectToEntity(ownerQuota) }], {
        transactional: false,
      })
    ) {
      // empty
    }
  }

  // tests only
  async countAllBuilds(): Promise<number> {
    const query = await this.db.runGqlAggregationQuery({
      queryString: `SELECT COUNT(*) FROM ${kinds.LEGACY_BUILDS}`,
    });
    return datastoreValueToValue(
      query.batch.aggregationResults[0].aggregateProperties.property_1,
    ) as number;
  }

  // tests only
  async listAllBuilds(): Promise<Build[]> {
    const query = this.db.createQuery(kinds.LEGACY_BUILDS);
    const builds = await this.db.query<Build>(query);
    for (const build of builds) {
      build.id = objectGetKey(build)!.path[0].id!;
    }
    return builds;
  }

  async getBuild(id: string): Promise<Build | null> {
    const result = await this.db.lookup(
      this.db.key([kinds.LEGACY_BUILDS, +id]),
    );

    if (result.found && result.found.length) {
      const obj = entityToObject<Build>(result.found[0].entity);
      obj.id = objectGetKey(obj)!.path[0].id!;
      return obj;
    } else {
      return null;
    }
  }

  async getBuildForVersion(
    name: string,
    version: string,
  ): Promise<Build | null> {
    const query = this.db
      .createQuery(kinds.LEGACY_BUILDS)
      .filter("options.moduleName", name)
      .filter("options.version", version);

    const builds = await this.db.query<Build>(query);
    if (builds.length === 0) return null;
    builds[0].id = objectGetKey(builds[0])!.path[0].id!;
    return builds[0];
  }

  async listSuccessfulBuilds(name: string): Promise<Build[]> {
    const query = this.db
      .createQuery(kinds.LEGACY_BUILDS)
      .filter("options.moduleName", name)
      .filter("status", "success");

    const builds = await this.db.query<Build>(query);
    for (const build of builds) {
      build.id = objectGetKey(build)!.path[0].id!;
    }
    return builds;
  }

  async createBuild(build: Omit<Build, "id">): Promise<string> {
    const key = this.db.key(kinds.LEGACY_BUILDS);
    objectSetKey(build, key);

    const commits = this.db.commit([{ insert: objectToEntity(build) }], {
      transactional: false,
    });
    const commit: CommitResponse = (await commits.next()).value;
    return commit.mutationResults[0].key!.path[0].id!;
  }

  async saveBuild(build: Build) {
    const key = this.db.key([kinds.LEGACY_BUILDS, build.id]);
    objectSetKey(build, key);

    for await (
      const _ of this.db.commit([{ upsert: objectToEntity(build) }], {
        transactional: false,
      })
    ) {
      // empty
    }
  }
}
