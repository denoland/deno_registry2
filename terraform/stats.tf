resource "aws_lambda_function" "stats" {
  package_type  = "Image"
  image_uri     = local.ecr_image_url
  function_name = "${local.prefix}_stats_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  publish       = true
  timeout       = local.lambda_default_timeout
  memory_size   = 128

  image_config {
    working_directory = "/var/task/api"
    command           = ["stats.handler"]
  }

  environment {
    variables = {
      "DENO_UNSTABLE" = "1"
      "MONGO_URI"     = var.mongodb_uri
    }
  }

  tags = local.tags
}

resource "aws_lambda_permission" "stats" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stats.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.deno_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "stats" {
  api_id           = aws_apigatewayv2_api.deno_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_uri        = aws_lambda_function.stats.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "stats" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "GET /stats"
  target    = "integrations/${aws_apigatewayv2_integration.stats.id}"
}