FROM node:14-alpine AS build
WORKDIR /usr/src/app
COPY . /usr/src/app

RUN npm config set @flashflashrevolution:registry https://npm.pkg.github.com/ \
    npm install --production


FROM node:14-alpine
WORKDIR /usr/src/app

LABEL org.opencontainers.image.source https://github.com/flashflashrevolution/service-patreon-linker
EXPOSE 8081
COPY --from=build /usr/src/app /usr/src/app
CMD [ "node", "dist/index.js" ]
