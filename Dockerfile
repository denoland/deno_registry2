FROM denoland/deno:ubuntu-1.17.3

RUN apt update && \
  apt-get install -y ca-certificates software-properties-common gnupg && \
  apt-key adv --keyserver keyserver.ubuntu.com --recv-keys A1715D88E1DF1F24 && \
  add-apt-repository ppa:git-core/ppa -y && \
  apt update && \
  apt install -y git \
  && apt clean

COPY deps.ts .
RUN deno cache --unstable --no-check deps.ts

COPY . .
RUN deno cache --unstable --no-check $(find . -name "*.ts" -not -name "*_test.ts")

ENTRYPOINT ["deno", "run", "-A", "--no-check"]