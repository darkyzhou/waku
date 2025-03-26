// These exports are for internal use only and subject to change without notice.
export { serverEngine } from './lib/hono/engine.js';
export { getHonoContext } from './lib/hono/ctx.js';
export const importHono = ()=>import('hono');
export const importHonoServeStatic = ()=>import('hono/serve-static');
export const importHonoNodeServer = ()=>import('@hono/node-server');
export const importHonoNodeServerServeStatic = ()=>import('@hono/node-server/serve-static');
export const importHonoAwsLambda = ()=>import('hono/aws-lambda');

//# sourceMappingURL=unstable_hono.js.map