terraform {
  required_version = ">= 0.13"
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    archive = {
      source = "hashicorp/archive"
    }
  }
  # backend "s3" {
  #   key    = "deno_registry2_staging"
  #   region = "eu-west-1"
  # }
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "terraform_state_${local.short_uuid}"
  acl    = "private"
  versioning {
    enabled = true
  }
}