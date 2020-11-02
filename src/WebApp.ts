/* eslint-disable @typescript-eslint/no-unused-vars */

import Express = require('express');

class HttpException extends Error
{
    status: number;
    message: string;

    constructor(status: number, message: string)
    {
        super(message);

        this.status = status;
        this.message = message;
    }
}

function HandlerError(
    error: HttpException,
    _req: Express.Request,
    res: Express.Response,
    _next: Express.NextFunction): void
{
    res.status(error.status || 500);
    res.send({ error: error.message + ": " + _req.url });
}

function Handler404(
    _req: Express.Request,
    res: Express.Response): void
{
    res.status(404);
    res.send({ error: `Unsupported route: ${_req.url}` });
}

export { HandlerError, Handler404, HttpException };
