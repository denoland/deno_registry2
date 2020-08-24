# Get modules
data "archive_file" "modules_get_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/modules_get.zip"
  source_dir  = "${path.module}/.terraform/tmp/modules_get"
}

data "aws_iam_policy_document" "modules_get_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "modules_get_iam" {
  name               = "${local.prefix}_modules_get_execution_role_${local.short_uuid}"
  assume_role_policy = data.aws_iam_policy_document.modules_get_policy.json
}

resource "aws_lambda_function" "modules_get" {
  filename      = data.archive_file.modules_get_zip.output_path
  function_name = "${local.prefix}_modules_get_${local.short_uuid}"
  role          = aws_iam_role.modules_get_iam.arn
  handler       = "bundle.handler"

  source_code_hash = filebase64sha256(data.archive_file.modules_get_zip.output_path)

  runtime = "provided"
  layers  = [aws_lambda_layer_version.deno_layer.arn]

  timeout = 10

  environment {
    variables = {
      "DENO_UNSTABLE" = "1"
      "HANDLER_EXT"   = "js"
      "MONGO_URI"     = var.mongodb_uri
    }
  }
}

resource "aws_lambda_permission" "modules_get" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.modules_get.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.deno_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "modules_get" {
  api_id           = aws_apigatewayv2_api.deno_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_uri        = aws_lambda_function.modules_get.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "modules_get" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "GET /modules/{name}"
  target    = "integrations/${aws_apigatewayv2_integration.modules_get.id}"
}

# List modules

data "archive_file" "modules_list_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/modules_list.zip"
  source_dir  = "${path.module}/.terraform/tmp/modules_list"
}

data "aws_iam_policy_document" "modules_list_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "modules_list_iam" {
  name               = "${local.prefix}_modules_list_execution_role_${local.short_uuid}"
  assume_role_policy = data.aws_iam_policy_document.modules_list_policy.json
}

resource "aws_lambda_function" "modules_list" {
  filename      = data.archive_file.modules_list_zip.output_path
  function_name = "${local.prefix}_modules_list_${local.short_uuid}"
  role          = aws_iam_role.modules_list_iam.arn
  handler       = "bundle.handler"

  source_code_hash = filebase64sha256(data.archive_file.modules_list_zip.output_path)

  runtime = "provided"
  layers  = [aws_lambda_layer_version.deno_layer.arn]

  timeout = 10

  environment {
    variables = {
      "DENO_UNSTABLE" = "1"
      "HANDLER_EXT"   = "js"
      "MONGO_URI"     = var.mongodb_uri
    }
  }
}

resource "aws_lambda_permission" "modules_list" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.modules_list.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.deno_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "modules_list" {
  api_id           = aws_apigatewayv2_api.deno_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_uri        = aws_lambda_function.modules_list.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "modules_list" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "GET /modules"
  target    = "integrations/${aws_apigatewayv2_integration.modules_list.id}"
}
