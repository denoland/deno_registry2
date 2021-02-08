build:
	docker build . -t deno_registry2:latest

test:
	docker-compose up -d
	sleep 10
	/bin/sh ./run-tests.sh
	docker-compose down