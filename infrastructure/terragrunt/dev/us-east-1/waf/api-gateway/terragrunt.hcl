# WAF — API Gateway (REGIONAL scope) (dev/us-east-1)
# SKIPPED: WAFv2 does not support API Gateway v2 HTTP APIs.
# The dashboard API is protected via the CloudFront WAF.
# The ingestion API uses built-in API Gateway throttling + API key validation.
skip = true

include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${dirname(find_in_parent_folders("root.hcl"))}/../../../terraform/modules/waf"
}

locals {
  root = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  env  = local.root.locals.environment
}

inputs = {
  web_acl_name     = "${local.env}-mcq-dashboard-waf-api"
  description      = "WAF for MCQ Ingestion API - ${local.env}"
  scope            = "REGIONAL"
  rate_limit       = 1000
  max_payload_size = 262144
  enable_logging   = true
}
