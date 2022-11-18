locals {
  mongodb_database_name = var.env == "prod" ? "production" : var.env == "staging" ? "staging" : var.env

  mongodb_region_name = upper(replace(var.aws_default_region, "-", "_"))

  mongodb_host = split("://", mongodbatlas_cluster.mongodb_cluster.connection_strings[0].standard_srv)[1]
  mongodb_uri  = "mongodb+srv://${mongodbatlas_database_user.mongodb_user_lambda.username}:${mongodbatlas_database_user.mongodb_user_lambda.password}@${local.mongodb_host}/${local.mongodb_database_name}?authMechanism=SCRAM-SHA-1&authSource=${mongodbatlas_database_user.mongodb_user_lambda.auth_database_name}&retryWrites=true&w=majority"
}

resource "mongodbatlas_project" "mongodb_project" {
  name   = "deno-registry2-${var.env}"
  org_id = var.mongodb_atlas_org_id
}

resource "mongodbatlas_cluster" "mongodb_cluster" {
  project_id                  = mongodbatlas_project.mongodb_project.id
  name                        = "Cluster0"
  cloud_backup                = true
  cluster_type                = "REPLICASET"
  mongo_db_major_version      = 5
  provider_instance_size_name = "M10"
  provider_name               = "AWS"
  provider_region_name        = local.mongodb_region_name
}

resource "mongodbatlas_database_user" "mongodb_user_lambda" {
  project_id         = mongodbatlas_project.mongodb_project.id
  username           = "lambda"
  password           = random_password.mongodb_password_lambda.result
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = local.mongodb_database_name
  }

  scopes {
    name = mongodbatlas_cluster.mongodb_cluster.name
    type = "CLUSTER"
  }
}

resource "random_password" "mongodb_password_lambda" {
  length  = 32
  special = false
}
