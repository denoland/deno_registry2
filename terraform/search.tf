data "aws_vpc" "default" {
  default = true
}

data "aws_subnet_ids" "public" {
  vpc_id = data.aws_vpc.default.id
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
    subnets          = data.aws_subnet_ids.public.ids
    security_groups  = [aws_security_group.meili.id]
    assign_public_ip = true
  }
}

data "template_file" "container" {
  template = "${file("${path.module}/task_definitions/search.json")}"
  vars = {
    log_group = aws_cloudwatch_log_group.this.name
    region    = var.region
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${local.prefix}-meili-task-def-${local.short_uuid}"
  container_definitions    = data.template_file.container.rendered
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  task_role_arn            = aws_iam_role.task.arn
  execution_role_arn       = aws_iam_role.exec.arn
  tags                     = local.tags

  volume {
    name = "data"
    efs_volume_configuration {
      file_system_id          = aws_efs_file_system.this.id
      root_directory          = "/"
      transit_encryption      = "ENABLED"
      transit_encryption_port = 2999
      authorization_config {
        access_point_id = aws_efs_access_point.this.id
        iam             = "ENABLED"
      }
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
  name_prefix = "search"
  port        = 7700
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id

  health_check {
    path    = "/health"
    matcher = "200,201,202,204"
    port    = 7700
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "this" {
  name        = "${local.prefix}-public-http-sg-${local.short_uuid}"
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

resource "aws_security_group" "meili" {
  name        = "${local.prefix}-internal-meili-${local.short_uuid}"
  description = "Allows internal traffic to the Meili port"

  ingress {
    description = "Meilisearch on port 7700"
    from_port   = 7700
    to_port     = 7700
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
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

resource "aws_security_group" "efs" {
  name        = "${local.prefix}-efs-sg-${local.short_uuid}"
  description = "Allow traffic to the NFS port"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "NFS traffic from VPC"
    protocol    = "tcp"
    from_port   = 2049
    to_port     = 2049
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_efs_file_system" "this" {
  creation_token = local.short_uuid
  tags           = local.tags
}

resource "aws_efs_access_point" "this" {
  file_system_id = aws_efs_file_system.this.id
}

resource "aws_efs_mount_target" "this" {
  for_each        = { for s in data.aws_subnet_ids.public.ids : s => s }
  file_system_id  = aws_efs_file_system.this.id
  subnet_id       = each.value
  security_groups = [aws_security_group.efs.id]
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/ecs/${local.prefix}-${local.short_uuid}"
  retention_in_days = 7

  tags = local.tags
}
