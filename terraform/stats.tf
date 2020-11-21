data "archive_file" "stats_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/stats.zip"
  source_dir  = "${path.module}/.terraform/tmp/stats"
}

resource "aws_lambda_function" "stats" {
  filename      = data.archive_file.stats_zip.output_path
  function_name = "${local.prefix}_stats_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bundle.handler"

  source_code_hash = filebase64sha256(data.archive_file.stats_zip.output_path)

  runtime = "provided.al2"
  layers  = [aws_lambda_layer_version.deno_layer.arn]

  timeout     = 10
  memory_size = 128

  environment {
    variables = {
      "DENO_UNSTABLE" = "1"
      "HANDLER_EXT"   = "js"
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
