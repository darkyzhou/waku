import type { Plugin } from 'vite';
export declare function deployCloudflarePlugin(opts: {
    srcDir: string;
    distDir: string;
    privateDir: string;
    unstable_honoEnhancer: string | undefined;
}): Plugin;
