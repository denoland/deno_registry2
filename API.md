# API

## POST /webhook/gh/:module

This API endpoint recieves webhooks from GitHub. The `module` parameter in the URL is the name of the module. Both `application/json` and `application/x-www-url-formencoded` content types are accepted.

### Request

The contents and headers should be a GitHub `create` or `push` webhook event. More information: https://developer.github.com/webhooks/event-payloads/#create and https://developer.github.com/webhooks/event-payloads/#push

There are optional query parameters that can change the behavior of the request:

- `subdir`: this specifies a subdirectory of the repository to upload (not set by default). This directory must be in the format `std/` (notice the trailing slash.)
- `version_prefix_filter`: only upload versions that match this prefix. When this is set to `std/` and you tag version `std/0.63.0`, version `0.63.0` will be uploaded. You can a `keep_version_prefix=true` query parameter to retain the version prefix for publishing (`std/0.63.0` would be published as `std/0.63.0`).

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

## GET /modules

This API endpoint can be used to get a list of all the modules in the registry.

### Request

There are some query parameters that change the request:

- `limit` is the amount of results to display per page of the response (default 20)
- `page` is the page to display (default 1)
- `query` is a query to use for filtering the list (not set by default)
- `sort` orders the results in a specific order. The accepted values are `oldest`, `newest`, `stars` and `random`. If a query is present in the request, this parameter is ignored and defaults to the strongest match. The `random` option invalidates the `query` and a `page` parameters.
- `simple` toggles the result payload to a simpler output. Invalidates all other parameters.

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

##### 200 OK -- simple

```json
["amq","atenas","atenas_cli","auto_bind", ...]
```

##### 400 Bad Request

```json
{
  "success": false,
  "info": "internal server error"
}
```

## GET /modules/:name

This API endpoint can be used to get a specific module by name.

### Request

The `name` parameter in the URL is the name of the module.

### Response

#### Headers

`content-type`: `application/json`

#### Body

##### 200 OK

```json
{
  "success": true,
  "data": {
    "name": "oak",
    "description": "A middleware framework for Deno's http server, including a router middleware.",
    "star_count": 400
  }
}
```

##### 400 Bad Request

```json
{
  "success": false,
  "error": "no module name specified"
}
```

##### 404 Not Found

```json
{
  "success": false,
  "error": "module not found"
}
```

## GET /builds/:id

This API endpoint can be used to get the status for a module build status. You can find the build ID in the `status_url` from the webhook execution response.

### Request

The `id` parameter URL is the build id in the database generate after the webhook is successfully executed.

### Response

#### Headers

`content-type`: `application/json`

#### Body

##### 200 OK

```json
{
  "success": true,
  "data": {
    "build": {
      "id": "5f7e25960063be5000264881",
      "created_at": "2020-10-07T20:31:18.986Z",
      "options": {
        "type": "github",
        "moduleName": "wperron_test",
        "repository": "wperron-rand/testing",
        "ref": "v0.6.0",
        "version": "v0.6.0"
      },
      "status": "success",
      "message": "Published module.",
      "stats": {
        "total_files": 2,
        "skipped_due_to_size": [],
        "total_size": 300
      }
    }
  }
}
```

##### 400 Bad Request

```json
{
  "success": false,
  "error": "no build id provided"
}
```

##### 404 Not Found

```json
{
  "success": false,
  "error": "build not found"
}
```

## GET /stats

This API endpoint can be used to get the general stats from the registry.

### Request

### Response

#### Headers

`content-type`: `application/json`

#### Body

##### 200 OK

```json
{
  "success": true,
  "data": {
    "total_count": 1226,
    "total_versions": 8359,
    "recently_added_modules": [
      {
        "name": "postcss_import",
        "description": "postcss-import plugin for Deno",
        "star_count": 0,
        "created_at": "2020-11-06T14:39:50.187Z"
      },
      ...
    ],
    "recently_uploaded_versions": [
      {
        "name": "nkeys",
        "version": "v1.0.0-8",
        "created_at": "2020-11-06T16:24:08.619Z"
      },
      ...
    ]
  }
}
```
