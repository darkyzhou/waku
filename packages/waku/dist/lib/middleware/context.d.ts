import type { HandlerReq } from '../types.js';
import type { Middleware } from './types.js';
type Context = {
    readonly req: HandlerReq;
    readonly data: Record<string, unknown>;
};
export declare const context: Middleware;
export declare function getContext(): Context;
export declare function getContextData(): Record<string, unknown>;
export {};
