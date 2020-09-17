const base = "https://api.github.com";

export type Token = string | undefined;

export class GitHub {
  private token: Token;

  constructor(token: Token) {
    this.token = token;
  }

  async getRepo(owner: string, repo: string): Promise<Response> {
    const req = new Request(`${base}/repos/${owner}/${repo}`);
    if (this.token) {
      req.headers.set("Authorization", `Basic: ${this.token}`);
    }

    return fetch(req);
  }
}
