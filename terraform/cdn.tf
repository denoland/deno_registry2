locals {
  cdn_domain_name = "${local.domain_prefix}cdn.${trimsuffix(data.google_dns_managed_zone.dotland_dns_zone.dns_name, ".")}"
  cdn_origin_id   = "storage_bucket"
}

resource "aws_acm_certificate" "cdn_certificate" {
  domain_name               = local.cdn_domain_name
  subject_alternative_names = [local.cdn_domain_name]
  validation_method         = "DNS"

  options {
    certificate_transparency_logging_preference = "ENABLED"
  }
}

resource "aws_acm_certificate_validation" "cdn_certificate_validation" {
  certificate_arn         = aws_acm_certificate.cdn_certificate.arn
  validation_record_fqdns = [for record in google_dns_record_set.cdn_domain_validation_record : record.name]
}

resource "google_dns_record_set" "cdn_cname_record" {
  project      = data.google_dns_managed_zone.dotland_dns_zone.project
  managed_zone = data.google_dns_managed_zone.dotland_dns_zone.name
  name         = "${local.cdn_domain_name}."
  rrdatas      = ["${aws_cloudfront_distribution.cdn.domain_name}."]
  type         = "CNAME"
  ttl          = 3600
}

resource "google_dns_record_set" "cdn_domain_validation_record" {
  for_each = {
    for dv in aws_acm_certificate.cdn_certificate.domain_validation_options : dv.domain_name => dv
  }

  project      = data.google_dns_managed_zone.dotland_dns_zone.project
  managed_zone = data.google_dns_managed_zone.dotland_dns_zone.name
  name         = each.value.resource_record_name
  rrdatas      = [each.value.resource_record_value]
  type         = each.value.resource_record_type
  ttl          = 3600
}

resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.storage_bucket.bucket_domain_name
    origin_id   = local.cdn_origin_id
  }

  enabled         = true
  http_version    = "http2and3"
  is_ipv6_enabled = true
  price_class     = "PriceClass_All"

  aliases = [local.cdn_domain_name]

  default_cache_behavior {
    target_origin_id           = local.cdn_origin_id
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.cdn_cache_policy.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cdn_response_headers_policy.id
    viewer_protocol_policy     = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cdn_certificate_validation.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

data "aws_cloudfront_cache_policy" "cdn_cache_policy" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_response_headers_policy" "cdn_response_headers_policy" {
  name = "${local.prefix}-CORS-all-origins-CSP-strict-${local.short_uuid}"

  cors_config {
    access_control_allow_credentials = false
    access_control_allow_headers { items = ["*"] }
    access_control_allow_methods { items = ["GET", "HEAD"] }
    access_control_allow_origins { items = ["*"] }
    origin_override = false
  }

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
      override                = false
    }
  }
}
