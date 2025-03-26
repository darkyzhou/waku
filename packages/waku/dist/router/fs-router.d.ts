export declare function unstable_fsRouter(importMetaUrl: string, loadPage: (file: string) => Promise<any> | undefined, options: {
    /** e.g. `"pages"` will detect pages in `src/pages`. */
    pagesDir: string;
    /**
     * e.g. `"api"` will detect pages in `src/pages/api`. Or, if `options.pagesDir`
     * is `"foo"`, then it will detect pages in `src/foo/api`.
     */
    apiDir: string;
}): {
    handleRequest: import("../lib/types.js").HandleRequest;
    handleBuild: import("../lib/types.js").HandleBuild;
} & {
    DO_NOT_USE_pages: never;
};
