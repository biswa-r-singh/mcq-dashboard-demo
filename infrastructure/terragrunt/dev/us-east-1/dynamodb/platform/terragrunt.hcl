# DynamoDB — Platform table (dev/us-east-1)
# Stores: clusters, cluster-regions, roles, services, currentRunning, config
# pk pattern: CLUSTER#<id> | REGION#<id> | SERVICE#<id> | RUNNING#<crId> | CONFIG#<key>
# sk pattern: META | <detail key>
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
  table_name = "${local.env}-mcq-platform"
  hash_key   = "pk"
  range_key  = "sk"

  attributes = [
    { name = "pk", type = "S" },
    { name = "sk", type = "S" },
    { name = "itemType", type = "S" },
  ]

  global_secondary_indexes = [
    { name = "itemType-index", hash_key = "itemType", range_key = "pk" }
  ]

  point_in_time_recovery = true
}
