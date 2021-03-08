// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import type { DirectoryListingFile } from "./types.ts";

export async function collectAsyncIterable<T>(
  iterator: AsyncIterable<T>,
): Promise<T[]> {
  const collected = [] as T[];
  for await (const v of iterator) {
    collected.push(v);
  }
  return collected;
}

export function directorySize(d: DirectoryListingFile[]): number {
  if (d.length === 0) return 0;
  if (d.length === 1) return d[0].size ?? 0;

  // sort directory listings in place
  d.sort((a, b) => a.path.localeCompare(b.path));

  // put the root dir at the end to make sure the stack is fully emptied at the
  // end the loop
  d.push(d[0]);

  let totalSize = 0;
  const len = d.length;
  const stack: number[] = []; // stack of indexes of all entry of type 'dir'

  let curr = 0;
  for (let i = 1; i < len; i++) { // start at one to skip the root directory
    // current element is out of the curr directory, popping the stack
    //
    // special case for the root directory; since it's an empty string, it's
    // easier to simply check for it explicitely than compare the paths with
    // special conditions to handle "" as the root dir.
    while (curr != 0 && !d[i].path.startsWith(d[curr].path + "/")) {
      const s = d[curr].size ?? 0;
      curr = stack.pop() as number;
      d[curr].size = (d[curr].size ?? 0) + s;
    }

    if (d[i].type === "file") {
      totalSize += d[i].size ?? 0;
      d[curr].size = (d[curr].size ?? 0) + (d[i].size ?? 0);
    } else if (curr === 0 || d[i].path.startsWith(d[curr].path + "/")) {
      // see comment above for the special case of the root dir
      stack.push(curr);
      curr = i;
    }
  }

  // remove the duplicate root element introduced earlier
  d.pop();
  return totalSize;
}
