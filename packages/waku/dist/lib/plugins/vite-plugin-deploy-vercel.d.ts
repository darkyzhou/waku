import type { Plugin } from 'vite';
export declare function deployVercelPlugin(opts: {
    srcDir: string;
    distDir: string;
    basePath: string;
    rscBase: string;
    privateDir: string;
}): Plugin;
