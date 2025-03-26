import type { Plugin } from 'vite';
export declare function rscEnvPlugin({ isDev, env, config, }: {
    isDev: boolean;
    env: Record<string, string>;
    config?: {
        basePath: string;
        rscBase: string;
    };
}): Plugin;
