resource "aws_lambda_function" "async_publish" {
  package_type  = "Image"
  image_uri     = local.ecr_image_url
  function_name = "${local.prefix}_async_publish_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  publish       = true
  timeout       = 300
  memory_size   = 1024

  image_config {
    command = ["api/async/publish.handler"]
  }

  environment {
    variables = {
      "DENO_UNSTABLE"  = "1"
      "MONGO_URI"      = var.mongodb_uri
      "STORAGE_BUCKET" = aws_s3_bucket.storage_bucket.id
      "REMOTE_URL"     = "https://deno.land/x/%m@%v"
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
