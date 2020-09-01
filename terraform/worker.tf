resource "cloudflare_worker_script" "my_script" {
  name    = "script_1"
  content = file("../worker/worker.js")

  plain_text_binding {
    name = "MY_EXAMPLE_PLAIN_TEXT"
    text = "foobar"
  }
}
