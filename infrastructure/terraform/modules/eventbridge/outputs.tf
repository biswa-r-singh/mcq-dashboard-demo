output "bus_name" {
  description = "EventBridge bus name"
  value       = aws_cloudwatch_event_bus.this.name
}

output "bus_arn" {
  description = "EventBridge bus ARN"
  value       = aws_cloudwatch_event_bus.this.arn
}

output "rule_arns" {
  description = "Map of rule name to rule ARN"
  value       = { for k, v in aws_cloudwatch_event_rule.rules : k => v.arn }
}

# Firehose audit trail outputs
output "audit_stream_arn" {
  description = "Firehose audit delivery stream ARN"
  value       = var.enable_audit_trail ? aws_kinesis_firehose_delivery_stream.audit[0].arn : null
}

output "audit_stream_name" {
  description = "Firehose audit delivery stream name"
  value       = var.enable_audit_trail ? aws_kinesis_firehose_delivery_stream.audit[0].name : null
}

output "audit_bucket_arn" {
  description = "Audit S3 bucket ARN"
  value       = var.enable_audit_trail ? aws_s3_bucket.audit[0].arn : null
}

output "audit_bucket_id" {
  description = "Audit S3 bucket ID"
  value       = var.enable_audit_trail ? aws_s3_bucket.audit[0].id : null
}
