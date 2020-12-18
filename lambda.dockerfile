FROM hayd/deno-lambda:1.6.1

COPY deps.ts .
RUN deno run --unstable -A deps.ts
COPY . .
RUN deno cache --unstable $(find . -name "*.ts" -not -name "*_test.ts")