import { Component } from 'react';
import type { ReactNode, AnchorHTMLAttributes, ReactElement } from 'react';
import type { RouteProps } from './common.js';
import type { RouteConfig } from './base-types.js';
type AllowPathDecorators<Path extends string> = Path extends unknown ? Path | `${Path}?${string}` | `${Path}#${string}` : never;
type InferredPaths = RouteConfig extends {
    paths: infer UserPaths extends string;
} ? AllowPathDecorators<UserPaths> : string;
declare global {
    interface ImportMeta {
        readonly env: Record<string, string>;
    }
}
export declare function useRouter(): {
    push: (to: InferredPaths, options?: {
        /**
         * indicates if the link should scroll or not on navigation
         * - `true`: always scroll
         * - `false`: never scroll
         * - `undefined`: scroll on path change (not on searchParams change)
         */
        scroll?: boolean;
    }) => void;
    replace: (to: InferredPaths, options?: {
        /**
         * indicates if the link should scroll or not on navigation
         * - `true`: always scroll
         * - `false`: never scroll
         * - `undefined`: scroll on path change (not on searchParams change)
         */
        scroll?: boolean;
    }) => void;
    reload: () => void;
    back: () => void;
    forward: () => void;
    prefetch: (to: string) => void;
    path: string;
    query: string;
    hash: string;
};
export type LinkProps = {
    to: InferredPaths;
    children: ReactNode;
    /**
     * indicates if the link should scroll or not on navigation
     * - `true`: always scroll
     * - `false`: never scroll
     * - `undefined`: scroll on path change (not on searchParams change)
     */
    scroll?: boolean;
    unstable_pending?: ReactNode;
    unstable_notPending?: ReactNode;
    unstable_prefetchOnEnter?: boolean;
    unstable_prefetchOnView?: boolean;
    unstable_startTransition?: ((fn: () => void) => void) | undefined;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;
export declare function Link({ to, children, scroll, unstable_pending, unstable_notPending, unstable_prefetchOnEnter, unstable_prefetchOnView, unstable_startTransition, ...props }: LinkProps): ReactElement;
export declare class ErrorBoundary extends Component<{
    children: ReactNode;
}, {
    error?: unknown;
}> {
    constructor(props: {
        children: ReactNode;
    });
    static getDerivedStateFromError(error: unknown): {
        error: unknown;
    };
    render(): ReactNode;
}
type Elements = Record<string, unknown>;
type EnhanceFetch = (fetchFn: typeof fetch) => typeof fetch;
type EnhanceCreateData = (createData: (responsePromise: Promise<Response>) => Promise<Elements>) => (responsePromise: Promise<Response>) => Promise<Elements>;
type RouterData = [
    locationListeners?: Set<(path: string, query: string) => void>,
    staticPathSet?: Set<string>,
    cachedIdSet?: Set<string>,
    has404?: boolean
];
export declare function Router({ routerData, initialRoute, unstable_enhanceFetch, unstable_enhanceCreateData, }: {
    routerData?: RouterData;
    initialRoute?: RouteProps;
    unstable_enhanceFetch?: EnhanceFetch;
    unstable_enhanceCreateData?: EnhanceCreateData;
}): import("react").FunctionComponentElement<Omit<{
    initialRscPath?: string;
    initialRscParams?: unknown;
    fetchCache?: {
        e?: [rscPath: string, rscParams: unknown, elementsPromise: Promise<{
            [x: string]: unknown;
        }>];
        s?: (updater: (prev: Promise<{
            [x: string]: unknown;
        }>) => Promise<{
            [x: string]: unknown;
        }>) => void;
        f?: ((fetchFn: typeof fetch) => typeof fetch) | undefined;
        d?: ((createData: (responsePromise: Promise<Response>) => Promise<{
            [x: string]: unknown;
        }>) => (responsePromise: Promise<Response>) => Promise<{
            [x: string]: unknown;
        }>) | undefined;
    };
    unstable_enhanceFetch?: (fetchFn: typeof fetch) => typeof fetch;
    unstable_enhanceCreateData?: (createData: (responsePromise: Promise<Response>) => Promise<{
        [x: string]: unknown;
    }>) => (responsePromise: Promise<Response>) => Promise<{
        [x: string]: unknown;
    }>;
    children: ReactNode;
}, "children">>;
/**
 * ServerRouter for SSR
 * This is not a public API.
 */
export declare function INTERNAL_ServerRouter({ route, httpstatus, }: {
    route: RouteProps;
    httpstatus: number;
}): import("react").FunctionComponentElement<import("react").FragmentProps>;
export {};
