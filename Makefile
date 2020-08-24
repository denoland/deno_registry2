download:
	cd terraform/ && \
	mkdir -p ./.terraform/dl && \
	curl -L https://github.com/hayd/deno-lambda/releases/download/1.3.0/deno-lambda-layer.zip > ./.terraform/dl/deno-lambda-layer.zip && \
	curl -L https://github.com/lucacasonato/deno_mongo_lambda/releases/download/v0.10.0/libdeno_mongo.so > ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so

package:
	cd terraform/ && \
	rm -rf ./.terraform/tmp && \
	mkdir -p ./.terraform/tmp/webhook_github_function/.deno_plugins && \
	deno bundle --unstable ../api/webhook/github.ts > ./.terraform/tmp/webhook_github_function/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/webhook_github_function/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/async_publish_function/.deno_plugins && \
	deno bundle --unstable ../api/async/publish.ts > ./.terraform/tmp/async_publish_function/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/async_publish_function/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/modules_get_function/.deno_plugins && \
	deno bundle --unstable ../api/modules/get.ts > ./.terraform/tmp/modules_get_function/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/modules_get_function/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/modules_list_function/.deno_plugins && \
	deno bundle --unstable ../api/modules/list.ts > ./.terraform/tmp/modules_list_function/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/modules_list_function/.deno_plugins/ && \
	mkdir -p ./.terraform/tmp/builds_get_function/.deno_plugins && \
	deno bundle --unstable ../api/builds/get.ts > ./.terraform/tmp/builds_get_function/bundle.js && \
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/builds_get_function/.deno_plugins/

apply:
	cd terraform/ && \
	terraform plan -var-file terraform.tfvars -out plan.tfplan && \
	terraform apply plan.tfplan