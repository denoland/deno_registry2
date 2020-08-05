#!/bin/sh

sleep 10

# Set up S3
aws --endpoint-url=http://s3:9000 s3 rm --recursive s3://deno-registry2 || true
aws --endpoint-url=http://s3:9000 s3 rb s3://deno-registry2 || true
aws --endpoint-url=http://s3:9000 s3 mb s3://deno-registry2

# Set up SQS
aws --endpoint-url=http://sqs:4576 sqs create-queue --queue-name builds --region us-east-1 || true

export AWS_REGION=us-east-1
export MONGO_URI=mongodb://root:rootpassword@mongo
export BUILD_QUEUE=http://sqs:4576/000000000000/builds
export STORAGE_BUCKET=deno-registry2
export S3_ENDPOINT_URL=http://s3:9000

deno test --unstable -A