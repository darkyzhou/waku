import type { Context, Env } from 'hono';
export declare const getHonoContext: <E extends Env = Env>() => Context<E>;
