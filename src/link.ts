/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { ImportEnvironmentVariables } from "./Config";
ImportEnvironmentVariables();

import 'reflect-metadata';
import { Request, Response } from 'express-serve-static-core';
import { AddressInfo } from 'net';
import { Endpoints, PatreonRequest, Schemas } from "patreon-ts";
import { ParsedUrlQueryInput } from 'querystring';
import { Guid } from "guid-typescript";
import { UserIdValidatorMiddleware } from "./UserIdValidator";

import
{
    AccessToken,
    AuthorizationTokenConfig,
    create,
    ModuleOptions,
    OAuthClient,
    Token
} from 'simple-oauth2';

import { format as formatUrl } from 'url';

import express = require('express');
import cookieParser = require('cookie-parser');
import * as Database from "./Database";
import { GetCookies, Cookies } from "./Cookies";
import { exit } from "process";
import { PatreonLink } from "./entity/PatreonLink";

const CLIENT_ID: string = process.env.PATREON_CLIENT_ID as string;
const PATREON_HOST: string = "https://www.patreon.com";
const PATREON_TOKEN_PATH: string = "/api/oauth2/token";
const PATREON_AUTHORIZE_PATH: string = "/oauth2/authorize";

const authorizeRedirectUri: string = formatUrl({
    protocol: "http",
    host: "testing.flashflashrevolution.com:8081",
    pathname: "/oauth/redirect",
});

const scopes: string = "identity campaigns identity.memberships campaigns.members";

const activeRequestMap = new Map<string, number>();

const credentials: ModuleOptions = {
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

const client: OAuthClient<"patreon"> = create(credentials);

export async function DisplayConditionalLandingPage(req: Request, res: Response): Promise<void>
{
    const cookies:Cookies = GetCookies(req.cookies);
    await Database.ReadLinkData(parseInt(cookies.user_id))
    .then((links: PatreonLink[]): Promise<string> =>
    {
        if (links.length == 0)
        {
            res.redirect("/patreon");
        }

        const UserQueryObject: Schemas.User = new Schemas.User(
            { attributes: { about: Schemas.user_constants.attributes.first_name } }
        );

        const endpointQuery: ParsedUrlQueryInput = Endpoints.BuildEndpointQuery(UserQueryObject);

        const query: string = Endpoints.BuildSimpleEndpoint(
            Endpoints.SimpleEndpoints.Identity,
            endpointQuery);

        const result: Token = JSON.parse(links[0].access_token);
        const accessToken: AccessToken = client.accessToken.create(result);
        return PatreonRequest(accessToken, query);
    })
    .then((result: string) =>
    {
        const UserResultObject: Schemas.User = new Schemas.User(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            JSON.parse(result).data
        );

        res.send(`<p>Hey ${UserResultObject.attributes?.first_name} you're all set!</p>
        <p><a href="http://www.flashflashrevolution.com/">Go back to FFR!</a></p>`);
    })
    .catch((error) =>
    {
        console.log(error);
        res.redirect("http://www.flashflashrevolution.com/");
    });
}

export function RequestAuthorizationFromPatreon(req: Request, res: Response): void
{
    // Get userid from cookie. (If we got here, we know it exists.)
    const cookies: Cookies = GetCookies(req.cookies);
    const state: Guid = Guid.create();
    activeRequestMap.set(state.toString(), parseInt(cookies.user_id));

    const authorizationUri: string = client.authorizationCode.authorizeURL(
        {
            redirect_uri: authorizeRedirectUri,
            scope: scopes,
            state: state.toString(),
        });

    res.redirect(authorizationUri);
}

export async function ExtractAccessTokenFromPatreon(req: Request, res: Response): Promise<void>
{
    let tokenConfig: AuthorizationTokenConfig;
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
            redirect_uri: authorizeRedirectUri,
        };

        stateVar = state as string;
    }

    try
    {
        const result: Token = await client.authorizationCode.getToken(tokenConfig);
        const accessToken: AccessToken = client.accessToken.create(result);
        let ffrUserId: number = -1;
        if (activeRequestMap.has(stateVar))
        {
            ffrUserId = activeRequestMap.get(stateVar) as number;
            activeRequestMap.delete(stateVar);

            await Database.WriteLinkData(accessToken, ffrUserId)
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
        res.redirect("/");
    }
}

const PORT: number = 8081;
const app: express.Express = express();

// Incoming redirect from Patreon.
app.get("/oauth/redirect", ExtractAccessTokenFromPatreon);

app.use(cookieParser());
app.use(UserIdValidatorMiddleware());

// Incoming redirect from FFR.
app.get("/patreon", RequestAuthorizationFromPatreon);

// Homepage test.
app.get("/", DisplayConditionalLandingPage);

// Initialize and Start Listening
if (Database.Initialize())
{
    const server = app.listen(PORT, () =>
    {
        const port: AddressInfo = server.address() as AddressInfo;
        console.log(`Listening on http://testing.flashflashrevolution.com:${port.port}`);
    });
}
else
{
    exit(1);
}
