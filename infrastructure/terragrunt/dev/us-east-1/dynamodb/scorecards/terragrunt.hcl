# DynamoDB — Scorecards table (dev/us-east-1)
# Stores: scorecard weights, per-service scores, jira tickets
# pk: WEIGHTS | SERVICE#<serviceId>
# sk: CURRENT | JIRA#<ticketKey>
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
  table_name = "${local.env}-mcq-scorecards"
  hash_key   = "pk"
  range_key  = "sk"

  attributes = [
    { name = "pk", type = "S" },
    { name = "sk", type = "S" },
  ]

  point_in_time_recovery = true
}
