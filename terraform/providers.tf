provider "aws" {
  region = var.aws_default_region
}

provider "aws" {
  alias  = "backup"
  region = var.aws_backup_region
}

provider "google" {
  alias   = "dns"
  project = "misc-dns"
}

provider "mongodbatlas" {
  public_key  = var.mongodb_atlas_public_key
  private_key = var.mongodb_atlas_private_key
}
