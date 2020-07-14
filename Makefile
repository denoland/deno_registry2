build-WebhookGithubFunction:
	deno bundle --unstable ./api/webhook/github.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable ../../../deps.ts