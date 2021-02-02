import { Module } from "./database.ts";

export interface SearchModule {
  objectID: string;
  name: string;
  description: string;
  owner: string;
  repo: string;
  starCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class AlgoliaError extends Error {
  readonly name = "AlgoliaError";

  status: number;

  constructor(message: string, status: number) {
    super(`${message} (status code ${status})`);
    this.status = status;
  }
}

export class AlgoliaAPI {
  #applicationId: string;
  #apiKey: string;

  constructor(applicationId: string, apiKey: string) {
    this.#applicationId = applicationId;
    this.#apiKey = apiKey;
  }

  fetch = async (
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> => {
    const url = new URL(path, `https://${this.#applicationId}.algolia.net`);

    const res = await fetch(url, {
      headers: {
        "X-Algolia-Application-Id": this.#applicationId,
        "X-Algolia-API-Key": this.#apiKey,
        ...(body ? { "content-type": "application/json; charset=UTF-8" } : {}),
      },
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      if (res.headers.get("content-type")?.startsWith("application/json")) {
        const { message } = await res.json();
        throw new AlgoliaError(message, res.status);
      } else {
        const message = await res.text();
        throw new AlgoliaError(message, res.status);
      }
    }

    return await res.json();
  };

  async saveDatabaseModule(module: Module): Promise<void> {
    if (!module.is_unlisted) {
      await this.fetch("PUT", `/1/indexes/modules/${module.name}`, {
        objectID: module.name,
        name: module.name,
        description: module.description,
        owner: module.owner,
        repo: module.repo,
        starCount: module.star_count,
        createdAt: module.created_at,
        updatedAt: new Date(),
      });
    }
  }

  async saveModules(modules: SearchModule[]): Promise<void> {
    const requests = modules.map((module) => ({
      action: "updateObject",
      body: module,
    }));
    await this.fetch("POST", `/1/indexes/modules/batch`, { requests });
  }
}
