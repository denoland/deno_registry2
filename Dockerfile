FROM hayd/deno-lambda:1.6.2

RUN yum -y install https://packages.endpoint.com/rhel/7/main/x86_64/endpoint-repo-1.9-1.x86_64.rpm && \
    sed -i 's/$releasever/7/' /etc/yum.repos.d/endpoint.repo
RUN yum install git -y && rm -rf /var/cache/yum
COPY deps.ts .
RUN deno run --unstable -A deps.ts
COPY . .
RUN deno cache --unstable $(find . -name "*.ts" -not -name "*_test.ts")
