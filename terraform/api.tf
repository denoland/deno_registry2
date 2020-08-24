resource "aws_apigatewayv2_api" "deno_api" {
  name          = "${local.prefix}_api_${local.short_uuid}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "example" {
  api_id      = aws_apigatewayv2_api.deno_api.id
  name        = "$default"
  auto_deploy = true
}