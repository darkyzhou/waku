export type RouteProps<Path extends string = string> = {
    path: Path;
    query: string;
    hash: string;
};
export declare function getComponentIds(path: string): readonly string[];
export declare function encodeRoutePath(path: string): string;
export declare function decodeRoutePath(rscPath: string): string;
export declare const ROUTE_ID = "ROUTE";
export declare const IS_STATIC_ID = "IS_STATIC";
export declare const HAS404_ID = "HAS404";
export declare const SKIP_HEADER = "X-Waku-Router-Skip";
