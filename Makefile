download:
	cd terraform/ && \
	mkdir -p ./.terraform/dl && \
	curl -L https://github.com/hayd/deno-lambda/releases/download/1.3.3/deno-lambda-layer.zip > ./.terraform/dl/deno-lambda-layer.zip && \
	curl -L https://github.com/lucacasonato/deno_mongo_lambda/releases/download/v0.10.0/libdeno_mongo.so > ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so

package:
	cd terraform/ && \
	rm -rf ./.terraform/tmp && \
	mkdir -p ./.terraform/tmp/webhook_github/.deno_plugins && \
	deno bundle --unstable ../api/webhook/github.ts > ./.terraform/tmp/webhook_github/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/webhook_github/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/async_publish/.deno_plugins && \
	deno bundle --unstable ../api/async/publish.ts > ./.terraform/tmp/async_publish/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/async_publish/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/modules_get/.deno_plugins && \
	deno bundle --unstable ../api/modules/get.ts > ./.terraform/tmp/modules_get/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/modules_get/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/modules_list/.deno_plugins && \
	deno bundle --unstable ../api/modules/list.ts > ./.terraform/tmp/modules_list/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/modules_list/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/builds_get/.deno_plugins && \
	deno bundle --unstable ../api/builds/get.ts > ./.terraform/tmp/builds_get/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/builds_get/.deno_plugins/
