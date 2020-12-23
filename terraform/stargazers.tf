resource "aws_ssm_parameter" "github_token" {
  name        = "${local.prefix}-github-token-${local.short_uuid}"
  description = "Github personal access token"
  type        = "SecureString"
  value       = var.github_token
  tags        = local.tags
}

resource "aws_lambda_function" "stargazers" {
  package_type  = "Image"
  image_uri     = local.ecr_image_url
  function_name = "${local.prefix}_scrape_stargazers_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  publish       = true
  timeout       = 300
  memory_size   = 1024

  image_config {
    command = ["api/async/stargazers.handler"]
  }

  environment {
    variables = {
      "DENO_UNSTABLE"    = "1"
      "MONGO_URI"        = var.mongodb_uri
      "STORAGE_BUCKET"   = aws_s3_bucket.storage_bucket.id
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
