build:
	docker build . -t deno_registry2 --file lambda.dockerfile; \

test:
	docker-compose up --build --abort-on-container-exit