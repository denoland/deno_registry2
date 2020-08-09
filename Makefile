build-WebhookGithubFunction:
	deno bundle --unstable ./api/webhook/github.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable ../../../deps.ts

build-ModulesListFunction:
	deno bundle --unstable ./api/modules/list.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable ../../../deps.ts

build-AsyncPublishFunction:
	deno bundle --unstable ./api/async/publish.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable ../../../deps.ts

build-BuildsGetFunction:
	deno bundle --unstable ./api/builds/get.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable ../../../deps.ts
