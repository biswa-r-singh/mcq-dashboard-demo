# WAF — CloudFront (CLOUDFRONT scope) (dev/us-east-1)
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
  web_acl_name     = "${local.env}-mcq-dashboard-waf-cf"
  description      = "WAF for MCQ Dashboard CloudFront - ${local.env}"
  scope            = "CLOUDFRONT"
  rate_limit       = 2000
  max_payload_size = 262144
  enable_logging   = true
}
