import type { Plugin } from 'vite';
export declare function rscIndexPlugin(opts: {
    basePath: string;
    srcDir: string;
    cssAssets?: string[];
}): Plugin;
