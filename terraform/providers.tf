provider "aws" {
  region = var.region
}

provider "aws" {
  alias  = "backup"
  region = var.backup_region
}

provider "google" {
  alias = "dns"
}
