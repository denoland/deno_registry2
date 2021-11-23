FROM denoland/deno:1.16.2

RUN sudo add-apt-repository ppa:git-core/ppa -y && apt update && apt install -y ca-certificates git && apt clean

COPY deps.ts .
RUN deno cache --unstable --no-check deps.ts

COPY . .
RUN deno cache --unstable --no-check $(find . -name "*.ts" -not -name "*_test.ts")
