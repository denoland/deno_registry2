# API

## POST /webhook/gh/:module

This API endpoint recieves webhooks from GitHub. The `module` parameter in the URL is the name of the module.

### Request

The contents and headers should be a GitHub `create` webhook event. More information: https://developer.github.com/webhooks/event-payloads/#create

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
  "error": "module name is not valid"
}
```
