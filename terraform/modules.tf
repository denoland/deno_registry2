resource "aws_lambda_function" "modules_get" {
  package_type  = "Image"
  image_uri     = local.ecr_image_url
  function_name = "${local.prefix}_modules_get_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  publish       = false
  timeout       = local.lambda_default_timeout
  memory_size   = 128

  image_config {
    command = ["api/modules/get.handler"]
  }

  environment {
    variables = {
      "DENO_UNSTABLE"             = "1"
      "GOOGLE_PRIVATE_KEY_SSM"    = aws_ssm_parameter.google_private_key.name
      "GOOGLE_CLIENT_EMAIL_SSM"   = aws_ssm_parameter.google_client_email.name
      "GOOGLE_PRIVATE_KEY_ID_SSM" = aws_ssm_parameter.google_private_key_id.name
      "GOOGLE_PROJECT_ID_SSM"     = aws_ssm_parameter.google_project_id.name

    }
  }

  tags = local.tags
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
  timeout_milliseconds   = local.lambda_default_timeout * 1000
}

resource "aws_apigatewayv2_route" "modules_get" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "GET /modules/{name}"
  target    = "integrations/${aws_apigatewayv2_integration.modules_get.id}"
}
