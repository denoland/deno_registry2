provider "aws" {
  region = "us-east-1"
}

provider "cloudflare" {
  account_id = var.cloudflare_account_id
}
