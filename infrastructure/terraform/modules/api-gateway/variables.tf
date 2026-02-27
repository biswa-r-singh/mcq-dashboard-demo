variable "api_name" {
  description = "API Gateway name"
  type        = string
}

variable "description" {
  description = "API description"
  type        = string
  default     = ""
}

variable "routes" {
  description = "Map of route_key => { lambda_invoke_arn, lambda_function_arn, authorization_type, authorizer_id }"
  type = map(object({
    lambda_invoke_arn   = string
    lambda_function_arn = string
    authorization_type  = optional(string, "NONE")
    authorizer_id       = optional(string)
  }))
  default = {}
}

variable "cors_allow_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allow_methods" {
  description = "CORS allowed methods"
  type        = list(string)
  default     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}

variable "cors_allow_headers" {
  description = "CORS allowed headers"
  type        = list(string)
  default     = ["Content-Type", "Authorization", "X-Api-Key"]
}

variable "cors_expose_headers" {
  description = "CORS expose headers"
  type        = list(string)
  default     = []
}

variable "cors_max_age" {
  description = "CORS max age in seconds"
  type        = number
  default     = 3600
}

variable "cors_allow_credentials" {
  description = "CORS allow credentials"
  type        = bool
  default     = false
}

variable "throttle_burst_limit" {
  description = "API throttle burst limit"
  type        = number
  default     = 100
}

variable "throttle_rate_limit" {
  description = "API throttle rate limit"
  type        = number
  default     = 50
}

variable "integration_timeout" {
  description = "Integration timeout in milliseconds"
  type        = number
  default     = 29000
}

variable "log_retention_days" {
  description = "CloudWatch log retention days"
  type        = number
  default     = 30
}

variable "custom_domain_name" {
  description = "Custom domain name for the API"
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = null
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
