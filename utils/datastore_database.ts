// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import {
  Datastore,
  entityToObject,
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

export const kinds = {
  /** An object which contains information about the usage of built-in APIs. */
  LEGACY_OWNER_QUOTAS: "legacy_owner_quotas",
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

  async deleteOwnerQuota(owner: string) {
    const key = this.db.key([kinds.LEGACY_OWNER_QUOTAS, owner]);

    for await (
      const _ of this.db.commit([{ delete: key }], {
        transactional: false,
      })
    ) {
      // empty
    }
  }
}
