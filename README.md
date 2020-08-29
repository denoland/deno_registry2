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
5. Create a database called `production` in your cluster.
6. In this database create a collection called `modules`.
7. In this collection create a new Atlas Search index with the name `default` and the mapping defined in `indexes/atlas_search_index_mapping.json`
8. In this collection create a new index with the name `by_repository` like it is defined in `indexes/by_repository.json`
9. In this collection create a new index with the name `by_star_count` like it is defined in `indexes/by_star_count.json`

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
terraform init -backend-config "bucket=<your-bucket-name>"
```

## Teardown

Before destroying your staging environment, make sure to:

1. run `terraform state pull` to make a local copy of your state file
2. comment out the `backend` section of the `meta.tf` file
3. re-initialize your terraform workspace by running `terraform init`
4. make sure you empty your s3 buckets, otherwise the destroy will fail

You can then run `terraform destroy` to completely remove your staging environment.

## Development

To run tests locally, make sure you have Docker and docker-compose installed. Then run:

```sh
docker-compose up --abort-on-container-exit --build
```
