// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import {
  Build,
  RecentlyAddedModuleResult,
  RecentlyAddedUploadedVersions,
  SearchOptions,
  SearchResult,
} from "../utils/database.ts";

export type APIResponseBase = {
  success: boolean;
};

export type APIErrorResponse = APIResponseBase & { error: string };
export type APIInfoResponse = APIResponseBase & { info: string };

export type APIStatsResponse = APIResponseBase & {
  data: {
    total_count: number;
    total_versions: number;
    recently_added_modules: RecentlyAddedModuleResult[];
    recently_uploaded_versions: RecentlyAddedUploadedVersions[];
  };
};

export type APIWebhookResponse =
  | APIWebhookResponseSuccess
  | APIInfoResponse
  | APIErrorResponse;

export type APIWebhookResponseSuccess = APIResponseBase & {
  data: {
    module: string;
    repository: string;
    version?: string;
    status_url?: string;
  };
};

export type APIModuleGetResponse = APIResponseBase & {
  data: {
    name: string;
    description: string;
    star_count: number;
  };
};

export type APIModuleListShortResponse = string[];

export type APIModuleListResponse =
  | APIErrorResponse
  | APIModuleListResponseSuccess;

export type APIModuleListResponseSuccess = APIResponseBase & {
  data: {
    total_count: number;
    options: SearchOptions;
    results: SearchResult[];
  };
};

export type APIBuildGetResponse =
  | APIErrorResponse
  | APIBuildGetResponseSuccess;

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

export interface VersionInfo {
  latest: string;
  versions: string[];
}
