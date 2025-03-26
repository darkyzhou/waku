import type { Plugin } from 'vite';
import * as swc from '@swc/core';
export declare const createEmptySpan: () => swc.Span;
export declare function rscTransformPlugin(opts: {
    isClient: true;
    isBuild: false;
} | {
    isClient: true;
    isBuild: true;
    serverEntryFiles: Record<string, string>;
} | {
    isClient: false;
    isBuild: false;
    resolvedMap: Map<string, string>;
} | {
    isClient: false;
    isBuild: true;
    clientEntryFiles: Record<string, string>;
    serverEntryFiles: Record<string, string>;
}): Plugin;
