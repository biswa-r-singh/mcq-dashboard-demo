###############################################################################
# API Gateway v2 (HTTP API) Module
###############################################################################

resource "aws_apigatewayv2_api" "this" {
  name          = var.api_name
  description   = var.description
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = var.cors_allow_origins
    allow_methods     = var.cors_allow_methods
    allow_headers     = var.cors_allow_headers
    expose_headers    = var.cors_expose_headers
    max_age           = var.cors_max_age
    allow_credentials = var.cors_allow_credentials
  }

  tags = merge(var.tags, {
    Module = "api-gateway"
  })
}

# Default stage with auto-deploy
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit = var.throttle_burst_limit
    throttling_rate_limit  = var.throttle_rate_limit
  }

  tags = var.tags
}

# CloudWatch log group for API Gateway
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${var.api_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Lambda integrations
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = var.routes

  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.lambda_invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = var.integration_timeout
}

# Routes
resource "aws_apigatewayv2_route" "routes" {
  for_each = var.routes

  api_id             = aws_apigatewayv2_api.this.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.lambda[each.key].id}"
  authorization_type = lookup(each.value, "authorization_type", "NONE")
  authorizer_id      = lookup(each.value, "authorizer_id", null)
}

# Custom domain name (optional)
resource "aws_apigatewayv2_domain_name" "this" {
  count       = var.custom_domain_name != null ? 1 : 0
  domain_name = var.custom_domain_name

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = var.tags
}

# API mapping for custom domain
resource "aws_apigatewayv2_api_mapping" "this" {
  count       = var.custom_domain_name != null ? 1 : 0
  api_id      = aws_apigatewayv2_api.this.id
  domain_name = aws_apigatewayv2_domain_name.this[0].id
  stage       = aws_apigatewayv2_stage.default.id
}

# Lambda permissions — allow API Gateway to invoke the target Lambda(s)
# Deduplicate: multiple routes may point to the same Lambda
locals {
  lambda_arns = distinct([for k, v in var.routes : v.lambda_function_arn])
}

resource "aws_lambda_permission" "apigw" {
  for_each = toset(local.lambda_arns)

  statement_id  = "AllowAPIGatewayInvoke-${md5(each.value)}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*"
}

# NOTE: WAFv2 does not support API Gateway v2 HTTP APIs.
# The dashboard API is protected via the CloudFront WAF association.
# The ingestion API relies on built-in API Gateway throttling + API key validation.
