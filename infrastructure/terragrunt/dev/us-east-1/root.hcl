###############################################################################
# Region Root — dev / us-east-1
# Self-contained: account, env, region, provider, backend, versions
# All component terragrunt.hcl files under this directory inherit from this.
###############################################################################

terraform_version_constraint  = ">= 1.10.0"
terragrunt_version_constraint = ">= 0.67.0"

locals {
  # Project configuration
  project_name   = "mcq-dashboard"
  environment    = "dev"
  aws_region     = "us-east-1"
  aws_account_id = "326869539878"
  iam_role_name  = "HOP-ADMIN"

  # Domain
  domain_name = "dev.dashboard.mcq.infosight.cloud"

  # Region failover
  primary_region = "us-east-1"
  dr_region      = "us-west-2"

  # Common tags
  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    Region      = local.aws_region
    ManagedBy   = "Terragrunt"
    Owner       = "biswa-r-singh"
    Terraform   = "true"
  }
}

# Generate Terraform version constraints
generate "versions" {
  path      = "versions.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.82"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}
EOF
}

# Generate AWS provider configuration
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "${local.aws_region}"

  allowed_account_ids = ["${local.aws_account_id}"]

  max_retries = 3

  default_tags {
    tags = ${jsonencode(local.common_tags)}
  }
}
EOF
}

# IAM role to assume
iam_role = "arn:aws:iam::${local.aws_account_id}:role/${local.iam_role_name}"

# Configure remote state
remote_state {
  backend = "s3"
  config = {
    encrypt = true
    bucket  = "${local.project_name}-${local.environment}-${local.aws_region}-tfstate-${local.aws_account_id}"
    key     = "${path_relative_to_include()}/terraform.tfstate"
    region  = local.aws_region

    s3_bucket_tags = merge(
      local.common_tags,
      {
        Name = "${local.project_name}-${local.environment}-${local.aws_region}-tfstate-${local.aws_account_id}"
      }
    )
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

# Common inputs for all modules
inputs = {
  tags = local.common_tags
}
