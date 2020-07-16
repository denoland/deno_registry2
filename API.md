# API

## POST /webhook/gh/:module

This API endpoint recieves webhooks from GitHub. The `module` parameter in the URL is the name of the module.

### Request

The contents and headers should be a GitHub `create` webhook event. More information: https://developer.github.com/webhooks/event-payloads/#create

There are some query parameters that change the request:

- `subdir`: this specifies a subdirectory of the repository to upload (not set by default). This directory must be in the format `std/`.
- `version_prefix`: only upload versions that match this prefix. When this is set to `std/` and you tag version `std/0.61.0`, version `0.61.0` will be uploaded.

### Response

#### Headers

`content-type`: `application/json`

#### Body

##### 200 OK

```json
{
  "success": true,
  "data": {
    "module": "oak",
    "version": "v5.3.1",
    "repository": "oakserver/oak",
    "total_bytes_uploaded": 364546,
    "skipped_due_to_size": ["/fixtures/test.jpg", "/examples/static/50MB.zip"]
  }
}
```

##### 400 Bad Request

```json
{
  "success": false,
  "info": "module name is not valid"
}
```

## GET /modules

This API endpoint can be used to get a list of all the modules in the registry.

### Request

There are some query parameters that change the request:

- `limit` is the amount of results to display per page of the response (default 20)
- `page` is the page to display (default 1)
- `query` is a query to use for filtering the list (not set by default)

### Response

#### Headers

`content-type`: `application/json`

#### Body

##### 200 OK

```json
{
  "success": true,
  "data": {
    "total_count": 763,
    "results": [
      {
        "name": "oak",
        "description": "A middleware framework for Deno's http server, including a router middleware.",
        "star_count": 400
      },
      {
        "name": "oak_middleware",
        "description": "A collection of middleware for the oak middleware framework.",
        "star_count": 30
      }
    ]
  }
}
```

##### 400 Bad Request

```json
{
  "success": false,
  "info": "internal server error"
}
```
