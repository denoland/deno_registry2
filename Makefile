build:
	docker build . -t deno_registry2:latest

test:
	docker-compose up -d --build
	/bin/sh ./run-tests.sh
	docker-compose down