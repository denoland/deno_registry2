// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
const base = "https://api.github.com";

export interface GitHubAuth {
  username: string;
  token: string;
}

export type RateLimit = {
  rateLimit: number | undefined;
  rateRemaining: number | undefined;
  rateLimitReset: Date | undefined;
};

export class GitHub {
  private auth: GitHubAuth | undefined;
  private rateLimit: number | undefined;
  private rateRemaining: number | undefined;
  private rateLimitReset: Date | undefined;

  constructor(auth?: GitHubAuth) {
    if (auth) {
      this.auth = auth;
    } else {
      console.warn(
        "no credentials provided, fetching from GitHub as an anonymous user",
      );
    }
  }

  private _auth(r: Request): Request {
    const req = new Request(r);
    if (this.auth) {
      req.headers.set("Authorization", `Bearer ${this.auth.token}`);
    }
    return req;
  }

  private async _doRequest(r: Request): Promise<Response> {
    while (this.rateRemaining === 0) {
      console.log("rate limit reached, waiting before proceeding.");
      setTimeout(
        async () => {
          let req = new Request(`${base}/rate_limit`);
          req = this._auth(req);
          const res = await fetch(req);
          this._updateRateLimit(res.headers);
        },
        new Date().getTime() -
          (this.rateLimitReset?.getTime() ?? new Date().getTime() + 100),
      );
    }

    r = this._auth(r);
    const res = await fetch(r);
    this._updateRateLimit(res.headers);

    return res;
  }

  private _updateRateLimit(h: Headers): void {
    if (h.has("x-ratelimit-limit")) {
      this.rateLimit = parseInt(h.get("x-ratelimit-limit") as string);
    }
    if (h.has("x-ratelimit-remaining")) {
      this.rateRemaining = parseInt(h.get("x-ratelimit-remaining") as string);
    }
    if (h.has("x-ratelimit-reset")) {
      this.rateLimitReset = new Date(
        // as per the docs
        // https://developer.github.com/v3/#rate-limiting
        parseInt(h.get("x-ratelimit-reset") as string) * 1000,
      );
    }
  }

  getRepo(owner: string, repo: string): Promise<Response> {
    return this._doRequest(new Request(`${base}/repos/${owner}/${repo}`));
  }

  getRateLimits(): RateLimit {
    return {
      rateLimit: this.rateLimit,
      rateRemaining: this.rateRemaining,
      rateLimitReset: this.rateLimitReset,
    };
  }
}
