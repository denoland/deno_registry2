variable "region" {
  description = "the AWS region"
  type        = string
}

variable "backup_region" {
  description = "the AWS region used for backups"
  type        = string
}

variable "mongodb_uri" {
  description = "MongoDB connection string"
  type        = string
}

variable "apiland_auth_token" {
  description = "Authorization token for using apiland webhook"
  type        = string
}

variable "sqs_visibility_delay" {
  description = "SQS delay before messages become visible again"
  type        = number
  default     = 301
}

variable "env" {
  description = "the deployment environment (prod, staging)"
  type        = string
}

variable "docker_tag" {
  description = "ECR image tag"
  type        = string
}

variable "cdn_domain" {
  description = "The domain that hosts the registry CDN."
  type        = string
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
}
