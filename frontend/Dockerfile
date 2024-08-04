FROM node:18.12.1-slim as build

WORKDIR /app

COPY yarn.lock package*.json ./

RUN yarn install

COPY . .

ARG REACT_APP_API_URL

ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN yarn build

FROM nginx:1.21.3 as production

RUN apt-get update && apt-get install -y curl

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
