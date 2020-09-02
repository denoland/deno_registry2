# Lambda execution role & policy
data "aws_iam_policy_document" "assume_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec_role" {
  name               = "${local.prefix}_execution_role_${local.short_uuid}"
  assume_role_policy = data.aws_iam_policy_document.assume_policy.json
  tags               = local.tags
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:PutObjectAcl",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.storage_bucket.arn,
      "${aws_s3_bucket.storage_bucket.arn}/*",
      aws_s3_bucket.moderation_bucket.arn,
      "${aws_s3_bucket.moderation_bucket.arn}/*",
    ]
  }

  statement {
    actions = [
      "sqs:SendMessage",
      "sqs:SendMessageBatch",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:SetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [
      aws_sqs_queue.build_queue.arn,
      aws_sqs_queue.build_dlq.arn,
    ]
  }
}

data "aws_iam_policy" "basic_lambda" {
  arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_permissions" {
  role   = aws_iam_role.lambda_exec_role.name
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_iam_role_policy_attachment" "basic_lambda" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = data.aws_iam_policy.basic_lambda.arn
}

# S3 replication role & policy
data "aws_iam_policy_document" "replication_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "replication_permissions" {
  statement {
    actions = [
      "s3:GetReplicationConfiguration",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.storage_bucket.arn,
    ]
  }

  statement {
    actions = [
      "s3:GetObjectVersion",
      "s3:GetObjectVersionAcl",
    ]
    resources = [
      "${aws_s3_bucket.storage_bucket.arn}/*"
    ]
  }

  statement {
    actions = [
      "s3:ReplicateObject",
      "s3:ReplicateDelete",
    ]
    resources = [
      "${aws_s3_bucket.storage_bucket_replication.arn}/*"
    ]
  }
}

resource "aws_iam_role" "replication" {
  name               = "${local.prefix}-replication-role-${local.short_uuid}"
  assume_role_policy = data.aws_iam_policy_document.replication_assume.json
}

resource "aws_iam_role_policy" "replication" {
  role   = aws_iam_role.replication.name
  policy = data.aws_iam_policy_document.replication_permissions.json
}
