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
import * as Database from "./Database";
import * as LinkSpec from "./tableManipulators/LinkSpec";
import * as UserIdValidator from "./UserIdValidator";
import * as WebApp from "./WebApp";

const CLIENT_ID: string = process.env.PATREON_CLIENT_ID as string;
const PATREON_HOST: string = "https://www.patreon.com";
const PATREON_TOKEN_PATH: string = "/api/oauth2/token";
const PATREON_AUTHORIZE_PATH: string = "/oauth2/authorize";
const FFR_HOST: string = process.env.LINK_REDIR_HOST as string;
const FFR_REDIR_PATH: string = process.env.LINK_REDIR_HOST as string;

const redirAuthorizeUrl: Url.URL = new Url.URL("/oauth/redirect", "http://testing.flashflashrevolution.com:8081");
const redirToFFRUrl: Url.URL = new Url.URL(FFR_REDIR_PATH, FFR_HOST);

const scopes: string = "identity campaigns identity.memberships campaigns.members";

const activeRequestMap = new Map<string, number>();

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
    activeRequestMap.set(state.toString(), parseInt(cookies.user_id));

    const authorizationUri: string = client.authorizationCode.authorizeURL(
        {
            redirect_uri: redirAuthorizeUrl.href,
            scope: scopes,
            state: state.toString(),
        });

    res.redirect(authorizationUri);
}

export async function ExtractAccessTokenFromPatreon(req: Express.Request, res: Express.Response): Promise<void>
{
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

            await LinkSpec.WriteLinkData(accessToken, ffrUserId)
                .catch((error) =>
                {
                    console.log(error);
                });
        }
    }
    catch (error)
    {
        console.log(error);
    }
    finally
    {
        res.redirect(redirToFFRUrl.href);
    }
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

if (Database.Initialize())
{
    const PORT: number = 8081;
    const server = app.listen(PORT, () =>
    {
        const port: AddressInfo = server.address() as AddressInfo;
        console.log(`Listening on http://testing.flashflashrevolution.com:${port.port}`);
    });
}
else
{
    Process.exit(1);
}
