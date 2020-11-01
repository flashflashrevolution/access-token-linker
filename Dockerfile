FROM node:14-alpine AS build
ARG NPM_TOKEN
WORKDIR /usr/src/app
COPY .npmrc .npmrc
COPY package*.json .
RUN npm ci --only=production
RUN rm -f .npmrc

COPY dist dist
COPY README.md README.md

FROM node:14-alpine
WORKDIR /usr/src/app

LABEL org.opencontainers.image.source https://github.com/flashflashrevolution/service-patreon-linker
EXPOSE 80
COPY --from=build /usr/src/app /usr/src/app
CMD [ "node", "dist/index.js" ]
