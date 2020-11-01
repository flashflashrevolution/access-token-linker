import * as dotenv from 'dotenv';
import fs from 'fs';

const envPath = "./.env";

function loadEnv(err: NodeJS.ErrnoException | null): void
{
    if (err == null)
    {
        dotenv.config({ path: "./.env" });
    }
}

function ImportEnvironmentVariables(): void
{
    fs.stat(envPath, loadEnv);
}

export { ImportEnvironmentVariables };
