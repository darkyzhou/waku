import type { Plugin } from 'vite';
export declare function rscManagedPlugin(opts: {
    basePath: string;
    srcDir: string;
    pagesDir: string;
    apiDir: string;
    addEntriesToInput?: boolean;
    addMainToInput?: boolean;
}): Plugin;
