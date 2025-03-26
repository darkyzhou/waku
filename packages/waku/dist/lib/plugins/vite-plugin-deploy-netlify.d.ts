import type { Plugin } from 'vite';
export declare function deployNetlifyPlugin(opts: {
    srcDir: string;
    distDir: string;
    privateDir: string;
}): Plugin;
