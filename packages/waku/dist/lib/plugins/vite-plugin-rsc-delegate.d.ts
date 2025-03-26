import type { Plugin } from 'vite';
import type { HotUpdatePayload } from './vite-plugin-rsc-hmr.js';
export declare function rscDelegatePlugin(callback: (payload: HotUpdatePayload) => void): Plugin;
