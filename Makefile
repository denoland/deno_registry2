build:
	docker build . -t deno_registry2:latest

test:
	docker-compose up -d
	sleep 10
	docker-compose logs
	/bin/sh ./run-tests.sh
	docker-compose down