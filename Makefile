build-WebhookGithubFunction:
	deno bundle --unstable ./api/webhook/github.ts > ./api/webhook/github.bundle.js
	cp ./api/webhook/github.bundle.js $(ARTIFACTS_DIR)/bundle.js
