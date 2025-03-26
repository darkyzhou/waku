import type { MiddlewareHandler } from 'hono';
import type { MiddlewareOptions } from '../middleware/types.js';
export declare const serverEngine: (options: MiddlewareOptions) => MiddlewareHandler;
