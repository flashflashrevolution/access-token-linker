/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextFunction, Request, Response, RequestHandler } from "express";
import { Cookies, GetCookies } from "./Cookies";

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

function UserIdValidatorMiddleware(): RequestHandler
{
    return function UserIdValidator(req: Request, _res: Response, next: NextFunction)
    {
        const cookies: Cookies = GetCookies(req.cookies);

        if (!cookies || cookies.user_id)
        {
            return next("You are not authenticated.");
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

export { UserIdValidatorMiddleware };
