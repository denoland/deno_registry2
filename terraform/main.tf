resource "random_uuid" "this" {}

locals {
  short_uuid = substr(random_uuid.this.result, 0, 8)
  prefix     = "deno_registry2_-${var.env}"
}

resource "aws_lambda_layer_version" "deno_layer" {
  filename         = "${path.module}/.terraform/dl/deno-lambda-layer.zip"
  layer_name       = "${local.prefix}-deno-${local.short_uuid}"
  source_code_hash = filebase64sha256("${path.module}/.terraform/dl/deno-lambda-layer.zip")
}

resource "aws_s3_bucket" "storage_bucket" {
  bucket = "${local.prefix}-storagebucket-${local.short_uuid}"
  acl    = "public-read"
}

resource "aws_sqs_queue" "build_queue" {
  name                      = "${local.prefix}-build-queue-${local.short_uuid}"
  delay_seconds             = var.sqs_visibility_delay
  max_message_size          = 2048
  message_retention_seconds = 86400
}
