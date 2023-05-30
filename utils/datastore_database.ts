// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import {
  Datastore,
  datastoreValueToValue,
  entityToObject,
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

export interface NewBuild {
  id: string;
  module: string;
  version: string;
  status: BuildStatus;
  message?: string;
  created_at: Date;
  upload_options: {
    type: string;
    repository: string;
    ref: string;
    subdir?: string;
  };
}

export const kinds = {
  /** An object which contains information about the usage of built-in APIs. */
  LEGACY_MODULES: "legacy_modules",
  LEGACY_OWNER_QUOTAS: "legacy_owner_quotas",

  BUILD: "build",
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
    const query = this.db.createQuery(kinds.LEGACY_MODULES).order("created_at");
    return await this.db.query<Module>(query);
  }

  // tests only
  async countAllBuilds(): Promise<number> {
    const query = await this.db.runGqlAggregationQuery({
      queryString: `SELECT COUNT(*) FROM ${kinds.BUILD}`,
    });
    return datastoreValueToValue(
      query.batch.aggregationResults[0].aggregateProperties.property_1,
    ) as number;
  }

  async getBuild(id: string): Promise<NewBuild | null> {
    const result = await this.db.lookup(
      this.db.key([kinds.BUILD, id]),
    );

    if (result.found && result.found.length) {
      return entityToObject<NewBuild>(result.found[0].entity);
    } else {
      return null;
    }
  }

  async createBuild(build: Omit<NewBuild, "id">): Promise<string> {
    const id = crypto.randomUUID();
    // @ts-ignore temporary solution
    build.id = id;

    objectSetKey(build, this.db.key([kinds.BUILD, id]));

    for await (
      const _ of this.db.commit([{ upsert: objectToEntity(build) }], {
        transactional: false,
      })
    ) {
      // empty
    }

    return id;
  }

  async saveBuild(build: NewBuild) {
    objectSetKey(build, this.db.key([kinds.BUILD, build.id]));

    for await (
      const _ of this.db.commit([{ upsert: objectToEntity(build) }], {
        transactional: false,
      })
    ) {
      // empty
    }
  }
}
