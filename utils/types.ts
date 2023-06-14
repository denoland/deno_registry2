// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

export type APIResponseBase = {
  success: boolean;
};

export type APIErrorResponse = APIResponseBase & { error: string };

export interface DirectoryListingFile {
  path: string;
  size: number | undefined;
  type: "dir" | "file";
}
