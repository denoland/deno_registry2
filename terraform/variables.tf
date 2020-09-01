variable "mongodb_uri" {
  description = "MongoDB conection string"
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

variable "domain" {
  description = "The domain that hosts the api."
  type        = string
}

variable "certificate_arn" {
  type        = string
  description = "The certificate arn for the domain."
}

variable "cloudflare_account_id" {
  description = "The account id for the Cloudflare account holding the zone for this domain."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "The zone id for the Cloudflare zone for this domain."
  type        = string
}
