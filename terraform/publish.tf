data "archive_file" "async_publish_zip" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/async_publish.zip"
  source_dir  = "${path.module}/.terraform/tmp/async_publish"
}

resource "aws_lambda_function" "async_publish" {
  filename      = data.archive_file.async_publish_zip.output_path
  function_name = "${local.prefix}_async_publish_${local.short_uuid}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bundle.handler"

  source_code_hash = filebase64sha256(data.archive_file.async_publish_zip.output_path)

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

resource "aws_lambda_permission" "async_publish" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.async_publish.function_name
  principal     = "sqs.amazonaws.com"
  source_arn    = aws_sqs_queue.build_queue.arn
}