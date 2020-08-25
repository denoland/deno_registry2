# deno_registry2

This is the backend for the deno.land/x service.

## Limits

There are a few guidelines / rules that you should follow when publishing a module:

- Please only register module names that you will actually use.
- Do not squat names. If you do, we might transfer the name to someone that makes better use of it.
- Do not register names which contain trademarks that you do not own.
- Do not publish modules containing illegal content.

Additionally to these guidelines there are also hard limits:

- You can not publish more than 3 different modules from a single repository source.
- You can not publish more than 15 modules from a single GitHub account or organization.

If you need an increase to these quotas, please reach out to [ry@tinyclouds.org](mailto:ry@tinyclouds.org).

## Requirements

- AWS account
- [MongoDB Atlas](https://cloud.mongodb.com) account

## Preparing

1. Create a cluster on [MongoDB Atlas](https://cloud.mongodb.com). A M2 cluster is enough in most cases.
2. Create a database user on Atlas. They should have the read write database permission.
3. Get the database connection string and insert the username and password for the created. It should look something like this: `mongodb+srv://user:password@zyxwvu.fedcba.mongodb.net/?retryWrites=true&w=majority`.
4. Save this connection string in AWS Secrets Manager with the name `mongodb/atlas/deno_registry2` and the value key `MongoURI`.
5. Create a database called `production` in your cluster.
6. In this database create a collection called `modules`.
7. In this collection create a new Atlas Search index with the name `default` and the mapping defined in `indexes/atlas_search_index_mapping.json`
8. In this collection create a new index with the name `by_repository` like it is defined in `indexes/by_repository.json`
9. In this collection create a new index with the name `by_star_count` like it is defined in `indexes/by_star_count.json`

## Deploy

1. Install `aws` CLI.
2. Sign in to `aws` by running `aws configure`
3. [Install AWS `sam` CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
4. Run `sam build && sam deploy --guided`

## Development

To run tests locally, make sure you have Docker and docker-compose installed. Then run:

```sh
docker-compose up --abort-on-container-exit --build
```
