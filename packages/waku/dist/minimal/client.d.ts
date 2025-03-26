import { Component } from 'react';
import type { ReactNode } from 'react';
declare global {
    interface ImportMeta {
        readonly env: Record<string, string>;
    }
}
type Elements = Record<string, unknown>;
type SetElements = (updater: (prev: Promise<Elements>) => Promise<Elements>) => void;
type EnhanceFetch = (fetchFn: typeof fetch) => typeof fetch;
type EnhanceCreateData = (createData: (responsePromise: Promise<Response>) => Promise<Elements>) => (responsePromise: Promise<Response>) => Promise<Elements>;
declare const ENTRY = "e";
declare const SET_ELEMENTS = "s";
declare const ENHANCE_FETCH = "f";
declare const ENHANCE_CREATE_DATA = "d";
type FetchCache = {
    [ENTRY]?: [
        rscPath: string,
        rscParams: unknown,
        elementsPromise: Promise<Elements>
    ];
    [SET_ELEMENTS]?: SetElements;
    [ENHANCE_FETCH]?: EnhanceFetch | undefined;
    [ENHANCE_CREATE_DATA]?: EnhanceCreateData | undefined;
};
/**
 * callServer callback
 * This is not a public API.
 */
export declare const unstable_callServerRsc: (funcId: string, args: unknown[], fetchCache?: FetchCache) => Promise<unknown>;
export declare const fetchRsc: (rscPath: string, rscParams?: unknown, fetchCache?: FetchCache) => Promise<Elements>;
export declare const prefetchRsc: (rscPath: string, rscParams?: unknown, fetchCache?: FetchCache) => void;
export declare const Root: ({ initialRscPath, initialRscParams, fetchCache, unstable_enhanceFetch, unstable_enhanceCreateData, children, }: {
    initialRscPath?: string;
    initialRscParams?: unknown;
    fetchCache?: FetchCache;
    unstable_enhanceFetch?: EnhanceFetch;
    unstable_enhanceCreateData?: EnhanceCreateData;
    children: ReactNode;
}) => import("react").FunctionComponentElement<import("react").ProviderProps<(rscPath: string, rscParams?: unknown) => void>>;
export declare const useRefetch: () => (rscPath: string, rscParams?: unknown) => void;
export declare const Children: () => ReactNode;
export declare const ThrowError_UNSTABLE: () => null;
export declare const useResetError_UNSTABLE: () => (() => void) | undefined;
export declare const useElement: (id: string) => unknown;
declare class GeneralErrorHandler extends Component<{
    children?: ReactNode;
    errorHandler: ReactNode;
}, {
    error: unknown | null;
}> {
    constructor(props: {
        children?: ReactNode;
        errorHandler: ReactNode;
    });
    static getDerivedStateFromError(error: unknown): {
        error: unknown;
    };
    reset(): void;
    render(): string | number | bigint | boolean | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | Iterable<ReactNode> | Promise<string | number | bigint | boolean | import("react").ReactPortal | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | import("react").FunctionComponentElement<import("react").ProviderProps<[error: unknown, reset: () => void] | undefined>> | null | undefined;
}
/**
 * Slot component
 * This is used under the Root component.
 * Slot id is the key of elements returned by the server.
 *
 * If the server returns this
 * ```
 *   { 'foo': <div>foo</div>, 'bar': <div>bar</div> }
 * ```
 * then you can use this component like this
 * ```
 *   <Root><Slot id="foo" /><Slot id="bar" /></Root>
 * ```
 */
export declare const Slot: ({ id, children, unstable_handleError, unstable_fallback, }: {
    id: string;
    children?: ReactNode;
    unstable_handleError?: ReactNode;
    unstable_fallback?: ReactNode;
}) => import("react").FunctionComponentElement<{
    id: string;
    children?: ReactNode;
    setValidElement?: (element: ReactNode) => void;
    unstable_fallback?: ReactNode;
}> | import("react").CElement<{
    children?: ReactNode;
    errorHandler: ReactNode;
}, GeneralErrorHandler>;
/**
 * ServerRoot for SSR
 * This is not a public API.
 */
export declare const INTERNAL_ServerRoot: ({ elementsPromise, children, }: {
    elementsPromise: Promise<Elements>;
    children: ReactNode;
}) => import("react").FunctionComponentElement<import("react").ProviderProps<Promise<Elements> | null>>;
export {};
