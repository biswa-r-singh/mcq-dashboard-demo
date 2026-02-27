variable "web_acl_name" {
  description = "WAF Web ACL name"
  type        = string
}

variable "description" {
  description = "WAF Web ACL description"
  type        = string
  default     = "WAF protection for MCQ Dashboard"
}

variable "scope" {
  description = "WAF scope: REGIONAL or CLOUDFRONT"
  type        = string
  default     = "REGIONAL"

  validation {
    condition     = contains(["REGIONAL", "CLOUDFRONT"], var.scope)
    error_message = "Scope must be REGIONAL or CLOUDFRONT."
  }
}

variable "rate_limit" {
  description = "Rate limit per 5-minute window per IP"
  type        = number
  default     = 2000
}

variable "max_payload_size" {
  description = "Maximum payload size in bytes"
  type        = number
  default     = 262144 # 256 KB
}

variable "ip_set_arn" {
  description = "IP set ARN for allowlist rule (optional)"
  type        = string
  default     = null
}

variable "enable_logging" {
  description = "Enable WAF logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "WAF log retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
