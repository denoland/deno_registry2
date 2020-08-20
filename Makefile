download:
	mkdir -p ./.terraform/dl
	# Download Deno lambda layer
	curl -L https://github.com/hayd/deno-lambda/releases/download/1.3.0/deno-lambda-layer.zip > ./.terraform/dl/deno-lambda-layer.zip
	# Download deno_mongo plugin
	curl -L https://github.com/lucacasonato/deno_mongo_lambda/releases/download/v0.10.0/libdeno_mongo.so > ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so

package: 
	rm -rf ./.terraform/tmp
	# webhook_github_function bundle
	mkdir -p ./.terraform/tmp/webhook_github_function/.deno_plugins
	deno bundle --unstable ./api/webhook/github.ts > ./.terraform/tmp/webhook_github_function/bundle.js
	cp ./.terraform/dl/deno_mongo_d2a782e2c6520b4c89fd44779c665c2a.so ./.terraform/tmp/webhook_github_function/.deno_plugins/

	# deno bundle --unstable ./api/modules/list.ts > ./.terraform/tmp/ModulesListFunction.js
	# deno bundle --unstable ./api/modules/get.ts > ./.terraform/tmp/ModulesListFunction.js
	# deno bundle --unstable ./api/async/publish.ts > ./.terraform/tmp/AsyncPublishFunction.js
	# deno bundle --unstable ./api/builds/get.ts > ./.terraform/tmp/BuildsGetFunction.js