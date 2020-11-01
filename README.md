# Access Token Linker

[![code style: eslint](https://img.shields.io/badge/code_style-eslint-8080F2.svg?style=flat-square)](https://github.com/eslint/eslint)

## Development Image Builds

```bash
docker build -t flashflashrevolution/node-web-app .
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
