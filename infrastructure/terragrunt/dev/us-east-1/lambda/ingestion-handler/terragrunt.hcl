# Lambda — Ingestion Handler (dev/us-east-1)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${dirname(find_in_parent_folders("root.hcl"))}/../../../terraform/modules/lambda"
}

locals {
  root = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  env  = local.root.locals.environment
}

# NOTE: No dependency on api-gateway-ingestion to avoid circular dep.
# The API GW module creates the Lambda permission via its own resource.

dependency "dynamodb_api_keys" {
  config_path = "../../dynamodb/api-keys"
  mock_outputs = {
    table_arn  = "arn:aws:dynamodb:us-east-1:111111111111:table/mock"
    table_name = "dev-mcq-api-keys"
  }
}

dependency "eventbridge" {
  config_path = "../../eventbridge"
  mock_outputs = {
    bus_arn  = "arn:aws:events:us-east-1:111111111111:event-bus/mock"
    bus_name = "mcq-dashboard-bus-dev"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  function_name = "${local.env}-mcq-dashboard-ingestion-handler"
  description   = "Validates and ingests health data from collector pods"
  source_dir    = "${dirname(find_in_parent_folders("root.hcl"))}/../../../lambdas/ingestion-handler"
  handler       = "index.handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 256

  environment_variables = {
    API_KEYS_TABLE = dependency.dynamodb_api_keys.outputs.table_name
    EVENT_BUS_NAME = dependency.eventbridge.outputs.bus_name
  }

  custom_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem"]
        Resource = [dependency.dynamodb_api_keys.outputs.table_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [dependency.eventbridge.outputs.bus_arn]
      }
    ]
  })
}
