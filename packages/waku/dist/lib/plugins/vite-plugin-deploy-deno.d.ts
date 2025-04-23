import type { Plugin } from 'vite';
export declare function deployDenoPlugin(opts: {
    srcDir: string;
    distDir: string;
    unstable_honoEnhancer: string | undefined;
}): Plugin;
