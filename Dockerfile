FROM node

WORKDIR /app
COPY . /app

RUN \
  cd /app && \
  npm i

ENTRYPOINT ["node", "run.js"]
