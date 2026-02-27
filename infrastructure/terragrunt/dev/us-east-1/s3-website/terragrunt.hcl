# S3 Website Hosting (dev/us-east-1)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${dirname(find_in_parent_folders("root.hcl"))}/../../../terraform/modules/s3-website"
}

locals {
  root = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  env  = local.root.locals.environment
}

# NOTE: No dependency on cloudfront to avoid circular dep.
# CloudFront module creates the OAC bucket policy via its own config.

inputs = {
  bucket_name        = "${local.env}-mcq-dashboard-frontend"
  force_destroy      = true # dev only
  enable_replication = false
}
