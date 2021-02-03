build:
	docker build . -t deno_registry2:latest --file lambda.dockerfile

test:
	docker-compose up -d --build
	/bin/sh ./run-tests.sh
	docker-compose down