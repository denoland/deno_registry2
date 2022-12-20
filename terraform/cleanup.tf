resource "aws_lambda_function" "cleanup" {
  package_type  = "Image"
  image_uri     = local.ecr_image_url
  function_name = "${local.prefix}_nightly_cleanup_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  publish       = true
  timeout       = 300
  memory_size   = 1024

  image_config {
    command = ["api/async/cleanup.handler"]
  }

  environment {
    variables = {
      "DENO_UNSTABLE" = "1"
      "MONGO_URI"     = local.mongodb_uri
      "DRYRUN"        = "1"
    }
  }

  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "cleanup" {
  name                = "${local.prefix}-nightly-cleanup-schedule-${local.short_uuid}"
  schedule_expression = "rate(1 day)"
  description         = "Event triggering the nightly cleanup of unused module names"
  tags                = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lambda_permission" "cleanup_schedule" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cleanup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cleanup.arn
}

resource "aws_cloudwatch_event_target" "cleanup" {
  target_id = local.short_uuid
  rule      = aws_cloudwatch_event_rule.cleanup.name
  arn       = aws_lambda_function.cleanup.arn
}
