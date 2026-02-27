# ─── ACM ──────────────────────────────────────────────────────────────────────

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = aws_acm_certificate.this.arn
}

output "certificate_domain_name" {
  description = "ACM certificate domain name"
  value       = aws_acm_certificate.this.domain_name
}

# ─── CloudFront ──────────────────────────────────────────────────────────────

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.this.arn
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.this.domain_name
}

output "distribution_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  value       = aws_cloudfront_distribution.this.hosted_zone_id
}

output "oac_id" {
  description = "Origin Access Control ID"
  value       = aws_cloudfront_origin_access_control.this.id
}

# ─── Route53 ─────────────────────────────────────────────────────────────────

output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = data.aws_route53_zone.this.zone_id
}

output "cloudfront_record_fqdn" {
  description = "CloudFront A-record FQDN"
  value       = aws_route53_record.cloudfront_alias.fqdn
}

output "health_check_id" {
  description = "Route53 health check ID"
  value       = var.enable_health_check ? aws_route53_health_check.primary[0].id : null
}
