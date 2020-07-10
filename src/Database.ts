/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { MysqlErrorCodes } from 'mysql-error-codes';
import { PatreonLink } from './entity/PatreonLink';
import { AccessToken } from 'simple-oauth2';
import { Connection, createConnection, getConnection } from 'typeorm';

const DB_HOST: string = process.env.DB_HOST as string;
const DB_PATREON: string = process.env.DB_PATREON as string;
const DB_PATREON_USER: string = process.env.DB_PATREON_USER as string;
const DB_PATREON_PASS: string = process.env.DB_PATREON_PASS as string;

function BindUserData(accessToken:AccessToken, ffrUserId: number): PatreonLink
{
    const link = new PatreonLink();
    link.access_token = accessToken.token.access_token;
    link.access_token = JSON.stringify(accessToken.token);
    link.ffr_userid = ffrUserId;
    return link;
}

async function WriteLinkData(accessToken: AccessToken, ffrUserId: number): Promise<void>
{
    const link: PatreonLink = BindUserData(accessToken, ffrUserId);

    const connection: Connection = getConnection(DB_PATREON);
    await connection.manager.save(link)
        .catch((err: any) =>
        {
            switch (err.code)
            {
                case MysqlErrorCodes.ER_DUP_ENTRY:
                    console.log(`PatreonLink with ffr_userid ${link.ffr_userid} already exists.`);
                    break;
            }
        });
}

async function ReadLinkData(ffrUserId: number): Promise<PatreonLink[]>
{
    const connection: Connection = getConnection(DB_PATREON);
    return await connection.getRepository(PatreonLink)
        .find({ where: { ffr_userid: ffrUserId } });
}

function Initialize(): boolean
{
    let success = true;

    createConnection({
        name: DB_PATREON,
        type: "mysql",
        host: DB_HOST,
        port: 3306,
        username: DB_PATREON_USER,
        password: DB_PATREON_PASS,
        database: DB_PATREON,
        entities: ["src/entity/**/*.ts"]
    })
        .catch(error =>
        {
            console.error(error);
            success = false;
        });

    return success;
}

export { Initialize, ReadLinkData, WriteLinkData };
