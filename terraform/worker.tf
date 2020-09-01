resource "cloudflare_worker_script" "worker" {
  name    = "${local.prefix}-worker-${local.short_uuid}"
  content = file("../api/worker.js")

  plain_text_binding {
    name = "S3_BUCKET"
    text = "https://${aws_s3_bucket.storage_bucket.website_endpoint}"
  }
}

resource "cloudflare_worker_route" "worker_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "${var.cdn_domain}/*"
  script_name = cloudflare_worker_script.worker.name
}
