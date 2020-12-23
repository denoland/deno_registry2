FROM deno_registry2:latest
RUN yum install awscli -y
ENTRYPOINT ["./run-tests/sh"]