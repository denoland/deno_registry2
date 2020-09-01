resource "cloudflare_worker_script" "worker" {
  name    = "${local.prefix}-worker-${local.short_uuid}"
  content = file("../worker/worker.js")
}

resource "cloudflare_worker_route" "worker_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "${var.cdn_domain}/*"
  script_name = cloudflare_worker_script.worker.name
}
