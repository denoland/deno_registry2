# API

## POST /webhook/gh/:module

This API endpoint receives webhooks from GitHub. The `module` parameter in the
URL is the name of the module. Both `application/json` and
`application/x-www-url-formencoded` content types are accepted.

### Request

The contents and headers should be a GitHub `create` or `push` webhook event.
More information: https://developer.github.com/webhooks/event-payloads/#create
and https://developer.github.com/webhooks/event-payloads/#push

There are optional query parameters that can change the behavior of the request:

- `subdir`: this specifies a subdirectory of the repository to upload (not set
  by default). This directory must be in the format `std/` (notice the trailing
  slash.)
- `version_prefix`: only upload versions that match this prefix. When this is
  set to `std/` and you tag version `std/0.63.0`, version `0.63.0` will be
  uploaded.

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

OR

```json
{
  "success": false,
  "error": "module name is registered to a different repository"
}
```

##### 409 Conflict

```json
{
  "success": false,
  "error": "module name is registered to a different repository"
}
```

## Other endpoints

For any other endpoints, please reference the
[documentation for apiland.deno.dev](https://redocly.github.io/redoc/?url=https://apiland.deno.dev/~/spec)
