import type { Plugin } from 'vite';
export declare function rscEntriesPlugin(opts: {
    basePath: string;
    rscBase: string;
    middleware: string[];
    rootDir: string;
    srcDir: string;
    ssrDir: string;
    moduleMap: Record<string, string>;
}): Plugin;
