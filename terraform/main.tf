resource "random_uuid" "this" {}

data "aws_caller_identity" "this" {}

locals {
  short_uuid             = substr(random_uuid.this.result, 0, 8)
  prefix                 = "deno-registry2-${var.env}"
  lambda_default_timeout = 10
  ecr_image_url          = "${aws_ecr_repository.deployment_package.repository_url}:${var.docker_tag}"
  tags = {
    "deno.land/x:environment"    = var.env
    "deno.land/x:instance"       = local.short_uuid
    "deno.land/x:provisioned-by" = reverse(split(":", data.aws_caller_identity.this.arn))[0]
  }
}

resource "aws_ecr_repository" "deployment_package" {
  name                 = "deno_registry2"
  image_tag_mutability = "IMMUTABLE"
  tags                 = local.tags

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_s3_bucket" "storage_bucket" {
  bucket = "${local.prefix}-storagebucket-${local.short_uuid}"
  acl    = "private"
  tags   = local.tags

  cors_rule {
    allowed_headers = []
    allowed_methods = [
      "GET",
    ]
    allowed_origins = [
      "*",
    ]
    expose_headers  = []
    max_age_seconds = 0
  }

  versioning {
    enabled = true
  }

  website {
    index_document = "________________"
  }

  replication_configuration {
    role = aws_iam_role.replication.arn
    rules {
      id     = local.short_uuid
      status = "Enabled"
      destination {
        bucket        = aws_s3_bucket.storage_bucket_replication.arn
        storage_class = "STANDARD"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "storage_bucket_public_access" {
  bucket                  = aws_s3_bucket.storage_bucket.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket" "storage_bucket_replication" {
  provider = aws.backup
  bucket   = "${local.prefix}-storagebucket-replication-${local.short_uuid}"
  acl      = "private"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    enabled = true

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "storage_replication_bucket_public_access" {
  provider                = aws.backup
  bucket                  = aws_s3_bucket.storage_bucket_replication.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "cloudflare_record" "cdn" {
  zone_id = var.cloudflare_zone_id
  name    = var.cdn_domain
  value   = aws_s3_bucket.storage_bucket.website_endpoint
  type    = "CNAME"
  ttl     = 1 # '1' = automatic
  proxied = true
}

resource "aws_s3_bucket" "moderation_bucket" {
  bucket = "${local.prefix}-moderationbucket-${local.short_uuid}"
  acl    = "private"
  tags   = local.tags

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "moderation_bucket_public_access" {
  bucket                  = aws_s3_bucket.moderation_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_sqs_queue" "build_queue" {
  name                       = "${local.prefix}-build-queue-${local.short_uuid}"
  max_message_size           = 2048
  message_retention_seconds  = 86400
  tags                       = local.tags
  visibility_timeout_seconds = var.sqs_visibility_delay

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.build_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue" "build_dlq" {
  name                       = "${local.prefix}-build-dlq-${local.short_uuid}"
  max_message_size           = 2048
  message_retention_seconds  = 86400
  visibility_timeout_seconds = var.sqs_visibility_delay
  tags                       = local.tags
}
