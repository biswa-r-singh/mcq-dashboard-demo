variable "bus_name" {
  description = "EventBridge bus name"
  type        = string
}

variable "rules" {
  description = "Map of rule_name => { description, event_pattern, target_arn, dlq_arn, retry_max_age, retry_attempts }"
  type = map(object({
    description    = string
    event_pattern  = string
    target_arn     = string
    target_type    = optional(string, "lambda")
    dlq_arn        = optional(string)
    retry_max_age  = optional(number, 86400)
    retry_attempts = optional(number, 3)
  }))
  default = {}
}

variable "enable_archive" {
  description = "Enable event archive for replay"
  type        = bool
  default     = true
}

variable "archive_retention_days" {
  description = "Archive retention in days (0 = indefinite)"
  type        = number
  default     = 90
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# --- Firehose audit trail variables ---

variable "enable_audit_trail" {
  description = "Enable Firehose audit trail — streams all bus events to S3"
  type        = bool
  default     = false
}

variable "audit_stream_name" {
  description = "Firehose delivery stream name for audit"
  type        = string
  default     = null
}

variable "audit_bucket_name" {
  description = "S3 bucket name for audit data"
  type        = string
  default     = null
}

variable "audit_s3_prefix" {
  description = "S3 key prefix for delivered audit data"
  type        = string
  default     = "audit/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
}

variable "audit_buffer_size_mb" {
  description = "Firehose buffer size in MB before delivery"
  type        = number
  default     = 5
}

variable "audit_buffer_interval_seconds" {
  description = "Firehose buffer interval in seconds before delivery"
  type        = number
  default     = 300
}

variable "audit_retention_days" {
  description = "Days to retain audit data in S3 before expiry"
  type        = number
  default     = 365
}

variable "audit_force_destroy" {
  description = "Allow force destroy of audit S3 bucket"
  type        = bool
  default     = false
}
