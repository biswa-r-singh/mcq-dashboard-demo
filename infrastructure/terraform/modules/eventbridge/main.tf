###############################################################################
# EventBridge Module — Internal bus with rules + optional Firehose audit trail
###############################################################################

resource "aws_cloudwatch_event_bus" "this" {
  name = var.bus_name

  tags = merge(var.tags, {
    Module = "eventbridge"
  })
}

# EventBridge rules
resource "aws_cloudwatch_event_rule" "rules" {
  for_each = var.rules

  name           = each.key
  description    = each.value.description
  event_bus_name = aws_cloudwatch_event_bus.this.name
  event_pattern  = each.value.event_pattern

  tags = var.tags
}

# EventBridge targets
resource "aws_cloudwatch_event_target" "targets" {
  for_each = var.rules

  rule           = aws_cloudwatch_event_rule.rules[each.key].name
  event_bus_name = aws_cloudwatch_event_bus.this.name
  target_id      = "${each.key}-target"
  arn            = each.value.target_arn

  dynamic "dead_letter_config" {
    for_each = each.value.dlq_arn != null ? [1] : []
    content {
      arn = each.value.dlq_arn
    }
  }

  dynamic "retry_policy" {
    for_each = each.value.retry_max_age != null ? [1] : []
    content {
      maximum_event_age_in_seconds = each.value.retry_max_age
      maximum_retry_attempts       = each.value.retry_attempts
    }
  }
}

# Archive for replay capability
resource "aws_cloudwatch_event_archive" "this" {
  count            = var.enable_archive ? 1 : 0
  name             = "${var.bus_name}-archive"
  event_source_arn = aws_cloudwatch_event_bus.this.arn
  retention_days   = var.archive_retention_days

  description = "Archive for ${var.bus_name} events — replay capability"
}

# Lambda permissions — allow EventBridge to invoke the target Lambda(s)
locals {
  lambda_rules = { for k, v in var.rules : k => v if v.target_type == "lambda" }
}

resource "aws_lambda_permission" "eventbridge" {
  for_each = local.lambda_rules

  statement_id  = "AllowEventBridge-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.target_arn
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.rules[each.key].arn
}

###############################################################################
# Firehose Audit Trail — optional, streams all events to S3
###############################################################################

# Catch-all rule: route every event on the bus to Firehose
resource "aws_cloudwatch_event_rule" "audit" {
  count          = var.enable_audit_trail ? 1 : 0
  name           = "${var.bus_name}-audit-all"
  description    = "Route all events to Firehose audit trail"
  event_bus_name = aws_cloudwatch_event_bus.this.name
  event_pattern  = jsonencode({ "source" = [{ "prefix" = "" }] })
  tags           = var.tags
}

resource "aws_cloudwatch_event_target" "audit" {
  count          = var.enable_audit_trail ? 1 : 0
  rule           = aws_cloudwatch_event_rule.audit[0].name
  event_bus_name = aws_cloudwatch_event_bus.this.name
  target_id      = "firehose-audit"
  arn            = aws_kinesis_firehose_delivery_stream.audit[0].arn
  role_arn       = aws_iam_role.eventbridge_to_firehose[0].arn
}

# Firehose delivery stream
resource "aws_kinesis_firehose_delivery_stream" "audit" {
  count       = var.enable_audit_trail ? 1 : 0
  name        = var.audit_stream_name
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose[0].arn
    bucket_arn = aws_s3_bucket.audit[0].arn
    prefix     = var.audit_s3_prefix

    buffering_size     = var.audit_buffer_size_mb
    buffering_interval = var.audit_buffer_interval_seconds
    compression_format = "GZIP"

    error_output_prefix = "errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose[0].name
      log_stream_name = "S3Delivery"
    }
  }

  server_side_encryption {
    enabled  = true
    key_type = "AWS_OWNED_CMK"
  }

  tags = merge(var.tags, { Module = "firehose" })
}

# S3 bucket for audit data
resource "aws_s3_bucket" "audit" {
  count         = var.enable_audit_trail ? 1 : 0
  bucket        = var.audit_bucket_name
  force_destroy = var.audit_force_destroy

  tags = merge(var.tags, { Purpose = "audit-trail" })
}

resource "aws_s3_bucket_versioning" "audit" {
  count  = var.enable_audit_trail ? 1 : 0
  bucket = aws_s3_bucket.audit[0].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit" {
  count  = var.enable_audit_trail ? 1 : 0
  bucket = aws_s3_bucket.audit[0].id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "audit" {
  count  = var.enable_audit_trail ? 1 : 0
  bucket = aws_s3_bucket.audit[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "audit" {
  count  = var.enable_audit_trail ? 1 : 0
  bucket = aws_s3_bucket.audit[0].id

  rule {
    id     = "archive-old-data"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    expiration {
      days = max(var.audit_retention_days, 91)
    }
  }
}

# CloudWatch log group for Firehose
resource "aws_cloudwatch_log_group" "firehose" {
  count             = var.enable_audit_trail ? 1 : 0
  name              = "/aws/firehose/${var.audit_stream_name}"
  retention_in_days = 30
  tags              = var.tags
}

# IAM role for Firehose (S3 + CloudWatch)
resource "aws_iam_role" "firehose" {
  count = var.enable_audit_trail ? 1 : 0
  name  = "${var.audit_stream_name}-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "firehose.amazonaws.com" }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "firehose" {
  count = var.enable_audit_trail ? 1 : 0
  name  = "${var.audit_stream_name}-firehose-policy"
  role  = aws_iam_role.firehose[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:AbortMultipartUpload", "s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:ListBucketMultipartUploads", "s3:PutObject"]
        Resource = [aws_s3_bucket.audit[0].arn, "${aws_s3_bucket.audit[0].arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:PutLogEvents", "logs:CreateLogStream"]
        Resource = "${aws_cloudwatch_log_group.firehose[0].arn}:*"
      }
    ]
  })
}

# IAM role for EventBridge → Firehose
resource "aws_iam_role" "eventbridge_to_firehose" {
  count = var.enable_audit_trail ? 1 : 0
  name  = "${var.bus_name}-eb-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "eventbridge_to_firehose" {
  count = var.enable_audit_trail ? 1 : 0
  name  = "${var.bus_name}-eb-firehose-policy"
  role  = aws_iam_role.eventbridge_to_firehose[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["firehose:PutRecord", "firehose:PutRecordBatch"]
      Resource = aws_kinesis_firehose_delivery_stream.audit[0].arn
    }]
  })
}
