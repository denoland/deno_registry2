resource "aws_apigatewayv2_api" "deno_api" {
  name          = "${local.prefix}_api_${local.short_uuid}"
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
}

resource "aws_apigatewayv2_domain_name" "deno_api_domain" {
  domain_name = var.domain
  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}
