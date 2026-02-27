# API Gateway — Dashboard API (dev/us-east-1)
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

dependency "lambda_dashboard_api" {
  config_path = "../../lambda/dashboard-api"
  mock_outputs = {
    invoke_arn   = "arn:aws:apigateway:us-east-1:lambda:path/functions/mock/invocations"
    function_arn = "arn:aws:lambda:us-east-1:111111111111:function:mock"
  }
}

inputs = {
  api_name    = "${local.env}-mcq-dashboard-api"
  description = "Dashboard API — serves health data to the frontend"

  routes = {
    "GET /v1/health" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/clusters" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/services" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/deployments" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/test-runs" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/cluster-test-runs" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/scorecards" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/promotions" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/jira-tickets" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
    "GET /v1/qcd/metadata" = {
      lambda_invoke_arn   = dependency.lambda_dashboard_api.outputs.invoke_arn
      lambda_function_arn = dependency.lambda_dashboard_api.outputs.function_arn
    }
  }

  cors_allow_origins   = ["https://mcq.infosight.cloud", "https://dev.mcq.infosight.cloud", "http://localhost:5173"]
  throttle_burst_limit = 200
  throttle_rate_limit  = 100
}
