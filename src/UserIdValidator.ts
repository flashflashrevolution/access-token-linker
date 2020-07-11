import Express = require('express');
import * as Cookies from "./Cookies";
import * as WebApp from "./WebApp";

import sha1 = require("sha1");

const COOKIE_ID_SALT: string = process.env.COOKIE_ID_SALT as string;

function HashUserid(userid: string): string
{
    return sha1(userid.toString() + '-' + COOKIE_ID_SALT);
}

function ValidateHashedUseridPair(userid: string, hashedUserid: string): boolean
{
    return HashUserid(userid) === hashedUserid;
}

function Middleware(): Express.RequestHandler
{
    return function UserIdValidator(req: Express.Request, _res: Express.Response, next: Express.NextFunction)
    {
        const cookies: Cookies.Cookies = Cookies.GetCookies(req.cookies);

        if (!cookies || !cookies.user_id)
        {
            return next(new WebApp.HttpException(401, "You are not authenticated."));
        }

        if (ValidateHashedUseridPair(cookies.user_id, cookies.user_id_verify))
        {
            return next();
        }
        else
        {
            return next("Clear your cookies, something went wrong.");
        }
    };
}

export { Middleware };
