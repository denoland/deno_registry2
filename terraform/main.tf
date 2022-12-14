resource "random_uuid" "this" {}

data "google_dns_managed_zone" "dotland_dns_zone" {
  provider = google.dns
  name     = "deno-land"
}

data "aws_caller_identity" "this" {}

locals {
  short_uuid             = substr(random_uuid.this.result, 0, 8)
  prefix                 = "deno-registry2-${var.env}"
  domain_prefix          = var.env == "prod" ? "" : "${var.env}."
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

resource "aws_ecr_repository_policy" "deployment_package_policy" {
  repository = aws_ecr_repository.deployment_package.name
  policy     = data.aws_iam_policy_document.lambda_ecr_image_retrieval.json
}

data "aws_iam_policy_document" "lambda_ecr_image_retrieval" {
  statement {
    sid = "LambdaECRImageRetrievalPolicy"
    actions = [
      "ecr:BatchGetImage",
      "ecr:DeleteRepositoryPolicy",
      "ecr:GetDownloadUrlForLayer",
      "ecr:GetRepositoryPolicy",
      "ecr:SetRepositoryPolicy"
    ]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_s3_bucket" "storage_bucket" {
  bucket = "${local.prefix}-storagebucket-${local.short_uuid}"
  tags   = local.tags
}

resource "aws_s3_bucket_ownership_controls" "storage_bucket_ownership_controls" {
  bucket = aws_s3_bucket.storage_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "storage_bucket_public_access" {
  bucket                  = aws_s3_bucket.storage_bucket.id
  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "storage_bucket_policy" {
  bucket = aws_s3_bucket.storage_bucket.id
  policy = data.aws_iam_policy_document.allow_public_read.json
}

data "aws_iam_policy_document" "allow_public_read" {
  statement {
    actions = [
      "s3:GetObject"
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    resources = [
      "${aws_s3_bucket.storage_bucket.arn}/*"
    ]
  }
}

resource "aws_s3_bucket_cors_configuration" "storage_bucket_cors_configuration" {
  bucket = aws_s3_bucket.storage_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = []
  }
}

resource "aws_s3_bucket_versioning" "storage_bucket_versioning" {
  bucket = aws_s3_bucket.storage_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_replication_configuration" "storage_bucket_replication_configuration" {
  bucket = aws_s3_bucket.storage_bucket.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replication-rule"
    status = "Enabled"

    delete_marker_replication {
      status = "Enabled"
    }

    destination {
      bucket        = aws_s3_bucket.storage_bucket_replication.arn
      storage_class = "STANDARD"

      metrics {
        status = "Enabled"
      }
    }

    filter {}
  }

  # Bucket versioning must be enabled first.
  depends_on = [aws_s3_bucket_versioning.storage_bucket_versioning]
}

resource "aws_s3_bucket" "storage_bucket_replication" {
  provider = aws.backup
  bucket   = "${local.prefix}-storagebucket-replication-${local.short_uuid}"
  tags     = local.tags
}

resource "aws_s3_bucket_ownership_controls" "storage_bucket_replication_ownership_controls" {
  provider = aws.backup
  bucket   = aws_s3_bucket.storage_bucket_replication.id

  rule {
    object_ownership = "BucketOwnerEnforced"
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

resource "aws_s3_bucket_lifecycle_configuration" "storage_replication_bucket_lifecycle_configuration" {
  provider = aws.backup
  bucket   = aws_s3_bucket.storage_bucket_replication.id

  rule {
    id     = "transition-to-standard-ia"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

  }
}

resource "aws_s3_bucket_versioning" "storage_replication_bucket_versioning" {
  provider = aws.backup
  bucket   = aws_s3_bucket.storage_bucket_replication.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket" "moderation_bucket" {
  bucket = "${local.prefix}-moderationbucket-${local.short_uuid}"
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "moderation_bucket_public_access" {
  bucket                  = aws_s3_bucket.moderation_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "moderation_bucket_ownership_controls" {
  bucket = aws_s3_bucket.moderation_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "moderation_bucket_versioning" {
  bucket = aws_s3_bucket.moderation_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
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
