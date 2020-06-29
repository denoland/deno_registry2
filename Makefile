build-WebhookGithubFunction:
	deno bundle --unstable ./api/webhook/github.ts > $(ARTIFACTS_DIR)/bundle.js
