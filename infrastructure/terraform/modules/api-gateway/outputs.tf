output "api_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "execution_arn" {
  description = "API Gateway execution ARN"
  value       = aws_apigatewayv2_api.this.execution_arn
}

output "stage_id" {
  description = "Default stage ID"
  value       = aws_apigatewayv2_stage.default.id
}

output "custom_domain_target" {
  description = "Custom domain target domain name (for DNS CNAME/alias)"
  value       = var.custom_domain_name != null ? aws_apigatewayv2_domain_name.this[0].domain_name_configuration[0].target_domain_name : null
}

output "custom_domain_hosted_zone_id" {
  description = "Custom domain hosted zone ID (for Route53 alias)"
  value       = var.custom_domain_name != null ? aws_apigatewayv2_domain_name.this[0].domain_name_configuration[0].hosted_zone_id : null
}
