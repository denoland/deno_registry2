FROM hayd/deno-lambda:1.24.0

RUN yum -y install https://packages.endpointdev.com/rhel/7/os/x86_64/endpoint-repo.x86_64.rpm && \
    sed -i 's/$releasever/7/' /etc/yum.repos.d/endpoint.repo
RUN yum install git -y && rm -rf /var/cache/yum

COPY deps.ts .
RUN deno cache --unstable --no-check deps.ts

COPY . .
RUN deno cache --unstable --no-check $(find . -name "*.ts" -not -name "*_test.ts")