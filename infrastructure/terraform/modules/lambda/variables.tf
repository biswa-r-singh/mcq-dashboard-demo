variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "description" {
  description = "Lambda function description"
  type        = string
  default     = ""
}

variable "source_dir" {
  description = "Path to the Lambda source directory"
  type        = string
}

variable "handler" {
  description = "Lambda handler (e.g. index.handler)"
  type        = string
  default     = "index.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "python3.12"
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 256
}

variable "reserved_concurrency" {
  description = "Reserved concurrent executions (-1 for unreserved)"
  type        = number
  default     = -1
}

variable "environment_variables" {
  description = "Environment variables for the Lambda"
  type        = map(string)
  default     = {}
}

variable "dlq_arn" {
  description = "ARN of the dead letter queue (SQS or SNS)"
  type        = string
  default     = null
}

variable "subnet_ids" {
  description = "VPC subnet IDs for the Lambda"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "VPC security group IDs for the Lambda"
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "log_kms_key_arn" {
  description = "KMS key ARN for CloudWatch log encryption"
  type        = string
  default     = null
}

variable "custom_policy_json" {
  description = "Custom IAM policy JSON to attach to the Lambda role"
  type        = string
  default     = null
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
