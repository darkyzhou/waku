import type { Middleware } from './types.js';
export declare const SERVER_MODULE_MAP: {
    readonly 'rsdw-server': "react-server-dom-webpack/server.edge";
};
export declare const CLIENT_MODULE_MAP: {
    readonly 'rd-server': "react-dom/server.edge";
    readonly 'rsdw-client': "react-server-dom-webpack/client.edge";
    readonly 'waku-minimal-client': "waku/minimal/client";
};
export declare const CLIENT_PREFIX = "client/";
export declare const handler: Middleware;
