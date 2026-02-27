# API Gateway — Ingestion API (dev/us-east-1)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${dirname(find_in_parent_folders("root.hcl"))}/../../../terraform/modules/api-gateway"
}

locals {
  root = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  env  = local.root.locals.environment
}

dependency "lambda_ingestion" {
  config_path = "../../lambda/ingestion-handler"
  mock_outputs = {
    invoke_arn   = "arn:aws:apigateway:us-east-1:lambda:path/functions/mock/invocations"
    function_arn = "arn:aws:lambda:us-east-1:111111111111:function:mock"
  }
}

inputs = {
  api_name    = "${local.env}-mcq-dashboard-ingestion-api"
  description = "Ingestion API — receives health data from collector pods"

  routes = {
    "POST /v1/ingest/platform-config" = {
      lambda_invoke_arn   = dependency.lambda_ingestion.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_ingestion.outputs.function_arn
    }
    "POST /v1/ingest/deployments" = {
      lambda_invoke_arn   = dependency.lambda_ingestion.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_ingestion.outputs.function_arn
    }
    "POST /v1/ingest/test-results" = {
      lambda_invoke_arn   = dependency.lambda_ingestion.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_ingestion.outputs.function_arn
    }
    "POST /v1/ingest/cluster-test-results" = {
      lambda_invoke_arn   = dependency.lambda_ingestion.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_ingestion.outputs.function_arn
    }
    "POST /v1/ingest/scorecards" = {
      lambda_invoke_arn   = dependency.lambda_ingestion.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_ingestion.outputs.function_arn
    }
  }

  cors_allow_origins   = ["*"]
  throttle_burst_limit = 100
  throttle_rate_limit  = 50
}
