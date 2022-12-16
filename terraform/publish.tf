resource "aws_lambda_function" "async_publish" {
  package_type  = "Image"
  image_uri     = local.ecr_image_url
  function_name = "${local.prefix}_async_publish_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  publish       = false
  timeout       = 300
  memory_size   = 1024

  image_config {
    command = ["api/async/publish.handler"]
  }

  environment {
    variables = {
      "DENO_UNSTABLE"             = "1"
      "MONGO_URI"                 = local.mongodb_uri
      "STORAGE_BUCKET"            = aws_s3_bucket.storage_bucket.id
      "APILAND_URL"               = "https://apiland.deno.dev/webhook/publish"
      "APILAND_AUTH_TOKEN"        = var.apiland_auth_token
      "GOOGLE_PRIVATE_KEY_SSM"    = aws_ssm_parameter.google_private_key.name
      "GOOGLE_CLIENT_EMAIL_SSM"   = aws_ssm_parameter.google_client_email.name
      "GOOGLE_PRIVATE_KEY_ID_SSM" = aws_ssm_parameter.google_private_key_id.name
      "GOOGLE_PROJECT_ID_SSM"     = aws_ssm_parameter.google_project_id.name

    }
  }

  tags = local.tags
}

resource "aws_lambda_event_source_mapping" "async_publish" {
  batch_size       = 1
  event_source_arn = aws_sqs_queue.build_queue.arn
  enabled          = true
  function_name    = aws_lambda_function.async_publish.arn
}

resource "aws_lambda_permission" "async_publish" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.async_publish.function_name
  principal     = "sqs.amazonaws.com"
  source_arn    = aws_sqs_queue.build_queue.arn
}
