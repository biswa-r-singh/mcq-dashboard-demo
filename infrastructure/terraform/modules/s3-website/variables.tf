variable "bucket_name" {
  description = "S3 bucket name for website hosting"
  type        = string
}

variable "force_destroy" {
  description = "Allow force destroy of bucket"
  type        = bool
  default     = false
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
  default     = null
}

variable "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN for OAC policy (optional — if null, policy is managed externally)"
  type        = string
  default     = null
}

variable "enable_replication" {
  description = "Enable cross-region replication for DR"
  type        = bool
  default     = false
}

variable "replication_role_arn" {
  description = "IAM role ARN for S3 replication"
  type        = string
  default     = null
}

variable "replication_destination_bucket_arn" {
  description = "Destination bucket ARN for replication"
  type        = string
  default     = null
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
