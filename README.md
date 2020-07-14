# deno_registry2

This is the backend for the deno.land/x service.

## Requirements

- AWS account
- [MongoDB Atlas](https://cloud.mongodb.com) account

## Preparing

1. Create a cluster on [MongoDB Atlas](https://cloud.mongodb.com). A M2 cluster is enough in most cases.
2. Create a database user on Atlas. They should have the read write database permission.
3. Get the database connection string and insert the username and password for the created. It should look something like this: `mongodb+srv://user:password@zyxwvu.fedcba.mongodb.net/?retryWrites=true&w=majority`.
4. Save this connection string in AWS Secrets Manager with the name `mongodb/atlas/deno_registry2` and the value key `MongoURI`.

## Deploy

1. Install `aws` CLI.
2. Sign in to `aws` by running `aws configure`
3. [Install AWS `sam` CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
4. Run `sam build && sam deploy --guided`
