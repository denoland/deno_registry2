build-WebhookGithubFunction:
	deno bundle --unstable --importmap ./import_map.json ./api/webhook/github.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable --importmap ../../../import_map.json ../../../deps.ts

build-ModuleFindFunction:
	deno bundle --unstable --importmap ./import_map.json ./api/module/find.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable --importmap ../../../import_map.json ../../../deps.ts

build-ModulesListFunction:
	deno bundle --unstable --importmap ./import_map.json ./api/modules/list.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable --importmap ../../../import_map.json ../../../deps.ts

build-AsyncPublishFunction:
	deno bundle --unstable --importmap ./import_map.json ./api/async/publish.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable --importmap ../../../import_map.json ../../../deps.ts

build-BuildsGetFunction:
	deno bundle --unstable --importmap ./import_map.json ./api/builds/get.ts > $(ARTIFACTS_DIR)/bundle.js
	# Cache the mongo plugin
	cd $(ARTIFACTS_DIR) && deno run -A --unstable --importmap ../../../import_map.json ../../../deps.ts
