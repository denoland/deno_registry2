locals {
  api_name = "${local.prefix}_api_${local.short_uuid}"
}

resource "aws_apigatewayv2_api" "deno_api" {
  name          = local.api_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
  }
}

resource "aws_apigatewayv2_api_mapping" "deno_api_mapping" {
  api_id      = aws_apigatewayv2_api.deno_api.id
  domain_name = aws_apigatewayv2_domain_name.deno_api_domain.id
  stage       = aws_apigatewayv2_stage.deno_api_default_stage.id
}

resource "aws_apigatewayv2_stage" "deno_api_default_stage" {
  api_id      = aws_apigatewayv2_api.deno_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_log_group.arn
    format          = "[$context.requestTime] $context.httpMethod $context.path $context.protocol $context.status $context.responseLength $context.requestId"
  }
}

resource "aws_apigatewayv2_domain_name" "deno_api_domain" {
  domain_name = var.api_domain
  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

# Region-wide API Gateway config
resource "aws_api_gateway_account" "denoland" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch.arn
}

data "aws_iam_policy_document" "api_gateway_cloudwatch_assume_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api_gateway_cloudwatch" {
  name               = "api_gateway_cloudwatch_global"
  assume_role_policy = data.aws_iam_policy_document.api_gateway_cloudwatch_assume_policy.json
}

data "aws_iam_policy_document" "api_gateway_cloudwatch_access_policy" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
      "logs:GetLogEvents",
      "logs:FilterLogEvents",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "cloudwatch" {
  name   = "default"
  role   = aws_iam_role.api_gateway_cloudwatch.id
  policy = data.aws_iam_policy_document.api_gateway_cloudwatch_access_policy.json
}

resource "aws_cloudwatch_log_group" "api_gateway_log_group" {
  name              = "/aws/apigateway/${local.api_name}"
  retention_in_days = 14
}

resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_domain
  value   = aws_apigatewayv2_domain_name.deno_api_domain.domain_name_configuration[0].target_domain_name
  type    = "CNAME"
  ttl     = 1 # '1' = automatic
}
