// These exports are for internal use only and subject to change without notice.

export { serverEngine } from './lib/hono/engine.js';
export { getHonoContext } from './lib/hono/ctx.js';

export const importHono = () => import('hono');
export const importHonoServeStatic: any = () => import('hono/serve-static');
export const importHonoNodeServer: any = () => import('@hono/node-server');
export const importHonoNodeServerServeStatic = () =>
  import('@hono/node-server/serve-static');
export const importHonoAwsLambda: any = () => import('hono/aws-lambda');
