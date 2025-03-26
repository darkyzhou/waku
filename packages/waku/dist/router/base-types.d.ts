import type { PagePath, PropsForPages } from './create-pages-utils/inferred-path-types.js';
export type { PathsForPages, GetConfigResponse, } from './create-pages-utils/inferred-path-types.js';
export interface RouteConfig {
}
export interface CreatePagesConfig {
}
/** Props for pages when using `createPages` */
export type PageProps<Path extends PagePath<CreatePagesConfig> | (string & {})> = PropsForPages<Path>;
