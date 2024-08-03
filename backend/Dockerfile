FROM node:18.12.1-slim

WORKDIR /app

USER root

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

CMD ["yarn", "start"]
