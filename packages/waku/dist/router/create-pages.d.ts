import type { FunctionComponent, ReactNode } from 'react';
import type { RouteProps } from './common.js';
import type { AnyPage, GetSlugs, PropsForPages } from './create-pages-utils/inferred-path-types.js';
export declare const METHODS: readonly ["GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"];
export type Method = (typeof METHODS)[number];
/** Assumes that the path is a part of a slug path. */
type IsValidPathItem<T> = T extends `/${string}` | '[]' | '' ? false : true;
/**
 * This is a helper type to check if a path is valid in a slug path.
 */
export type IsValidPathInSlugPath<T> = T extends `/${infer L}/${infer R}` ? IsValidPathItem<L> extends true ? IsValidPathInSlugPath<`/${R}`> : false : T extends `/${infer U}` ? IsValidPathItem<U> : false;
/** Checks if a particular slug name exists in a path. */
export type HasSlugInPath<T, K extends string> = T extends `/[${K}]/${infer _}` ? true : T extends `/${infer _}/${infer U}` ? HasSlugInPath<`/${U}`, K> : T extends `/[${K}]` ? true : false;
export type HasWildcardInPath<T> = T extends `/[...${string}]/${string}` ? true : T extends `/${infer _}/${infer U}` ? HasWildcardInPath<`/${U}`> : T extends `/[...${string}]` ? true : false;
export type PathWithSlug<T, K extends string> = IsValidPathInSlugPath<T> extends true ? HasSlugInPath<T, K> extends true ? T : never : never;
export type StaticSlugRoutePathsTuple<T extends string, Slugs extends unknown[] = GetSlugs<T>, Result extends readonly string[] = []> = Slugs extends [] ? Result : Slugs extends [infer _, ...infer Rest] ? StaticSlugRoutePathsTuple<T, Rest, readonly [...Result, string]> : never;
type StaticSlugRoutePaths<T extends string> = HasWildcardInPath<T> extends true ? readonly string[] | readonly string[][] : StaticSlugRoutePathsTuple<T> extends readonly [string] ? readonly string[] : StaticSlugRoutePathsTuple<T>[];
/** Remove Slug from Path */
export type PathWithoutSlug<T> = T extends '/' ? T : IsValidPathInSlugPath<T> extends true ? HasSlugInPath<T, string> extends true ? never : T : never;
type PathWithStaticSlugs<T extends string> = T extends `/` ? T : IsValidPathInSlugPath<T> extends true ? T : never;
export type PathWithWildcard<Path, SlugKey extends string, WildSlugKey extends string> = PathWithSlug<Path, SlugKey | `...${WildSlugKey}`>;
export type CreatePage = <Path extends string, SlugKey extends string, WildSlugKey extends string, Render extends 'static' | 'dynamic', StaticPaths extends StaticSlugRoutePaths<Path>, ExactPath extends boolean | undefined = undefined>(page: ({
    render: Extract<Render, 'static'>;
    path: PathWithoutSlug<Path>;
    component: FunctionComponent<PropsForPages<Path>>;
} | ({
    render: Extract<Render, 'static'>;
    path: PathWithStaticSlugs<Path>;
    component: FunctionComponent<PropsForPages<Path>>;
} & (ExactPath extends true ? {} : {
    staticPaths: StaticPaths;
})) | {
    render: Extract<Render, 'dynamic'>;
    path: PathWithoutSlug<Path>;
    component: FunctionComponent<PropsForPages<Path>>;
} | {
    render: Extract<Render, 'dynamic'>;
    path: PathWithWildcard<Path, SlugKey, WildSlugKey>;
    component: FunctionComponent<PropsForPages<Path>>;
}) & {
    unstable_disableSSR?: boolean;
    /**
     * If true, the path will be matched exactly, without wildcards or slugs.
     * This is intended for extending support to create custom routers.
     */
    exactPath?: ExactPath;
}) => Omit<Exclude<typeof page, {
    path: never;
} | {
    render: never;
}>, 'unstable_disableSSR'>;
export type CreateLayout = <Path extends string>(layout: {
    render: 'dynamic';
    path: Path;
    component: FunctionComponent<Pick<RouteProps, 'path'> & {
        children: ReactNode;
    }>;
} | {
    render: 'static';
    path: Path;
    component: FunctionComponent<{
        children: ReactNode;
    }>;
}) => void;
type ApiHandler = (req: Request) => Promise<Response>;
export type CreateApi = <Path extends string>(params: {
    render: 'static';
    path: Path;
    method: 'GET';
    handler: ApiHandler;
} | {
    render: 'dynamic';
    path: Path;
    /**
     * Handlers by named method. Use `all` to handle all methods.
     * Named methods will take precedence over `all`.
     */
    handlers: Partial<Record<Method | 'all', ApiHandler>>;
}) => void;
export type CreatePagePart = <const Path extends string>(params: {
    path: Path;
    render: 'static' | 'dynamic';
    order: number;
    component: FunctionComponent<{
        children: ReactNode;
    }>;
}) => typeof params;
type RootItem = {
    render: 'static' | 'dynamic';
    component: FunctionComponent<{
        children: ReactNode;
    }>;
};
export type CreateRoot = (root: RootItem) => void;
export declare const createPages: <AllPages extends (AnyPage | ReturnType<CreateLayout>)[]>(fn: (fns: {
    createPage: CreatePage;
    createLayout: CreateLayout;
    createRoot: CreateRoot;
    createApi: CreateApi;
    /**
     * Page Part pages will be dynamic when any part is dynamic.
     * If all parts are static, the page will be static.
     */
    createPagePart: CreatePagePart;
}) => Promise<AllPages>) => {
    handleRequest: import("../lib/types.js").HandleRequest;
    handleBuild: import("../lib/types.js").HandleBuild;
} & {
    /** This for type inference of the router only. We do not actually return anything for this type. */
    DO_NOT_USE_pages: Exclude<Exclude<Awaited<Exclude<Promise<void | AllPages> | undefined, undefined>>, void>[number], void>;
};
export {};
