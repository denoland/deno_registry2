variable "env" {
  description = "The deployment environment (prod, staging)"
  type        = string
}

variable "apiland_auth_token" {
  description = "Authorization token for using apiland webhook"
  type        = string
}

variable "aws_backup_region" {
  description = "The AWS region used for backups"
  type        = string
}

variable "aws_default_region" {
  description = "The AWS regio used for most of the infrastructure"
  type        = string
}

variable "docker_tag" {
  description = "ECR image tag"
  type        = string
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
}

variable "google_private_key" {
  description = "GCP private key"
  type        = string
}
variable "google_private_key_id" {
  description = "GCP private key ID"
  type        = string
}

variable "google_client_email" {
  description = "GCP client email"
  type        = string
}

variable "google_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "mongodb_atlas_org_id" {
  description = "Organization ID for MongoDB Atlas"
  type        = string
}

variable "mongodb_atlas_private_key" {
  description = "Private key for MongoDB Atlas"
  type        = string
  nullable    = true
  # If left unspecified, the MongoDB Atlas provider will use the environment
  # variable MONGODB_ATLAS_PRIVATE_KEY.
  default = null
}

variable "mongodb_atlas_public_key" {
  description = "Public key for MongoDB Atlas"
  type        = string
  nullable    = true
  sensitive   = true
  # If left unspecified, the MongoDB Atlas provider will use the environment
  # variable MONGODB_ATLAS_PUBLIC_KEY.
  default = null
}

variable "sqs_visibility_delay" {
  description = "SQS delay before messages become visible again"
  type        = number
  default     = 301
}
