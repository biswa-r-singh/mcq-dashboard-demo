# ─── Domain / Certificate ────────────────────────────────────────────────────

variable "domain_name" {
  description = "Primary domain name (e.g. dev.dashboard.mcq.infosight.cloud)"
  type        = string
}

variable "hosted_zone_name" {
  description = "Existing Route53 hosted zone name for DNS records"
  type        = string
  default     = "infosight.cloud"
}

variable "subject_alternative_names" {
  description = "ACM certificate subject alternative names"
  type        = list(string)
  default     = []
}

# ─── CloudFront ──────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "description" {
  description = "CloudFront distribution description"
  type        = string
  default     = "MCQ Dashboard CDN"
}

variable "s3_bucket_regional_domain_name" {
  description = "S3 bucket regional domain name (origin)"
  type        = string
}

variable "s3_bucket_id" {
  description = "S3 bucket ID/name for OAC bucket policy"
  type        = string
  default     = null
}

variable "api_gateway_endpoint" {
  description = "API Gateway endpoint URL (optional, for /v1/* API origin)"
  type        = string
  default     = null
}

variable "waf_web_acl_arn" {
  description = "WAF Web ACL ARN for CloudFront"
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

variable "geo_restriction_locations" {
  description = "Country codes for geo restriction whitelist (empty = no restriction)"
  type        = list(string)
  default     = []
}

# ─── Route53 ─────────────────────────────────────────────────────────────────

variable "enable_health_check" {
  description = "Enable Route53 HTTPS health check"
  type        = bool
  default     = false
}

variable "health_check_path" {
  description = "Health check resource path"
  type        = string
  default     = "/v1/health"
}

# ─── Common ──────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
