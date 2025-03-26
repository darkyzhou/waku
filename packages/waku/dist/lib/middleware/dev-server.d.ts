import type { Middleware } from './types.js';
declare global {
    interface ImportMeta {
        readonly env: Record<string, string>;
    }
}
export declare const devServer: Middleware;
