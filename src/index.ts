import { ImportEnvironmentVariables } from "./Config";
ImportEnvironmentVariables();

import cookieParser = require('cookie-parser');
import Express = require('express');
import { Guid } from "guid-typescript";
import { AddressInfo } from 'net';
import "reflect-metadata";
import * as OAuth from 'simple-oauth2';
import * as Process from "process";
import * as Url from 'url';

import * as Cookies from "./Cookies";
import { Specs, Initialize, Entities } from "@flashflashrevolution/database-entities"
import * as UserIdValidator from "./UserIdValidator";
import * as WebApp from "./WebApp";
import { ConnectionOptions } from 'typeorm';

const CLIENT_ID: string = process.env.PATREON_CLIENT_ID as string;
const PATREON_HOST: string = "https://www.patreon.com";
const PATREON_TOKEN_PATH: string = "/api/oauth2/token";
const PATREON_AUTHORIZE_PATH: string = "/oauth2/authorize";
const FFR_HOST: string = process.env.LINK_REDIR_HOST as string;
const FFR_REDIR_PATH: string = process.env.LINK_REDIR_PATH as string;

const redirAuthorizeUrl: Url.URL = new Url.URL("/oauth/redirect", "http://testing.flashflashrevolution.com:8081");

const scopes: string = "identity campaigns identity.memberships campaigns.members";

const activeRequestMap: Map<string, number> = new Map<string, number>();
const activeRequestExpirationMap: Map<string, Date> = new Map<string, Date>();

const credentials: OAuth.ModuleOptions = {
    client:
    {
        id: CLIENT_ID,
        secret: process.env.PATREON_CLIENT_SECRET as string
    },
    auth:
    {
        tokenHost: PATREON_HOST,
        tokenPath: PATREON_TOKEN_PATH,
        authorizePath: PATREON_AUTHORIZE_PATH
    }
};

const client: OAuth.OAuthClient<"patreon"> = OAuth.create(credentials);

export function RequestAuthorizationFromPatreon(req: Express.Request, res: Express.Response): void
{
    // Get userid from cookie. (If we got here, we know it exists.)
    const cookies: Cookies.Cookies = Cookies.GetCookies(req.cookies);
    const state: Guid = Guid.create();

    const expieryDate: Date = new Date(Date.now());
    expieryDate.setMinutes(expieryDate.getMinutes() + 5);

    const stateString = state.toString();
    activeRequestMap.set(stateString, parseInt(cookies.user_id));
    activeRequestExpirationMap.set(stateString, expieryDate);

    const authorizationUri: string = client.authorizationCode.authorizeURL(
        {
            redirect_uri: redirAuthorizeUrl.href,
            scope: scopes,
            state: state.toString(),
        });

    res.redirect(authorizationUri);
}

export async function ExtractAccessTokenFromPatreon(
    req: Express.Request,
    res: Express.Response): Promise<void>
{
    const redirToFFRUrlWithResult: Url.URL = new Url.URL(FFR_REDIR_PATH, FFR_HOST);

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
        const result: OAuth.Token = await client.authorizationCode.getToken(tokenConfig);
        const accessToken: OAuth.AccessToken = client.accessToken.create(result);
        let ffrUserId: number = -1;
        if (activeRequestMap.has(stateVar))
        {
            ffrUserId = activeRequestMap.get(stateVar) as number;
            activeRequestMap.delete(stateVar);
            activeRequestExpirationMap.delete(stateVar);

            await Specs.Link.WriteLinkData(accessToken, ffrUserId)
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
app.get(redirAuthorizeUrl.pathname, ExtractAccessTokenFromPatreon);

app.use(cookieParser());
app.use(UserIdValidator.Middleware());

// Incoming redirect from FFR. We can only get here if we have a valid user-id.
app.get("/", RequestAuthorizationFromPatreon);

app.use(WebApp.HandlerError);
app.use(WebApp.Handler404);

const DB_HOST: string = process.env.DB_HOST as string;
const DB_PATREON: string = process.env.DB_PATREON as string;
const DB_PATREON_USER: string = process.env.DB_PATREON_USER as string;
const DB_PATREON_PASS: string = process.env.DB_PATREON_PASS as string;

const connectionOptions: ConnectionOptions =
{
    name: DB_PATREON,
    type: "mysql",
    host: DB_HOST,
    port: 3306,
    username: DB_PATREON_USER,
    password: DB_PATREON_PASS,
    database: DB_PATREON,
    entities: [Entities.PatreonLink]
};

if (Initialize(connectionOptions))
{
    const PORT: number = 8081;
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
}
else
{
    Process.exit(1);
}
