export function isForbidden(
  moduleName: string,
  badwords: Array<string>,
): Boolean {
  for (let w of badwords) {
    const e = new RegExp(`(^|_)(${w})($|_)`);
    if (e.test(moduleName)) return true;
  }
  return false;
}