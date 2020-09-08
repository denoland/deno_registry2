data "aws_vpc" "default" {
  default = true
}

data "aws_subnet_ids" "public" {
  vpc_id = data.aws_vpc.default.id
}

resource "aws_ecs_service" "this" {
  name             = "${local.prefix}-search-svc-${local.short_uuid}"
  cluster          = aws_ecs_cluster.this.id
  task_definition  = aws_ecs_task_definition.this.arn
  desired_count    = 1
  launch_type      = "FARGATE"
  platform_version = "1.4.0"

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = "meilisearch"
    container_port   = 7700
  }

  network_configuration {
    subnets = data.aws_subnet_ids.public.ids
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${local.prefix}-meili-task-def-${local.short_uuid}"
  container_definitions    = file("${path.module}/task_definitions/search.json")
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  tags                     = local.tags

  volume {
    name = "data"
    efs_volume_configuration {
      file_system_id = aws_efs_file_system.this.id
      root_directory = "/opt/data"
    }
  }
}

resource "aws_lb" "this" {
  name               = "load-balancer-${local.short_uuid}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.this.id]
  subnets            = data.aws_subnet_ids.public.ids
  tags               = local.tags
}

resource "aws_lb_listener" "front_end" {
  load_balancer_arn = aws_lb.this.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

resource "aws_lb_target_group" "this" {
  name        = "search-${local.short_uuid}"
  port        = 443
  protocol    = "HTTPS"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_security_group" "this" {
  name        = "${local.prefix}-public-tls-sg-${local.short_uuid}"
  description = "Allow TLS inbound traffic"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "TLS from Internet"
    from_port   = 443
    to_port     = 443
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
}

resource "aws_efs_file_system" "this" {
  creation_token = local.short_uuid
  tags           = local.tags
}

resource "aws_ecs_cluster" "this" {
  name               = "${local.prefix}-ecs-cluster-${local.short_uuid}"
  capacity_providers = ["FARGATE"]
  tags               = local.tags

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}