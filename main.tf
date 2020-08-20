terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    archive = {
      source = "hashicorp/archive"
    }
  }
}

provider "aws" {
  profile = "default"
  region  = "eu-west-1"
}

variable "mongodb_uri" {
  type = string
}

resource "aws_lambda_layer_version" "deno_layer" {
  filename         = "${path.module}/.terraform/dl/deno-lambda-layer.zip"
  layer_name       = "deno"
  source_code_hash = filebase64sha256("${path.module}/.terraform/dl/deno-lambda-layer.zip")
}

resource "aws_apigatewayv2_api" "deno_api" {
  name          = "deno_api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "example" {
  api_id      = aws_apigatewayv2_api.deno_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_s3_bucket" "storage_bucket" {
  bucket = "deno-registry2-storagebucket"
  acl    = "public-read"
}

resource "aws_sqs_queue" "build_queue" {
  name                      = "deno-registry2-build-queue"
  delay_seconds             = 301
  max_message_size          = 2048
  message_retention_seconds = 86400
}

data "archive_file" "webhook_github_function_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/webhook_github_function.zip"
  source_dir  = "${path.module}/.terraform/tmp/webhook_github_function"
}

resource "aws_iam_role" "webhook_github_function_iam" {
  name = "webhook_github_function_iam"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_lambda_function" "webhook_github_function" {
  filename      = data.archive_file.webhook_github_function_zip.output_path
  function_name = "webhook_github_function"
  role          = aws_iam_role.webhook_github_function_iam.arn
  handler       = "bundle.handler"

  source_code_hash = filebase64sha256(data.archive_file.webhook_github_function_zip.output_path)

  runtime = "provided"
  layers  = [aws_lambda_layer_version.deno_layer.arn]

  timeout = 10

  environment {
    variables = {
      "DENO_UNSTABLE"  = "1"
      "HANDLER_EXT"    = "js"
      "MONGO_URI"      = var.mongodb_uri
      "STORAGE_BUCKET" = aws_s3_bucket.storage_bucket.id
      "BUILD_QUEUE"    = aws_sqs_queue.build_queue.id
    }
  }
}

resource "aws_lambda_permission" "webhook_github_function" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_github_function.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.deno_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "webhook_github_function" {
  api_id           = aws_apigatewayv2_api.deno_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_uri        = aws_lambda_function.webhook_github_function.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "webhook_github_function" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "POST /webhook/gh/{name}"
  target    = "integrations/${aws_apigatewayv2_integration.webhook_github_function.id}"
}
