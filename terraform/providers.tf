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
