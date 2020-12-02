# Access Token Linker

[![code style: eslint](https://img.shields.io/badge/code_style-eslint-8080F2.svg?style=flat-square)](https://github.com/eslint/eslint)

- [Access Token Linker](#access-token-linker)
  - [Chart](#chart)
  - [Development Image Builds](#development-image-builds)
  - [Generating Migrations](#generating-migrations)
  - [Running Migrations](#running-migrations)
  - [Building and Running in Docker for Testing](#building-and-running-in-docker-for-testing)

## Chart

The deployment chart for this project can be found in the [charts](https://github.com/flashflashrevolution/charts) repository.

## Development Image Builds

```zsh
# First get a github access token with registry read permissions.
NPM_TOKEN=access_token

# Get the sha of the latest commit you want to build from.
git log --oneline

# Then run the build. Uses multi-stage build, the access token wont be in the final image.
docker build -t ghcr.io/flashflashrevolution/service-patreon-linker:sha-shavalue --build-arg NPM_TOKEN=${NPM_TOKEN} .

# Push the built image.
docker push ghcr.io/flashflashrevolution/service-patreon-linker:sha-shavalue

# Here is an example of a functional sequence.
# NPM_TOKEN=averyvalidtokenstring
# docker build -t ghcr.io/flashflashrevolution/flashflashrevolution/service-patreon-linker:sha-cbcc9cd --build-arg NPM_TOKEN=${NPM_TOKEN} .
# docker push ghcr.io/flashflashrevolution/service-patreon-linker:sha-cbcc9cd
```

## Generating Migrations

1. Create ormconfig.production and fill out database credentials. (Do not submit.)

2. > ```bash
   > npm run typeorm migration:generate -- --name initialize --connection patreon --config ormconfig.production
   > ```

3. Commit the migration.

## Running Migrations

```bash
npm run typeorm migration:run -- --connection patreon --config ormconfig.production
```

## Building and Running in Docker for Testing

```bash
# Fill out your github access token here. (The one for NPM.)
NPM_TOKEN=YOUR_ACCESS_TOKEN
docker build -t ghcr.io/flashflashrevolution/service-patreon-linker:dev --build-arg NPM_TOKEN=${NPM_TOKEN} .
docker container run --env-file .env 679d9a90b7f7 -p 8081:8081
```
