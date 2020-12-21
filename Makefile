build:
	docker build . -t deno_registry2:latest --file lambda.dockerfile

test: build
	docker-compose up --build --abort-on-container-exit