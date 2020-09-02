provider "aws" {
  region = var.region
}

provider "cloudflare" {
  account_id = var.cloudflare_account_id
}
