class Cookies
{
    user_id!: string;
    user_id_verify!: string;

    public constructor(init?: Partial<Cookies>)
    {
        Object.assign(this, init);
    }
}

function GetCookies(cookies: Record<string, unknown>): Cookies
{
    return new Cookies(cookies);
}

export { GetCookies, Cookies };
