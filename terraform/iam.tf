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

# AWS managed policy for write access to X-Ray
data "aws_iam_policy" "xray_write" {
  arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
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

  statement {
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.github_token.arn]
  }

  statement {
    actions   = ["ecr:*"]
    resources = [aws_ecr_repository.deployment_package.arn]
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

resource "aws_iam_role_policy_attachment" "xray_lambda" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = data.aws_iam_policy.xray_write.arn
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
      "s3:ListBucket",
      "s3:GetReplicationConfiguration",
      "s3:GetObjectVersionForReplication",
      "s3:GetObjectVersionAcl",
      "s3:GetObjectVersionTagging",
      "s3:GetObjectRetention",
      "s3:GetObjectLegalHold"
    ]
    resources = [
      aws_s3_bucket.storage_bucket.arn,
      "${aws_s3_bucket.storage_bucket.arn}/*",
      aws_s3_bucket.storage_bucket_replication.arn,
      "${aws_s3_bucket.storage_bucket_replication.arn}/*"
    ]
  }

  statement {
    actions = [
      "s3:ReplicateObject",
      "s3:ReplicateDelete",
      "s3:ReplicateTags",
      "s3:ObjectOwnerOverrideToBucketOwner"
    ]
    resources = [
      aws_s3_bucket.storage_bucket_replication.arn,
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
