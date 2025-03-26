import type { Plugin } from 'vite';
export declare function rscEntriesPlugin(opts: {
    basePath: string;
    rscBase: string;
    srcDir: string;
    ssrDir: string;
    moduleMap: Record<string, string>;
}): Plugin;
