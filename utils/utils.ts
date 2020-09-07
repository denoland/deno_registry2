async function collectAsyncIterable<T>(
  iterator: AsyncIterable<T>,
): Promise<T[]> {
  const collected = [] as T[];
  for await (const v of iterator) {
    collected.push(v);
  }
  return collected;
}
