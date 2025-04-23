import type { Plugin } from 'vite';
export declare function deployAwsLambdaPlugin(opts: {
    srcDir: string;
    distDir: string;
    unstable_honoEnhancer: string | undefined;
}): Plugin;
