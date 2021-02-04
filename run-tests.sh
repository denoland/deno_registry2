#!/bin/sh

echo "Wait for SQS to start..."
sleep 10

echo "Setting up environment variables..."
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# required when using the aws cli v2 to disable the sticky pager
# see https://docs.aws.amazon.com/cli/latest/userguide/cliv2-migration.html#cliv2-migration-output-pager
export AWS_PAGER=""
export MONGO_URI=mongodb://root:rootpassword@localhost
export BUILD_QUEUE=http://localhost:9324/000000000000/builds
export STORAGE_BUCKET=deno-registry2
export MODERATION_BUCKET=deno-registry2-moderation
export S3_ENDPOINT_URL=http://localhost:9000
export SSM_ENDPOINT_URL=http://localhost:4583
export REMOTE_URL=http://localhost:9000/deno-registry2/%m/versions/%v/raw
# required because some tests use dates written in UTC in assertions
export TZ='UTC'

# Set up S3
echo "Setting up S3 buckets..."
aws --endpoint-url=http://localhost:9000 s3 rm --recursive s3://deno-registry2 || true
aws --endpoint-url=http://localhost:9000 s3 rm --recursive s3://deno-registry2-moderation || true
aws --endpoint-url=http://localhost:9000 s3 rb s3://deno-registry2 || true
aws --endpoint-url=http://localhost:9000 s3 rb s3://deno-registry2-moderation || true
aws --endpoint-url=http://localhost:9000 s3 mb s3://deno-registry2
aws --endpoint-url=http://localhost:9000 s3 mb s3://deno-registry2-moderation
aws --endpoint-url=http://localhost:9000 s3api put-bucket-policy --bucket deno-registry2 --policy '{ "Version":"2012-10-17", "Statement":[ { "Sid":"PublicRead", "Effect":"Allow", "Principal": "*", "Action":["s3:GetObject","s3:GetObjectVersion"], "Resource":["arn:aws:s3:::deno-registry2/*"] } ] }'
aws --endpoint-url=http://localhost:9000 s3 cp badwords-example.txt s3://deno-registry2-moderation/badwords.txt

# Set up SQS
echo "Setting up SQS queue..."
aws --endpoint-url=http://localhost:9324 sqs delete-queue --queue-url http://localhost:9324/000000000000/builds --region us-east-1|| true
aws --endpoint-url=http://localhost:9324 sqs create-queue --queue-name builds --region us-east-1

echo "Running tests..."
deno test --unstable -A