import type { Plugin } from 'vite';
export declare function rscAnalyzePlugin(opts: {
    isClient: true;
    clientFileMap: Map<string, string>;
    serverFileMap: Map<string, string>;
} | {
    isClient: false;
    clientFileMap: Map<string, string>;
    serverFileMap: Map<string, string>;
}): Plugin;
