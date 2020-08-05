FROM hayd/alpine-deno:1.2.2

RUN apk add --no-cache python py-pip
RUN pip install awscli

WORKDIR /app

COPY import_map.json .
COPY deps.ts .
RUN deno cache --unstable --importmap import_map.json deps.ts
COPY test_deps.ts .
RUN deno cache --unstable --importmap import_map.json test_deps.ts

ADD . .

ENTRYPOINT [ "/app/run-tests.sh" ]