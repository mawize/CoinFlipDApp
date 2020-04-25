### STAGE 1: Build ###
FROM node:12.16-alpine AS build

WORKDIR /usr/src/app

COPY package.json .
RUN npm install
COPY . .
RUN $(npm bin)/ng build --prod

### STAGE 2: Run ###
FROM nginx:1.18-alpine
COPY --from=build /usr/src/app/dist/CoinFlipDapp /usr/share/nginx/html 