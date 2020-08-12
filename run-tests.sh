#!/bin/sh

# Wait for SQS to start
sleep 10

# Set up S3
aws --endpoint-url=http://s3:9000 s3 rm --recursive s3://deno-registry2 || true
aws --endpoint-url=http://s3:9000 s3 rb s3://deno-registry2 || true
aws --endpoint-url=http://s3:9000 s3 mb s3://deno-registry2
aws --endpoint-url=http://s3:9000 s3api put-bucket-policy --bucket deno-registry2 --policy '{ "Version":"2012-10-17", "Statement":[ { "Sid":"PublicRead", "Effect":"Allow", "Principal": "*", "Action":["s3:GetObject","s3:GetObjectVersion"], "Resource":["arn:aws:s3:::deno-registry2/*"] } ] }'

# Set up SQS
aws --endpoint-url=http://sqs:9324 sqs delete-queue --queue-url http://sqs:9324/000000000000/builds --region us-east-1|| true
aws --endpoint-url=http://sqs:9324 sqs create-queue --queue-name builds --region us-east-1

export AWS_REGION=us-east-1
export MONGO_URI=mongodb://root:rootpassword@mongo
export BUILD_QUEUE=http://sqs:9324/000000000000/builds
export STORAGE_BUCKET=deno-registry2
export S3_ENDPOINT_URL=http://s3:9000
export REMOTE_URL=http://s3:9000/deno-registry2/%m/versions/%v/raw

deno test --unstable -A