FROM hayd/deno-lambda:1.6.1

ENV DENO_DIR=.deno_dir
RUN yum install git -y && rm -rf /var/cache/yum
COPY deps.ts .
RUN deno run --unstable -A deps.ts
COPY . .
RUN deno cache --unstable $(find . -name "*.ts" -not -name "*_test.ts")