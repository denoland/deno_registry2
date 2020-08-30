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
