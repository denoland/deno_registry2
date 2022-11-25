// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import type {
  APIGatewayProxyEventV2,
  Context,
  S3Bucket,
  ScheduledEvent,
  SQSEvent,
} from "../deps.ts";
import { assert } from "../test_deps.ts";
import type { Database } from "./database.ts";
interface KV {
  [key: string]: string;
}
import { Database as Datastore } from "./datastore_database.ts";


export function createApiLandMock() {
  const { port } = new URL(Deno.env.get("APILAND_URL")!);
  const authToken = Deno.env.get("APILAND_AUTH_TOKEN");

  const listener = Deno.listen({ port: parseInt(port, 10) });

  (async () => {
    const conn = await listener.accept();
    const httpConn = Deno.serveHttp(conn);
    const requestEvent = await httpConn.nextRequest();
    if (requestEvent) {
      const { request, respondWith } = requestEvent;
      try {
        assert(request.method === "POST");
        assert(request.headers.get("content-type") === "application/json");
        const body = await request.json();
        assert(
          request.headers.get("authorization")?.toLowerCase() ===
            `bearer ${authToken}`,
        );
        assert(body.event === "create");
        assert(typeof body.module === "string");
        assert(typeof body.version === "string");
        await respondWith(
          new Response(
            JSON.stringify({
              "result": "enqueued",
              "id": 1,
            }),
            { headers: { "content-type": "application/json" } },
          ),
        );
      } catch (e) {
        if (e instanceof Error) {
          await respondWith(
            new Response(`${e.message}\n${e.stack}`, { status: 401 }),
          );
        } else {
          await respondWith(new Response("ooops!", { status: 401 }));
        }
      }
    }
    httpConn.close();
    try {
      conn.close();
    } catch {
      // just swallow
    }
    try {
      listener.close();
    } catch {
      // just swallow
    }
  })();
}

export function createAPIGatewayProxyEventV2(
  method: string,
  rawPath: string,
  { data, headers, pathParameters, queryStringParameters, isBase64Encoded }: {
    data?: unknown;
    headers?: KV;
    pathParameters?: KV;
    queryStringParameters?: KV;
    isBase64Encoded?: boolean;
  },
): APIGatewayProxyEventV2 {
  const queryString = new URLSearchParams(queryStringParameters).toString();
  return {
    version: "2",
    routeKey: "",
    headers: headers ?? {},
    body: data
      ? (typeof data === "string" ? data : JSON.stringify(data))
      : undefined,
    isBase64Encoded: isBase64Encoded ?? false,
    rawPath: rawPath,
    rawQueryString: queryString,
    requestContext: {
      accountId: "",
      apiId: "",
      domainName: "api.deno.land",
      domainPrefix: "",
      http: {
        method,
        path: rawPath + (queryString ? "?" + queryString : ""),
        protocol: "http",
        sourceIp: "192.30.252.10",
        userAgent: (headers ? headers["User-Agent"] : undefined) ??
          "Deno/1.2.2",
      },
      routeKey: "",
      requestId: "xyztest",
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: new Date().getTime(),
    },
    pathParameters,
    queryStringParameters,
  };
}

export function createJSONWebhookEvent(
  event: string,
  path: string,
  payload: unknown,
  pathParameters: KV,
  queryStringParameters: KV,
): APIGatewayProxyEventV2 {
  return createAPIGatewayProxyEventV2("POST", path, {
    headers: {
      "Accept": "*/*",
      "content-type": "application/json",
      "User-Agent": "GitHub-Hookshot/f1aa6e4",
      "X-GitHub-Delivery": "01b06e5c-d65c-11ea-9409-7e8b4a054eac",
      "X-GitHub-Event": event,
    },
    data: payload,
    pathParameters,
    queryStringParameters,
  });
}

export function createSQSEvent(body: unknown): SQSEvent {
  return {
    Records: [
      {
        messageId: "01b06e5c-d65c-11ea-9409-7e8b4a054eac",
        body: JSON.stringify(body),
        attributes: {
          ApproximateFirstReceiveTimestamp: new Date().toISOString(),
          ApproximateReceiveCount: "1",
          SenderId: "",
          SentTimestamp: new Date().toISOString(),
        },
        awsRegion: "us-east-1",
        eventSource: "",
        eventSourceARN: "",
        md5OfBody: "",
        messageAttributes: {},
        receiptHandle: "",
      },
    ],
  };
}

export function createScheduledEvent(): ScheduledEvent {
  return {
    id: "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
    version: "1",
    "detail-type": "Scheduled Event",
    source: "aws.events",
    account: "123456789012",
    time: "1970-01-01T00:00:00Z",
    region: "ca-central-1",
    resources: [
      "arn:aws:events:ca-central-1:123456789012:rule/ExampleRule",
    ],
    detail: {},
  };
}

export function createJSONWebhookWebFormEvent(
  event: string,
  path: string,
  payload: unknown,
  pathParameters: KV,
  queryStringParameters: KV,
): APIGatewayProxyEventV2 {
  return createAPIGatewayProxyEventV2("POST", path, {
    headers: {
      "Accept": "*/*",
      "content-type": "application/x-www-form-urlencoded",
      "User-Agent": "GitHub-Hookshot/f1aa6e4",
      "X-GitHub-Delivery": "01b06e5c-d65c-11ea-9409-7e8b4a054eac",
      "X-GitHub-Event": event,
    },
    data: payload,
    pathParameters,
    queryStringParameters,
    isBase64Encoded: true,
  });
}

export function createContext(): Context {
  return {
    awsRequestId: "",
    callbackWaitsForEmptyEventLoop: false,
    functionName: "",
    functionVersion: "",
    invokedFunctionArn: "",
    logGroupName: "",
    logStreamName: "",
    memoryLimitInMB: "",
    done() {},
    fail() {},
    getRemainingTimeInMillis: () => 0,
    succeed() {},
  };
}

export async function cleanupDatabase(db: Database, datastore: Datastore): Promise<void> {
  await Promise.all([
    db._builds.deleteMany({}),
    db._modules.deleteMany({}),
    datastore.deleteOwnerQuota("luca-rand"),
  ]);
}

export async function cleanupStorage(
  s: S3Bucket,
  ...objects: string[]
): Promise<void> {
  const p = [];
  for (const object of objects) {
    p.push(s.deleteObject(object));
  }
  await Promise.all(p);
}
