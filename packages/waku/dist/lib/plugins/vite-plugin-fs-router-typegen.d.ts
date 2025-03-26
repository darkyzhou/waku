import type { Plugin } from 'vite';
export declare function toIdentifier(input: string): string;
export declare function getImportModuleNames(filePaths: string[]): {
    [k: string]: string;
};
export declare const fsRouterTypegenPlugin: (opts: {
    srcDir: string;
}) => Plugin;
