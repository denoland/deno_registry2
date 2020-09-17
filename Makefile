download:
	cd terraform/ && \
	mkdir -p ./.terraform/dl && \
	curl -L https://github.com/hayd/deno-lambda/releases/download/1.4.0/deno-lambda-layer.zip > ./.terraform/dl/deno-lambda-layer.zip && \
	curl -L https://github.com/lucacasonato/deno_mongo_lambda/releases/download/v0.12.1/libdeno_mongo.so > ./.terraform/dl/deno_mongo_a79a4be6f465f12a177649c69941b66b.so

package:
	cd terraform/ && \
	rm -rf ./.terraform/tmp && \
	mkdir -p ./.terraform/tmp/webhook_github/.deno_plugins && \
	deno bundle --unstable ../api/webhook/github.ts > ./.terraform/tmp/webhook_github/bundle.js && \
	cp ./.terraform/dl/deno_mongo_a79a4be6f465f12a177649c69941b66b.so ./.terraform/tmp/webhook_github/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/async_publish/.deno_plugins && \
	deno bundle --unstable ../api/async/publish.ts > ./.terraform/tmp/async_publish/bundle.js && \
	cp ./.terraform/dl/deno_mongo_a79a4be6f465f12a177649c69941b66b.so ./.terraform/tmp/async_publish/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/stargazers/.deno_plugins && \
	deno bundle --unstable ../api/async/stargazers.ts > ./.terraform/tmp/stargazers/bundle.js && \
	cp ./.terraform/dl/deno_mongo_a79a4be6f465f12a177649c69941b66b.so ./.terraform/tmp/stargazers/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/modules_get/.deno_plugins && \
	deno bundle --unstable ../api/modules/get.ts > ./.terraform/tmp/modules_get/bundle.js && \
	cp ./.terraform/dl/deno_mongo_a79a4be6f465f12a177649c69941b66b.so ./.terraform/tmp/modules_get/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/modules_list/.deno_plugins && \
	deno bundle --unstable ../api/modules/list.ts > ./.terraform/tmp/modules_list/bundle.js && \
	cp ./.terraform/dl/deno_mongo_a79a4be6f465f12a177649c69941b66b.so ./.terraform/tmp/modules_list/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/builds_get/.deno_plugins && \
	deno bundle --unstable ../api/builds/get.ts > ./.terraform/tmp/builds_get/bundle.js && \
	cp ./.terraform/dl/deno_mongo_a79a4be6f465f12a177649c69941b66b.so ./.terraform/tmp/builds_get/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/stats/.deno_plugins && \
	deno bundle --unstable ../api/stats.ts > ./.terraform/tmp/stats/bundle.js && \
	cp ./.terraform/dl/deno_mongo_a79a4be6f465f12a177649c69941b66b.so ./.terraform/tmp/stats/.deno_plugins/
