import type { Plugin } from 'vite';
import type { HotUpdatePayload } from './vite-plugin-rsc-hmr.js';
export declare function rscPrivatePlugin({ privateDir, hotUpdateCallback, }: {
    privateDir: string;
    hotUpdateCallback?: (payload: HotUpdatePayload) => void;
}): Plugin;
