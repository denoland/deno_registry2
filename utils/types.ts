// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import { NewBuild } from "./datastore_database.ts";

export type APIResponseBase = {
  success: boolean;
};

export type APIErrorResponse = APIResponseBase & { error: string };
export type APIInfoResponse = APIResponseBase & { info: string };

export type APIWebhookResponseSuccess = APIResponseBase & {
  data: {
    module: string;
    repository: string;
    version?: string;
    status_url?: string;
  };
};

export type APIBuildGetResponseSuccess = APIResponseBase & {
  data: {
    build: NewBuild;
  };
};

export interface DirectoryListingFile {
  path: string;
  size: number | undefined;
  type: "dir" | "file";
}

export interface VersionInfo {
  latest: string;
  versions: string[];
}
