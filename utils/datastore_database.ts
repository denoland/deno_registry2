// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import {
  Datastore,
  datastoreValueToValue,
  entityToObject,
  objectGetKey,
  objectSetKey,
  objectToEntity,
  SSM,
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
  LEGACY_MODULES: "legacy_modules",
  LEGACY_OWNER_QUOTAS: "legacy_owner_quotas",
  LEGACY_BUILDS: "legacy_builds",
};

let ssm;
try {
  ssm = new SSM({
    region: Deno.env.get("AWS_REGION")!,
    accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    sessionToken: Deno.env.get("AWS_SESSION_TOKEN")!,
    endpointURL: Deno.env.get("SSM_ENDPOINT_URL")!,
  });
} catch {
  //
}

const googlePrivateKeySecret = await ssm?.getParameter({
  Name: Deno.env.get("GOOGLE_PRIVATE_KEY_SSM") ?? "",
  WithDecryption: true,
});
const GOOGLE_PRIVATE_KEY = googlePrivateKeySecret?.Parameter?.Value;

const googleClientEmailSecret = await ssm?.getParameter({
  Name: Deno.env.get("GOOGLE_CLIENT_EMAIL_SSM") ?? "",
  WithDecryption: true,
});
const GOOGLE_CLIENT_EMAIL = googleClientEmailSecret?.Parameter?.Value;

const googlePrivateKeyIdSecret = await ssm?.getParameter({
  Name: Deno.env.get("GOOGLE_PRIVATE_KEY_ID_SSM") ?? "",
  WithDecryption: true,
});
const GOOGLE_PRIVATE_KEY_ID = googlePrivateKeyIdSecret?.Parameter?.Value;

const googleProjectIdSecret = await ssm?.getParameter({
  Name: Deno.env.get("GOOGLE_PROJECT_ID_SSM") ?? "",
  WithDecryption: true,
});
const GOOGLE_PROJECT_ID = googleProjectIdSecret?.Parameter?.Value;

export class Database {
  db: Datastore;

  constructor() {
    const privateKey = GOOGLE_PRIVATE_KEY ??
      Deno.env.get("GOOGLE_PRIVATE_KEY") ?? "";
    const keys = {
      client_email: GOOGLE_CLIENT_EMAIL ??
        Deno.env.get("GOOGLE_CLIENT_EMAIL") ?? "",
      private_key:
        (privateKey.startsWith(`"`)
          ? JSON.parse(privateKey)
          : privateKey) as string,
      private_key_id: GOOGLE_PRIVATE_KEY_ID ??
        Deno.env.get("GOOGLE_PRIVATE_KEY_ID") ?? "",
      project_id: GOOGLE_PROJECT_ID ?? Deno.env.get("GOOGLE_PROJECT_ID") ?? "",
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

  async getModule(name: string): Promise<Module | null> {
    const result = await this.db.lookup(
      this.db.key([kinds.LEGACY_MODULES, name]),
    );

    if (result.found && result.found.length) {
      return entityToObject<Module>(result.found[0].entity);
    } else {
      return null;
    }
  }

  async saveModule(module: Module): Promise<void> {
    const key = this.db.key([kinds.LEGACY_MODULES, module.name]);
    objectSetKey(module, key);

    for await (
      const _ of this.db.commit([{ upsert: objectToEntity(module) }], {
        transactional: false,
      })
    ) {
      // empty
    }
  }

  async listAllModules(): Promise<Module[]> {
    const query = this.db.createQuery(kinds.LEGACY_MODULES).order(
      "created_at",
      true,
    );
    return await this.db.query<Module>(query);
  }

  async listAllModuleNames(): Promise<string[]> {
    const query = this.db.createQuery(kinds.LEGACY_MODULES).select("name")
      .filter("is_unlisted", true); // TODO
    const modules = await this.db.query<{ name: string }>(query);
    return modules.map((module) => module.name);
  }

  async countModules(): Promise<number> {
    const query = await this.db.runGqlAggregationQuery({
      queryString: `SELECT COUNT(*) FROM ${kinds.LEGACY_MODULES}`,
    });
    return datastoreValueToValue(
      query.batch.aggregationResults[0].aggregateProperties.property_1,
    ) as number;
  }

  async countModulesForRepository(repoId: number): Promise<number> {
    const query = await this.db.runGqlAggregationQuery({
      queryString:
        `SELECT COUNT(*) FROM ${kinds.LEGACY_MODULES} WHERE repo_id = ${repoId}`,
      allowLiterals: true,
    });
    return datastoreValueToValue(
      query.batch.aggregationResults[0].aggregateProperties.property_1,
    ) as number;
  }

  async countModulesForOwner(owner: string): Promise<number> {
    const query = await this.db.runGqlAggregationQuery({
      queryString:
        `SELECT COUNT(*) FROM ${kinds.LEGACY_MODULES} WHERE owner = '${owner}'`,
      allowLiterals: true,
    });
    return datastoreValueToValue(
      query.batch.aggregationResults[0].aggregateProperties.property_1,
    ) as number;
  }

  async deleteModule(name: string): Promise<void> {
    const key = this.db.key([kinds.LEGACY_MODULES, name]);

    for await (
      const _ of this.db.commit([{ delete: key }], {
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
    const query = this.db.createQuery(kinds.LEGACY_BUILDS).order(
      "created_at",
      true,
    );
    const builds = await this.db.query<Build>(query);
    for (const build of builds) {
      build.id = objectGetKey(build)!.path[0].name!;
    }
    return builds;
  }

  async getBuild(id: string): Promise<Build | null> {
    const result = await this.db.lookup(
      this.db.key([kinds.LEGACY_BUILDS, id]),
    );

    if (result.found && result.found.length) {
      const obj = entityToObject<Build>(result.found[0].entity);
      obj.id = objectGetKey(obj)!.path[0].name!;
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
    builds[0].id = objectGetKey(builds[0])!.path[0].name!;
    return builds[0];
  }

  async listSuccessfulBuilds(name: string): Promise<Build[]> {
    const query = this.db
      .createQuery(kinds.LEGACY_BUILDS)
      .filter("options.moduleName", name)
      .filter("status", "success")
      .order("created_at", true);

    const builds = await this.db.query<Build>(query);
    for (const build of builds) {
      build.id = objectGetKey(build)!.path[0].name!;
    }
    return builds;
  }

  async createBuild(build: Omit<Build, "id">): Promise<string> {
    const id = crypto.randomUUID();
    const key = this.db.key([kinds.LEGACY_BUILDS, id]);
    objectSetKey(build, key);

    for await (
      const _ of this.db.commit([{ upsert: objectToEntity(build) }], {
        transactional: false,
      })
    ) {
      // empty
    }

    return id;
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
