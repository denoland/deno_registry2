// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
export function isForbidden(
  moduleName: string,
  badwords: Array<string>,
): boolean {
  for (const word of badwords) {
    const e = new RegExp(`(^|_)(${word})($|_)`);
    if (e.test(moduleName)) return true;
  }
  return false;
}
