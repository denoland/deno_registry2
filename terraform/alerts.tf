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

resource "aws_cloudwatch_metric_alarm" "data_lambda_errors" {
  for_each = {
    get    = aws_lambda_function.modules_get.function_name,
    list   = aws_lambda_function.modules_list.function_name,
    builds = aws_lambda_function.builds_get.function_name,
    stats  = aws_lambda_function.stats.function_name,
  }

  alarm_name          = "${local.prefix}-lambda-errors-alarm-${each.key}-${local.short_uuid}"
  alarm_description   = "Lambda function failed more than 5 times in the last 5 minutes."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  datapoints_to_alarm = 1
  statistic           = "Sum"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  dimensions = {
    "FunctionName" = each.value
  }
  threshold          = 5
  treat_missing_data = "missing"
  alarm_actions      = [aws_sns_topic.alarm.arn]
  tags               = local.tags
}

resource "aws_cloudwatch_metric_alarm" "stargazers_lambda_errors" {
  for_each = {
    stargazers = aws_lambda_function.stargazers.function_name,
  }

  alarm_name          = "${local.prefix}-lambda-errors-alarm-${each.key}-${local.short_uuid}"
  alarm_description   = "Lambda function failed once in the last 15 minutes."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 900
  datapoints_to_alarm = 1
  statistic           = "Sum"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  dimensions = {
    "FunctionName" = each.value
  }
  threshold          = 1
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