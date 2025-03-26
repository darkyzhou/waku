import type { Plugin } from 'vite';
export declare function devCommonJsPlugin(opts: {
    filter?: (id: string) => boolean | undefined;
}): Plugin;
