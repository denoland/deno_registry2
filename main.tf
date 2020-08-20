terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

provider "aws" {
  profile = "default"
  region  = "eu-west-1"
}

resource "aws_instance" "example" {
  ami           = "ami-07d9160fa81ccffb5"
  instance_type = "t2.micro"
}
