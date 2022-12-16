resource "aws_lambda_function" "webhook_github" {
  package_type  = "Image"
  image_uri     = local.ecr_image_url
  function_name = "${local.prefix}_webhook_github_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  publish       = false
  timeout       = local.lambda_default_timeout
  memory_size   = 128

  image_config {
    command = ["api/webhook/github.handler"]
  }

  environment {
    variables = {
      "DENO_UNSTABLE"             = "1"
      "MONGO_URI"                 = local.mongodb_uri
      "STORAGE_BUCKET"            = aws_s3_bucket.storage_bucket.id
      "MODERATION_BUCKET"         = aws_s3_bucket.moderation_bucket.id
      "BUILD_QUEUE"               = aws_sqs_queue.build_queue.id
      "GOOGLE_PRIVATE_KEY_SSM"    = aws_ssm_parameter.google_private_key.name
      "GOOGLE_CLIENT_EMAIL_SSM"   = aws_ssm_parameter.google_client_email.name
      "GOOGLE_PRIVATE_KEY_ID_SSM" = aws_ssm_parameter.google_private_key_id.name
      "GOOGLE_PROJECT_ID_SSM"     = aws_ssm_parameter.google_project_id.name

    }
  }

  tags = local.tags
}

resource "aws_lambda_permission" "webhook_github" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_github.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.deno_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "webhook_github" {
  api_id           = aws_apigatewayv2_api.deno_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_uri        = aws_lambda_function.webhook_github.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = local.lambda_default_timeout * 1000
}

resource "aws_apigatewayv2_route" "webhook_github" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "POST /webhook/gh/{name}"
  target    = "integrations/${aws_apigatewayv2_integration.webhook_github.id}"
}
