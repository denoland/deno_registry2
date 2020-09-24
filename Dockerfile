FROM hayd/alpine-deno:1.4.1

RUN apk add --no-cache python py-pip git
RUN pip install awscli

WORKDIR /app

COPY deps.ts .
RUN deno cache --unstable deps.ts
RUN deno run -A --unstable deps.ts
COPY test_deps.ts .
RUN deno cache --unstable test_deps.ts

ADD . .

ENTRYPOINT [ "/app/run-tests.sh" ]