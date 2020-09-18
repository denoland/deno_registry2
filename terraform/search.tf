data "aws_vpc" "default" {
  default = true
}

data "aws_subnet_ids" "public" {
  vpc_id = data.aws_vpc.default.id
}

data "aws_ami" "meilisearch" {
  owners      = ["self"]
  most_recent = true

  filter {
    name   = "name"
    values = ["meilisearch-custom-*"]
  }
}

resource "aws_instance" "meilisearch" {
  ami                         = data.aws_ami.meilisearch.id
  instance_type               = "t3a.small"
  key_name                    = var.ssh_key_name
  subnet_id                   = sort(data.aws_subnet_ids.public.ids)[0]
  associate_public_ip_address = false
  vpc_security_group_ids = [
    aws_security_group.instance.id,
  ]

  root_block_device {
    volume_size           = 20
    delete_on_termination = false
  }

  tags = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_vpc_link" "default_vpc" {
  name               = "${local.prefix}-default-vpc-link-${local.short_uuid}"
  security_group_ids = [aws_security_group.public.id]
  subnet_ids         = [aws_instance.meilisearch.subnet_id]
  tags               = local.tags
}

resource "aws_apigatewayv2_integration" "module_search" {
  api_id               = aws_apigatewayv2_api.deno_api.id
  integration_type     = "HTTP_PROXY"
  integration_method   = "GET"
  connection_id        = aws_apigatewayv2_vpc_link.default_vpc.id
  connection_type      = "VPC_LINK"
  integration_uri      = module.alb.http_tcp_listener_arns[0]
  timeout_milliseconds = 1000 # 1s
}

resource "aws_apigatewayv2_route" "module_search" {
  api_id    = aws_apigatewayv2_api.deno_api.id
  route_key = "GET /indexes/{index}/search"
  target    = "integrations/${aws_apigatewayv2_integration.module_search.id}"
}

resource "aws_lb_target_group_attachment" "test" {
  target_group_arn = module.alb.target_group_arns[0]
  target_id        = aws_instance.meilisearch.id
  port             = 7700
}

module "alb" {
  source             = "terraform-aws-modules/alb/aws"
  version            = "~> 5.4"
  internal           = true
  name               = "meili"
  load_balancer_type = "application"
  vpc_id             = data.aws_vpc.default.id
  subnets            = data.aws_subnet_ids.public.ids
  security_groups    = [aws_security_group.public.id]

  # access_logs = {
  #   bucket = "my-alb-logs"
  # }

  target_groups = [
    {
      name_prefix      = "http"
      backend_protocol = "HTTP"
      backend_port     = 7700
      target_type      = "instance"
      health_check = {
        path    = "/health"
        matcher = "200,201,202,204"
        port    = 7700
      }
    }
  ]

  http_tcp_listeners = [
    {
      port               = 80
      protocol           = "HTTP"
      target_group_index = 0
    }
  ]

  tags = local.tags
}

resource "aws_security_group" "public" {
  name        = "${local.prefix}-public-http-${local.short_uuid}"
  description = "Allow TLS inbound traffic"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "TLS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "plain HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "instance" {
  name        = "${local.prefix}-meili-instance-${local.short_uuid}"
  description = "Allow HTTP inbound traffic for Meili"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "ssh port"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description     = "port for Meilisearch"
    from_port       = 7700
    to_port         = 7700
    protocol        = "tcp"
    security_groups = [aws_security_group.public.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags

  lifecycle {
    create_before_destroy = true
  }
}
