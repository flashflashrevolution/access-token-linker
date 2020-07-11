import * as Express from "express";

interface ResponseError extends Error
{
    status?: number;
}

function HandlerError(
    error: ResponseError,
    _req: Express.Request,
    res: Express.Response): void
{
    res.status(error.status || 500);
    res.send({ error: error.message });
}

function Handler404(
    _req: Express.Request,
    res: Express.Response): void
{
    res.status(404);
    res.send({ error: "Unsupported route." });
}

export { HandlerError, Handler404 };
