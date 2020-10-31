FROM node:12

LABEL org.opencontainers.image.source https://github.com/flashflashrevolution/service-patreon-linker

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install

# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 8081

CMD [ "node", "dist/index.js" ]
