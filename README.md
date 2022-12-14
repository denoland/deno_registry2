# deno_registry2

This is the backend for the deno.land/x service.

## Limits

There are a few guidelines / rules that you should follow when publishing a
module:

- Please only register module names that you will actually use.
- Do not squat names. If you do, we might transfer the name to someone that
  makes better use of it.
- Do not register names which contain trademarks that you do not own.
- Do not publish modules containing illegal content.

Additionally to these guidelines there are also hard limits:

- You can not publish more than 3 different modules from a single repository
  source.
- You can not publish more than 15 modules from a single GitHub account or
  organization.

If you need an increase to these quotas, please reach out to
[modules@deno.com](mailto:modules@deno.com).

## Requirements

- AWS account
- [MongoDB Atlas](https://cloud.mongodb.com) account

## Preparing Docker

Make sure to follow the official instructions to
[login to ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html)
via the Docker cli - this is needed to push the images used by the Lambda
deployment to ECR.

```bash
aws ecr get-login-password --region region | docker login --username AWS --password-stdin aws_account_id.dkr.ecr.region.amazonaws.com
```

## Preparing MongoDB Atlas

1. Create an API key on [MongoDB Atlas](https://cloud.mongodb.com). The API key
   should have sufficient privileges to create a new project and configure it
   afterwards.

## Deploy

1. Install `aws` CLI.
2. Sign in to `aws` by running `aws configure`
3. [Install Terraform](https://terraform.io/downloads.html) version 0.13 or
   higher
4. Copy `terraform/terraform.tfvars.example` to `terraform/terraform.tfvars`
5. Modify `terraform/terraform.tfvars`: set `mongodb_atlas_org_id` to your
   MongoDB Atlas organization ID, and update `mongodb_atlas_private_key` and
   `mongodb_atlas_public_key` with the API key you created earlier.
6. Move to the `terraform/` and **comment out** the `backend` section in the
   `meta.tf` file (important for first-time apply)
7. Run the following steps:

```bash
terraform init
terraform plan -var-file terraform.tfvars -out plan.tfplan
terraform apply plan.tfplan
aws s3 ls | grep 'terraform-state' # take note of your tf state bucket name
# before the final step, go back and remove the comments from step 5
terraform init -backend-config "bucket=<your-bucket-name>" -backend-config "region=<aws-region>"
```

## Setting up MongoDB

Terraform automatically provisions a MongoDB cluster in a separate project.

1. In the newly created MongoDB cluster, create a database called `production`.
2. In this database create a collection called `modules`.
3. In this collection create a new Atlas Search index with the name `default`
   and the mapping defined in `indexes/atlas_search_index_mapping.json`
4. In this collection create a new index with the name `by_owner_and_repo` like
   it is defined in `indexes/modules_by_owner_and_repo.json`
5. In this collection create a new index with the name
   `by_is_unlisted_and_star_count` like it is defined in
   `indexes/modules_by_is_unlisted_and_star_count.json`
6. In this database create a collection called `builds`.
7. In this collection create a new _unique_ index with the name
   `by_name_and_version` like it is defined in
   `indexes/builds_by_name_and_version.json`

## Teardown

Before destroying your staging environment, make sure to:

1. run `terraform state pull` to make a local copy of your state file
2. comment out the `backend` section of the `meta.tf` file
3. re-initialize your terraform workspace by running
   `terraform init -backend-config "region=<aws-region>"`
4. make sure you empty your s3 buckets, otherwise the destroy will fail

You can then run `terraform destroy` to completely remove your staging
environment.

## Development

To run tests locally, make sure you have Docker and docker-compose installed.
Then run:

```sh
make test
```
