# DynamoDB — Deployments table (dev/us-east-1)
# Stores: deployment attempts — high-volume, multi-access-pattern
# pk: <clusterId>#<serviceId>    sk: <startedAt>#<attemptId>
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${dirname(find_in_parent_folders("root.hcl"))}/../../../terraform/modules/dynamodb"
}

locals {
  root = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  env  = local.root.locals.environment
}

inputs = {
  table_name = "${local.env}-mcq-deployments"
  hash_key   = "pk"
  range_key  = "sk"

  attributes = [
    { name = "pk", type = "S" },
    { name = "sk", type = "S" },
    { name = "clusterId", type = "S" },
    { name = "serviceId", type = "S" },
  ]

  global_secondary_indexes = [
    { name = "clusterId-index", hash_key = "clusterId", range_key = "sk" },
    { name = "serviceId-index", hash_key = "serviceId", range_key = "sk" },
  ]

  point_in_time_recovery = true
  ttl_attribute          = "expiresAt"
}
