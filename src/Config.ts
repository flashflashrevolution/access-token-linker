import * as dotenv from 'dotenv';
import fs from 'fs/promises';

const envPath = ".env";

async function ImportEnvironmentVariables(): Promise<void>
{
    const exists = await fs.stat(envPath);
    if (exists)
    {
        dotenv.config({ path: envPath });
    }
}

export { ImportEnvironmentVariables };
