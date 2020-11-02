import { ImportEnvironmentVariables } from "./Config";

import cookieParser = require('cookie-parser');
import Express = require('express');
import { Guid } from "guid-typescript";
import { AddressInfo } from 'net';
import "reflect-metadata";
import * as PatreonTS from 'patreon-ts';
import * as OAuth from 'simple-oauth2';
import * as Process from "process";
import * as Url from 'url';

import * as Cookies from "./Cookies";
import { Specs, Initialize, Entities } from "@flashflashrevolution/database-entities";
import * as UserIdValidator from "./UserIdValidator";
import * as WebApp from "./WebApp";
import * as TypeORM from 'typeorm';

interface PatreonConfiguration
{
    PATREON_HOST: string;
    PATREON_TOKEN_PATH: string;
    PATREON_AUTHORIZE_PATH: string;
}

const patreonConf: PatreonConfiguration =
{
    PATREON_HOST: "https://www.patreon.com",
    PATREON_TOKEN_PATH: "/api/oauth2/token",
    PATREON_AUTHORIZE_PATH: "/oauth2/authorize",
}

interface FFRConfiguration
{
    FFR_HOST: string;
    FFR_REDIR_PATH: string;
    FFR_SERVICES_HOST: string;
}

let ffrConf: FFRConfiguration;

const internalRedirectPath: string = "/oauth/redirect";
const externalRedirectPath: string = "patreon-linker" + internalRedirectPath;

let redirAuthorizeUrl: Url.URL;

const scopes: string = "identity campaigns identity.memberships campaigns.members";
const activeRequestMap: Map<string, number> = new Map<string, number>();
const activeRequestExpirationMap: Map<string, Date> = new Map<string, Date>();

let connection: TypeORM.Connection;
let credentials: OAuth.ModuleOptions;
let client: OAuth.AuthorizationCode<"patreon">;
let connectionOptions: TypeORM.ConnectionOptions;

export function RequestAuthorizationFromPatreon(req: Express.Request, res: Express.Response): void
{
    console.log("Incoming: " + req.url);

    // Get userid from cookie. (If we got here, we know it exists.)
    const cookies: Cookies.Cookies = Cookies.GetCookies(req.cookies);
    const state: Guid = Guid.create();

    const expieryDate: Date = new Date(Date.now());
    expieryDate.setMinutes(expieryDate.getMinutes() + 5);

    const stateString = state.toString();
    activeRequestMap.set(stateString, parseInt(cookies.user_id));
    activeRequestExpirationMap.set(stateString, expieryDate);

    const authorizationUri: string = client.authorizeURL(
        {
            redirect_uri: redirAuthorizeUrl.href,
            scope: scopes,
            state: state.toString(),
        });

    console.log("Generated authorization uri:" + redirAuthorizeUrl.href);
    console.log("Redirecting to: " + authorizationUri);
    res.redirect(authorizationUri);
}

export async function ExtractAccessTokenFromPatreon(
    req: Express.Request,
    res: Express.Response): Promise<void>
{
    const redirToFFRUrlWithResult: Url.URL = new Url.URL(ffrConf.FFR_REDIR_PATH, ffrConf.FFR_HOST);
    console.log(redirToFFRUrlWithResult);

    if (Object.keys(req.query).length <= 0)
    {
        redirToFFRUrlWithResult.search = "result=deny";
        res.redirect(redirToFFRUrlWithResult.href);
        return Promise.resolve();
    }

    let tokenConfig: OAuth.AuthorizationTokenConfig;
    let stateVar: string;
    {
        const
            {
                code,
                state
            } = req.query;

        tokenConfig = {
            code: code as string,
            scope: scopes,
            redirect_uri: redirAuthorizeUrl.href,
        };

        stateVar = state as string;
    }

    try
    {
        const result: OAuth.Token = await client.getToken(tokenConfig);
        const accessToken: PatreonTS.Types.PatreonToken =
            PatreonTS.Types.CreatePatreonTokenFromOAuthToken(client.createToken(result));

        let ffrUserId: number = -1;
        if (activeRequestMap.has(stateVar))
        {
            ffrUserId = activeRequestMap.get(stateVar) as number;
            activeRequestMap.delete(stateVar);
            activeRequestExpirationMap.delete(stateVar);

            await Specs.Link.WriteLinkData(connection, accessToken.accessToken, ffrUserId)
                .then((result: Specs.Link.Result) =>
                {
                    switch (result)
                    {
                        case Specs.Link.Result.SUCCESS:
                            redirToFFRUrlWithResult.search = "result=success";
                            break;
                        case Specs.Link.Result.DUPLICATE:
                            redirToFFRUrlWithResult.search = "result=exists";
                            break;
                    }
                })
                .catch((error) =>
                {
                    console.log(error);
                    redirToFFRUrlWithResult.search = "result=fail";
                });
        }
    }
    catch (error)
    {
        console.log(error);
    }

    res.redirect(redirToFFRUrlWithResult.href);
}

