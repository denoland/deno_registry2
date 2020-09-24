import type { ScheduledEvent } from "https://deno.land/x/lambda@1.4.1/types.d.ts";
import type { APIGatewayProxyEventV2, SQSEvent, Context } from "../deps.ts";
interface KV {
  [key: string]: string;
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
