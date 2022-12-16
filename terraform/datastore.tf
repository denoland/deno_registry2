resource "aws_ssm_parameter" "google_private_key" {
  name        = "${local.prefix}-google-private-key-${local.short_uuid}"
  description = "GCP private key"
  type        = "SecureString"
  value       = var.google_private_key
  tags        = local.tags
}

resource "aws_ssm_parameter" "google_private_key_id" {
  name        = "${local.prefix}-google-private-key-id-${local.short_uuid}"
  description = "GCP private key ID"
  type        = "SecureString"
  value       = var.google_private_key_id
  tags        = local.tags
}

resource "aws_ssm_parameter" "google_client_email" {
  name        = "${local.prefix}-google-client-email-${local.short_uuid}"
  description = "GCP client email"
  type        = "SecureString"
  value       = var.google_client_email
  tags        = local.tags
}

resource "aws_ssm_parameter" "google_project_id" {
  name        = "${local.prefix}-google-project-id-${local.short_uuid}"
  description = "GCP project ID"
  type        = "SecureString"
  value       = var.google_project_id
  tags        = local.tags
}

