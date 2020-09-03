data "archive_file" "webhook_github_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/webhook_github.zip"
  source_dir  = "${path.module}/.terraform/tmp/webhook_github"
}

resource "aws_lambda_function" "webhook_github" {
  filename      = data.archive_file.webhook_github_zip.output_path
  function_name = "${local.prefix}_webhook_github_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bundle.handler"

  source_code_hash = filebase64sha256(data.archive_file.webhook_github_zip.output_path)

  runtime = "provided"
  layers  = [aws_lambda_layer_version.deno_layer.arn]

  timeout     = local.lambda_default_timeout
  memory_size = 128

  environment {
    variables = {
      "DENO_UNSTABLE"     = "1"
      "HANDLER_EXT"       = "js"
      "MONGO_URI"         = var.mongodb_uri
      "STORAGE_BUCKET"    = aws_s3_bucket.storage_bucket.id
      "MODERATION_BUCKET" = aws_s3_bucket.moderation_bucket.id
      "BUILD_QUEUE"       = aws_sqs_queue.build_queue.id
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