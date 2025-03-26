export { serverEngine } from './lib/hono/engine.js';
export { getHonoContext } from './lib/hono/ctx.js';
export declare const importHono: () => Promise<{
    default: typeof import("hono");
    Hono: typeof import("hono").Hono;
}>;
export declare const importHonoServeStatic: any;
export declare const importHonoNodeServer: any;
export declare const importHonoNodeServerServeStatic: () => Promise<{
    default: typeof import("@hono/node-server/serve-static");
    serveStatic: (options?: import("@hono/node-server/serve-static").ServeStaticOptions) => import("hono").MiddlewareHandler;
}>;
export declare const importHonoAwsLambda: any;