const app: Express.Express = Express();

// Incoming redirect from Patreon.
app.get(internalRedirectPath, ExtractAccessTokenFromPatreon);

app.use(cookieParser());
app.use(UserIdValidator.Middleware());

// Incoming redirect from FFR. We can only get here if we have a valid user-id.
app.get("/", RequestAuthorizationFromPatreon);

app.use(WebApp.HandlerError);
app.use(WebApp.Handler404);

async function Startup(): Promise<TypeORM.Connection>
{
    await LoadConfiguration();

    return await Initialize(connectionOptions)
        .then((connection: TypeORM.Connection) =>
        {
            const PORT: number = 80;
            const server = app.listen(PORT, () =>
            {
                const port: AddressInfo = server.address() as AddressInfo;
                console.log(`Listening on http://testing.flashflashrevolution.com:${port.port}`);
            });

            setInterval(() =>
            {
                const toRemove: string[] = [];
                const timeNow: number = Date.now();
                for (const expiery of activeRequestExpirationMap)
                {
                    if (expiery[1].valueOf() > timeNow)
                    {
                        toRemove.push(expiery[0]);
                    }
                }

                if (toRemove.length > 0)
                {
                    console.log(`${toRemove.length} link requests expired.`);
                }

                for (const entry of toRemove)
                {
                    activeRequestMap.delete(entry);
                    activeRequestExpirationMap.delete(entry);
                }
            },
                300000);

            return Promise.resolve(connection);
        })
        .catch(() =>
        {
            return Promise.reject("Unable to connect to Database.");
        });
}



async function LoadConfiguration(): Promise<void>
{
    await ImportEnvironmentVariables();

    // Patreon
    credentials = {
        client:
        {
            id: process.env.PATREON_CLIENT_ID as string,
            secret: process.env.PATREON_CLIENT_SECRET as string
        },
        auth:
        {
            tokenHost: patreonConf.PATREON_HOST,
            tokenPath: patreonConf.PATREON_TOKEN_PATH,
            authorizePath: patreonConf.PATREON_AUTHORIZE_PATH
        }
    };

    client = new OAuth.AuthorizationCode(credentials);

    // TypeORM Database
    connectionOptions = {
        name: process.env.DB_PATREON,
        type: "mysql",
        host: process.env.DB_HOST as string,
        port: 3306,
        username: process.env.DB_PATREON_USER,
        password: process.env.DB_PATREON_PASS,
        database: process.env.DB_PATREON,
        entities: [Entities.PatreonLink]
    };

    ffrConf =
    {
        FFR_HOST: process.env.LINK_REDIR_HOST as string,
        FFR_REDIR_PATH: process.env.LINK_REDIR_PATH as string,
        FFR_SERVICES_HOST: process.env.FFR_SERVICES_HOST as string,
    }

    redirAuthorizeUrl = new Url.URL(externalRedirectPath, ffrConf.FFR_SERVICES_HOST);
}


Startup()
    .then((newConnection: TypeORM.Connection) =>
    {
        connection = newConnection;
    })
    .catch((error: string) =>
    {
        console.log(error);
        Process.exit(1);
    });
