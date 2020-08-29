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

provider "mongodbatlas" {
  public_key  = var.atlas_public_key
  private_key = var.atlas_private_key
}
