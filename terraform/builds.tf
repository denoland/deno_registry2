data "archive_file" "builds_get_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/builds_get.zip"
  source_dir  = "${path.module}/.terraform/tmp/builds_get"
}

resource "aws_lambda_function" "builds_get" {
  filename      = data.archive_file.builds_get_zip.output_path
  function_name = "${local.prefix}_builds_get_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bundle.handler"

  source_code_hash = filebase64sha256(data.archive_file.builds_get_zip.output_path)

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
}

resource "aws_apigatewayv2_route" "builds_get" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "GET /builds/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.builds_get.id}"
}