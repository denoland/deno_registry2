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
8. In this collection create a new index with the name `by_owner_and_repo` like it is defined in `indexes/modules_by_owner_and_repo.json`
9. In this collection create a new index with the name `by_is_unlisted_and_star_count` like it is defined in `indexes/modules_by_is_unlisted_and_star_count.json`
10. In this database create a collection called `builds`.
11. In this collection create a new *unique* index with the name `by_name_and_version` like it is defined in `indexes/builds_by_name_and_version.json`

## Deploy

1. Install `aws` CLI.
2. Sign in to `aws` by running `aws configure`
3. [Install Terraform](https://terraform.io/downloads.html) version 0.13 or higher
4. Copy `terraform/terraform.tfvars.example` to `terraform/terraform.tfvars`
5. Move to the `terraform/` and **comment out** the `backend` section in the `meta.tf` file (important for first-time apply)
6. Run the following steps:

```bash
terraform init
terraform plan -var-file terraform.tfvars -out plan.tfplan
terraform apply plan.tfplan
aws s3 ls | grep 'terraform-state' # take note of your tf state bucket name
# before the final step, go back and remove the comments from step 5
terraform init -backend-config "bucket=<your-bucket-name>" -backend-config "region=<aws-region>"
```

## Teardown

Before destroying your staging environment, make sure to:

1. run `terraform state pull` to make a local copy of your state file
2. comment out the `backend` section of the `meta.tf` file
3. re-initialize your terraform workspace by running `terraform init -backend-config "region=<aws-region>"`
4. make sure you empty your s3 buckets, otherwise the destroy will fail

You can then run `terraform destroy` to completely remove your staging environment.

## Development

To run tests locally, make sure you have Docker and docker-compose installed. Then run:

```sh
docker-compose up --abort-on-container-exit --build
```
