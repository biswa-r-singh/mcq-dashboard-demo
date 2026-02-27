# EventBridge — Internal bus (dev/us-east-1)
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${dirname(find_in_parent_folders("root.hcl"))}/../../../terraform/modules/eventbridge"
}

locals {
  root = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  env  = local.root.locals.environment
}

dependency "qcd_processor" {
  config_path = "../lambda/qcd-processor"
  mock_outputs = {
    function_arn = "arn:aws:lambda:us-east-1:111111111111:function:mock"
  }
}

inputs = {
  bus_name = "${local.env}-mcq-dashboard-bus"

  rules = {
    "platform-config-rule" = {
      description = "Route platform config events to QCD processor"
      event_pattern = jsonencode({
        source      = ["mcq.dashboard.ingestion"]
        detail-type = ["dashboard.platform.config.updated"]
      })
      target_arn = dependency.qcd_processor.outputs.function_arn
    }

    "deployments-rule" = {
      description = "Route deployment events to QCD processor"
      event_pattern = jsonencode({
        source      = ["mcq.dashboard.ingestion"]
        detail-type = ["dashboard.deployments.reported"]
      })
      target_arn = dependency.qcd_processor.outputs.function_arn
    }

    "test-results-rule" = {
      description = "Route test result events to QCD processor"
      event_pattern = jsonencode({
        source      = ["mcq.dashboard.ingestion"]
        detail-type = ["dashboard.test-results.reported"]
      })
      target_arn = dependency.qcd_processor.outputs.function_arn
    }

    "cluster-test-results-rule" = {
      description = "Route cluster test result events to QCD processor"
      event_pattern = jsonencode({
        source      = ["mcq.dashboard.ingestion"]
        detail-type = ["dashboard.cluster-test-results.reported"]
      })
      target_arn = dependency.qcd_processor.outputs.function_arn
    }

    "scorecards-rule" = {
      description = "Route scorecard events to QCD processor"
      event_pattern = jsonencode({
        source      = ["mcq.dashboard.ingestion"]
        detail-type = ["dashboard.scorecards.updated"]
      })
      target_arn = dependency.qcd_processor.outputs.function_arn
    }
  }

  enable_archive         = true
  archive_retention_days = 30

  # Firehose audit trail — streams all events to S3
  enable_audit_trail   = true
  audit_stream_name    = "${local.env}-mcq-dashboard-audit"
  audit_bucket_name    = "${local.env}-mcq-dashboard-audit"
  audit_retention_days = 90
  audit_force_destroy  = true
}
