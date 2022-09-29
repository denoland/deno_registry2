terraform {
  required_version = ">= 0.13"
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    archive = {
      source = "hashicorp/archive"
    }
    google = {
      version = ">= 4.0.0, < 5.0.0"
    }
  }
  backend "s3" {
    key = "terraform.tfstate"
  }
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "${local.prefix}-terraform-state-${local.short_uuid}"
  acl    = "private"
  tags   = local.tags
  versioning {
    enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state_public_access" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
