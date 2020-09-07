provider "aws" {
  region = var.region
}

provider "cloudflare" {
  account_id = var.cloudflare_account_id
}

provider "aws" {
  alias  = "backup"
  region = var.backup_region
}
