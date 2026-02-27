# DynamoDB — API Keys table (dev/us-east-1)
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
  table_name = "${local.env}-mcq-api-keys"
  hash_key   = "apiKeyHash"

  attributes = [
    { name = "apiKeyHash", type = "S" },
    { name = "accountId", type = "S" },
  ]

  global_secondary_indexes = [
    { name = "accountId-index", hash_key = "accountId" }
  ]

  point_in_time_recovery = true
  ttl_attribute          = "expiresAt"
}
