resource "mongodbatlas_project" "this" {
  name   = "${local.prefix}-${local.short_uuid}"
  org_id = var.atlas_org_id
}

resource "mongodbatlas_cluster" "main" {
  project_id = mongodbatlas_project.this.id
  name       = "main"

  provider_name               = "TENANT"
  backing_provider_name       = "AWS"
  provider_region_name        = "US_EAST_1"
  provider_instance_size_name = "M2"
  disk_size_gb                = 2

  mongo_db_major_version       = "4.4"
  auto_scaling_disk_gb_enabled = "false"
}

resource "mongodbatlas_project_ip_whitelist" "main" {
  project_id = mongodbatlas_project.this.id
  cidr_block = "0.0.0.0/0"
  comment    = "Access everywhere"
}

resource "random_password" "atlas_lambda" {
  length           = 16
  special          = true
  override_special = "_%@"
}

resource "mongodbatlas_database_user" "lambda" {
  username           = "lambda"
  password           = random_password.atlas_lambda.result
  project_id         = mongodbatlas_project.this.id
  auth_database_name = "admin"

  roles {
    role_name     = "dbAdmin"
    database_name = "production"
  }

  roles {
    role_name     = "readWrite"
    database_name = "production"
  }

}


locals {
  mongodb_uri = replace(
    mongodbatlas_cluster.main.connection_strings[0].standard_srv,
    "mongodb+srv://",
    "mongodb+srv://${mongodbatlas_database_user.lambda.username}:${mongodbatlas_database_user.lambda.password}@"
  )
}
