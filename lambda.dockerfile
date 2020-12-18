FROM hayd/deno-lambda:1.6.1

COPY . .
RUN for i in $(find . -name "*.ts" -not -name "*_test.ts"); do \
    deno cache --unstable $i; \
  done