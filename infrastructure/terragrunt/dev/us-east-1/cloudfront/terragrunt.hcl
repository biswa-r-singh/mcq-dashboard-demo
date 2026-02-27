# CloudFront — ACM + CloudFront + Route53 (dev/us-east-1)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${dirname(find_in_parent_folders("root.hcl"))}/../../../terraform/modules/cloudfront"
}

locals {
  root = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  env  = local.root.locals.environment
}

dependency "s3_website" {
  config_path = "../s3-website"
  mock_outputs = {
    bucket_id                   = "mcq-dashboard-frontend-dev"
    bucket_regional_domain_name = "mock-bucket.s3.us-east-1.amazonaws.com"
  }
}

dependency "api_gateway_dashboard" {
  config_path = "../api-gateway/dashboard"
  mock_outputs = {
    api_endpoint = "https://mock.execute-api.us-east-1.amazonaws.com"
  }
}

dependency "waf" {
  config_path = "../waf/cloudfront"
  mock_outputs = {
    web_acl_arn = "arn:aws:wafv2:us-east-1:111111111111:global/webacl/mock/mock"
  }
}

inputs = {
  # Domain / Certificate
  domain_name               = local.root.locals.domain_name
  hosted_zone_name          = "mcq.infosight.cloud"
  subject_alternative_names = ["*.${local.root.locals.domain_name}"]

  # CloudFront
  project_name                   = "${local.env}-mcq-dashboard"
  description                    = "MCQ Dashboard CDN (${local.env})"
  s3_bucket_regional_domain_name = dependency.s3_website.outputs.bucket_regional_domain_name
  s3_bucket_id                   = dependency.s3_website.outputs.bucket_id
  api_gateway_endpoint           = dependency.api_gateway_dashboard.outputs.api_endpoint
  waf_web_acl_arn                = dependency.waf.outputs.web_acl_arn
  price_class                    = "PriceClass_100"

  # Route53
  enable_health_check = true
  health_check_path   = "/v1/health"
}
