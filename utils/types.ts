export interface DirectoryListingFile {
  path: string;
  size: number | undefined;
  type: "dir" | "file";
}

export interface VersionInfo {
  latest: string;
  versions: string[];
}
