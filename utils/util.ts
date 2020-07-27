// From https://github.com/rxaviers/async-pool/blob/master/lib/es7.js.
// Copyright (c) 2017 Rafael Xavier de Souza http://rafael.xavier.blog.br
// Licensed under MIT

export async function asyncPool<T, R>(
  poolLimit: number,
  array: T[],
  iteratorFn: (data: T, array: T[]) => Promise<R>,
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<unknown>[] = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);
    const e: Promise<unknown> = p.then(() =>
      executing.splice(executing.indexOf(e), 1)
    );
    executing.push(e);
    if (executing.length >= poolLimit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}
