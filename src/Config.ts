import * as dotenv from 'dotenv';
import fs from 'fs/promises';

const envPath = ".env";

async function ImportEnvironmentVariables(): Promise<void>
{
    const exists = await fs.stat(envPath)
        .catch(() =>
        {
            console.log(".env does not exist. Load environment variables from secrets or manually.");
        });

    if (exists)
    {
        dotenv.config({ path: envPath });
    }
}

export { ImportEnvironmentVariables };
