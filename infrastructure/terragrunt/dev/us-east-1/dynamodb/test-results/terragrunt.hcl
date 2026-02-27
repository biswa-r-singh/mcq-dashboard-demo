# DynamoDB — Test Results table (dev/us-east-1)
# Stores: attempt-level test runs + cluster-level test runs
# pk: ATTEMPT#<attemptId> or CLUSTER#<clusterRegionId>
# sk: <suiteType>#<executedAt>
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
  table_name = "${local.env}-mcq-test-results"
  hash_key   = "pk"
  range_key  = "sk"

  attributes = [
    { name = "pk", type = "S" },
    { name = "sk", type = "S" },
    { name = "suiteType", type = "S" },
  ]

  global_secondary_indexes = [
    { name = "suiteType-index", hash_key = "suiteType", range_key = "sk" }
  ]

  point_in_time_recovery = true
  ttl_attribute          = "expiresAt"
}
