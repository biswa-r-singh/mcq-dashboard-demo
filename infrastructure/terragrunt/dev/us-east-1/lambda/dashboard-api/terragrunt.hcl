# Lambda — Dashboard API (dev/us-east-1)
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

dependency "dynamodb_platform" {
  config_path = "../../dynamodb/platform"
  mock_outputs = {
    table_arn  = "arn:aws:dynamodb:us-east-1:111111111111:table/mock-platform"
    table_name = "dev-mcq-platform"
  }
}

dependency "dynamodb_deployments" {
  config_path = "../../dynamodb/deployments"
  mock_outputs = {
    table_arn  = "arn:aws:dynamodb:us-east-1:111111111111:table/mock-deployments"
    table_name = "dev-mcq-deployments"
  }
}

dependency "dynamodb_test_results" {
  config_path = "../../dynamodb/test-results"
  mock_outputs = {
    table_arn  = "arn:aws:dynamodb:us-east-1:111111111111:table/mock-test-results"
    table_name = "dev-mcq-test-results"
  }
}

dependency "dynamodb_scorecards" {
  config_path = "../../dynamodb/scorecards"
  mock_outputs = {
    table_arn  = "arn:aws:dynamodb:us-east-1:111111111111:table/mock-scorecards"
    table_name = "dev-mcq-scorecards"
  }
}

# NOTE: No dependency on api-gateway-dashboard to avoid circular dep.
# The API GW module creates the Lambda permission via its own resource.

inputs = {
  function_name = "${local.env}-mcq-dashboard-api"
  description   = "Dashboard API — serves data to the frontend"
  source_dir    = "${dirname(find_in_parent_folders("root.hcl"))}/../../../lambdas/dashboard-api"
  handler       = "index.handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 256

  environment_variables = {
    PLATFORM_TABLE     = dependency.dynamodb_platform.outputs.table_name
    DEPLOYMENTS_TABLE  = dependency.dynamodb_deployments.outputs.table_name
    TEST_RESULTS_TABLE = dependency.dynamodb_test_results.outputs.table_name
    SCORECARDS_TABLE   = dependency.dynamodb_scorecards.outputs.table_name
  }

  custom_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          dependency.dynamodb_platform.outputs.table_arn,
          "${dependency.dynamodb_platform.outputs.table_arn}/index/*",
          dependency.dynamodb_deployments.outputs.table_arn,
          "${dependency.dynamodb_deployments.outputs.table_arn}/index/*",
          dependency.dynamodb_test_results.outputs.table_arn,
          "${dependency.dynamodb_test_results.outputs.table_arn}/index/*",
          dependency.dynamodb_scorecards.outputs.table_arn,
          "${dependency.dynamodb_scorecards.outputs.table_arn}/index/*",
        ]
      }
    ]
  })
}
