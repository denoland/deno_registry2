resource "aws_sns_topic" "alarm" {
  name = "${local.prefix}-alarms-${local.short_uuid}"
  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "publish_lambda_errors" {
  for_each = {
    publish = aws_lambda_function.async_publish.function_name,
    webhook = aws_lambda_function.webhook_github.function_name,
  }

  alarm_name          = "${local.prefix}-lambda-errors-alarm-${each.key}-${local.short_uuid}"
  alarm_description   = "Lambda function failed more than 2 times in the last 30 minutes."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 1800
  datapoints_to_alarm = 1
  statistic           = "Sum"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  dimensions = {
    "FunctionName" = each.value
  }
  threshold          = 2
  treat_missing_data = "missing"
  alarm_actions      = [aws_sns_topic.alarm.arn]
  tags               = local.tags
}

resource "aws_cloudwatch_metric_alarm" "stuck_builds" {
  alarm_name          = "${local.prefix}-build-queue-old-messages-${local.short_uuid}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  datapoints_to_alarm = 1
  statistic           = "Maximum"
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  dimensions = {
    "QueueName" = aws_sqs_queue.build_queue.name
  }
  threshold          = 900 // 15 minutes
  treat_missing_data = "missing"
  alarm_actions      = [aws_sns_topic.alarm.arn]
  tags               = local.tags
}

resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${local.prefix}-total-build-dlq-${local.short_uuid}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  datapoints_to_alarm = 1
  statistic           = "Average"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  dimensions = {
    "QueueName" = aws_sqs_queue.build_dlq.name
  }
  threshold          = 25
  treat_missing_data = "missing"
  alarm_actions      = [aws_sns_topic.alarm.arn]
  tags               = local.tags
}

resource "aws_sns_topic_subscription" "email-bert" {
  endpoint  = "bert@deno.land"
  protocol  = "email"
  topic_arn = aws_sns_topic.alarm.arn
}

resource "aws_sns_topic_subscription" "email-luca" {
  endpoint  = "lucacasonato@yahoo.com"
  protocol  = "email"
  topic_arn = aws_sns_topic.alarm.arn
}

resource "aws_sns_topic_subscription" "email-ryan" {
  endpoint  = "ry@tinyclouds.org"
  protocol  = "email"
  topic_arn = aws_sns_topic.alarm.arn
}

resource "aws_sns_topic_subscription" "sms-luca" {
  endpoint  = "+31615219593"
  protocol  = "sms"
  topic_arn = aws_sns_topic.alarm.arn
}
