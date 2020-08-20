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

resource "aws_lambda_layer_version" "deno_layer" {
  filename         = "${path.module}/.terraform/dl/deno-lambda-layer.zip"
  layer_name       = "deno"
  source_code_hash = filebase64sha256("${path.module}/.terraform/dl/deno-lambda-layer.zip")
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
      "DENO_UNSTABLE" = "1"
      "HANDLER_EXT"   = "js"
    }
  }
}
