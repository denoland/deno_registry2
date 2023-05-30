// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import { Build } from "./datastore_database.ts";

export type APIResponseBase = {
  success: boolean;
};

export type APIErrorResponse = APIResponseBase & { error: string };

export type APIModuleGetResponse = APIResponseBase & {
  data: {
    name: string;
    description: string;
    star_count: number;
  };
};

export type APIBuildGetResponseSuccess = APIResponseBase & {
  data: {
    build: Build;
  };
};

export interface DirectoryListingFile {
  path: string;
  size: number | undefined;
  type: "dir" | "file";
}
