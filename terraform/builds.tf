data "archive_file" "builds_get_function_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/builds_get_function.zip"
  source_dir  = "${path.module}/.terraform/tmp/builds_get_function"
}

data "aws_iam_policy_document" "builds_get_function_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "builds_get_function_iam" {
  name               = "builds_get_function_execution_role_${local.short_uuid}"
  assume_role_policy = data.aws_iam_policy_document.builds_get_function_policy.json
}

resource "aws_lambda_function" "builds_get_function" {
  filename      = data.archive_file.builds_get_function_zip.output_path
  function_name = "builds_get_function_${local.short_uuid}"
  role          = aws_iam_role.builds_get_function_iam.arn
  handler       = "bundle.handler"

  source_code_hash = filebase64sha256(data.archive_file.builds_get_function_zip.output_path)

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
}

resource "aws_lambda_permission" "builds_get_function" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.builds_get_function.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.deno_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "builds_get_function" {
  api_id           = aws_apigatewayv2_api.deno_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_uri        = aws_lambda_function.builds_get_function.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "builds_get_function" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "GET /builds/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.builds_get_function.id}"
}