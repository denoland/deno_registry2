FROM denoland/deno:1.16.2

RUN apt update && apt-get install -y ca-certificates software-properties-common && add-apt-repository ppa:git-core/ppa -y && apt update && apt install -y git && apt clean

COPY deps.ts .
RUN deno cache --unstable --no-check deps.ts

COPY . .
RUN deno cache --unstable --no-check $(find . -name "*.ts" -not -name "*_test.ts")
