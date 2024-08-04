FROM node:18.12.1-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl

USER root

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

EXPOSE 5000

CMD ["yarn", "start"]
