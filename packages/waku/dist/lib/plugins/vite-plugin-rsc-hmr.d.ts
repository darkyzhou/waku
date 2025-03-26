import type { Plugin, TransformResult, ViteDevServer } from 'vite';
type ModuleImportResult = TransformResult & {
    id: string;
    source: string;
    css?: boolean;
};
export declare function rscHmrPlugin(): Plugin;
export type HotUpdatePayload = {
    type: 'full-reload';
} | {
    type: 'custom';
    event: 'rsc-reload';
} | {
    type: 'custom';
    event: 'hot-import';
    data: string;
} | {
    type: 'custom';
    event: 'module-import';
    data: ModuleImportResult;
};
export declare function hotUpdate(vite: ViteDevServer, payload: HotUpdatePayload): void;
export {};
