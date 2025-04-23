import type { ReactNode } from 'react';
import type { PathSpec } from '../lib/utils/path.js';
export declare function unstable_getRscParams(): unknown;
export declare function unstable_rerenderRoute(pathname: string, query?: string): void;
export declare function unstable_notFound(): never;
export declare function unstable_redirect(location: string, status?: 307 | 308): never;
type SlotId = string;
export declare function unstable_defineRouter(fns: {
    getRouteConfig: () => Promise<Iterable<{
        path: PathSpec;
        pathPattern?: PathSpec;
        rootElement: {
            isStatic?: boolean;
        };
        routeElement: {
            isStatic?: boolean;
        };
        elements: Record<SlotId, {
            isStatic?: boolean;
        }>;
        noSsr?: boolean;
    }>>;
    handleRoute: (path: string, options: {
        query?: string;
    }) => Promise<{
        rootElement: ReactNode;
        routeElement: ReactNode;
        elements: Record<SlotId, unknown>;
    }>;
    getApiConfig?: () => Promise<Iterable<{
        path: PathSpec;
        isStatic?: boolean;
    }>>;
    handleApi?: (path: string, options: {
        url: URL;
        body: ReadableStream | null;
        headers: Readonly<Record<string, string>>;
        method: string;
    }) => Promise<{
        body?: ReadableStream;
        headers?: Record<string, string | string[]>;
        status?: number;
    }>;
}): {
    handleRequest: import("../lib/types.js").HandleRequest;
    handleBuild: import("../lib/types.js").HandleBuild;
};
export {};
