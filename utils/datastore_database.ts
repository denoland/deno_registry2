// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import {
  Datastore,
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

export const kinds = {
  /** An object which contains information about the usage of built-in APIs. */
  LEGACY_OWNER_QUOTAS: "legacy_owner_quotas",
};

const ssm = new SSM({
  region: Deno.env.get("AWS_REGION")!,
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  sessionToken: Deno.env.get("AWS_SESSION_TOKEN")!,
  endpointURL: Deno.env.get("SSM_ENDPOINT_URL")!,
});

const googlePrivateKeySecret = await ssm.getParameter({
  Name: Deno.env.get("GOOGLE_PRIVATE_KEY_SSM") ?? "",
  WithDecryption: true,
});
const GOOGLE_PRIVATE_KEY = googlePrivateKeySecret?.Parameter?.Value;

const googleClientEmailSecret = await ssm.getParameter({
  Name: Deno.env.get("GOOGLE_CLIENT_EMAIL_SSM") ?? "",
  WithDecryption: true,
});
const GOOGLE_CLIENT_EMAIL = googleClientEmailSecret?.Parameter?.Value;

const googlePrivateKeyIdSecret = await ssm.getParameter({
  Name: Deno.env.get("GOOGLE_PRIVATE_KEY_ID_SSM") ?? "",
  WithDecryption: true,
});
const GOOGLE_PRIVATE_KEY_ID = googlePrivateKeyIdSecret?.Parameter?.Value;

const googleProjectIdSecret = await ssm.getParameter({
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
}
