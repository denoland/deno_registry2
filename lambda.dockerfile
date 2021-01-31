FROM hayd/deno-lambda:1.7.1

RUN yum install git -y && rm -rf /var/cache/yum
COPY deps.ts .
RUN deno run --unstable -A deps.ts
COPY . .
RUN deno cache --unstable $(find . -name "*.ts" -not -name "*_test.ts")