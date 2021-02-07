resource "aws_lambda_function" "builds_get" {
  package_type  = "Image"
  image_uri     = local.ecr_image_url
  function_name = "${local.prefix}_builds_get_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  publish       = false
  timeout       = local.lambda_default_timeout
  memory_size   = 128

  image_config {
    command = ["api/builds/get.handler"]
  }

  environment {
    variables = {
      "DENO_UNSTABLE"  = "1"
      "MONGO_URI"      = var.mongodb_uri
      "STORAGE_BUCKET" = aws_s3_bucket.storage_bucket.id
    }
  }

  tags = local.tags
}

resource "aws_lambda_permission" "builds_get" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.builds_get.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.deno_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "builds_get" {
  api_id           = aws_apigatewayv2_api.deno_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_uri        = aws_lambda_function.builds_get.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = local.lambda_default_timeout * 1000
}

resource "aws_apigatewayv2_route" "builds_get" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "GET /builds/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.builds_get.id}"
}