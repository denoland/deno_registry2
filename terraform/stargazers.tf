data "archive_file" "stargazers_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/stargazers.zip"
  source_dir  = "${path.module}/.terraform/tmp/stargazers"
}

resource "aws_ssm_parameter" "github_token" {
  name        = "${local.prefix}-github-token-${local.short_uuid}"
  description = "Github personal access token"
  type        = "SecureString"
  value       = var.github_token
  tags        = local.tags
}

resource "aws_lambda_function" "stargazers" {
  filename      = data.archive_file.stargazers_zip.output_path
  function_name = "${local.prefix}_scrape_stargazers_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bundle.handler"
  publish       = true

  source_code_hash = filebase64sha256(data.archive_file.stargazers_zip.output_path)

  runtime = "provided"
  layers  = [aws_lambda_layer_version.deno_layer.arn]

  timeout     = 300
  memory_size = 1024

  environment {
    variables = {
      "DENO_UNSTABLE"    = "1"
      "HANDLER_EXT"      = "js"
      "MONGO_URI"        = var.mongodb_uri
      "STORAGE_BUCKET"   = aws_s3_bucket.storage_bucket.id
      "GITHUB_USERNAME"  = var.github_username
      "GITHUB_TOKEN_SSM" = aws_ssm_parameter.github_token.name
    }
  }

  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "stargazers" {
  name                = "${local.prefix}-scrape-stargazers-schedule-${local.short_uuid}"
  schedule_expression = "rate(1 day)"
  description         = "Event triggering the scrapping of stargazers from GitHub."
  tags                = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lambda_permission" "stargazers_schedule" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stargazers.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.stargazers.arn
}

resource "aws_cloudwatch_event_target" "stargazers" {
  target_id = local.short_uuid
  rule      = aws_cloudwatch_event_rule.stargazers.name
  arn       = aws_lambda_function.stargazers.arn
}
