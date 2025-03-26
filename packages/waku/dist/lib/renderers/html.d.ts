import type { ReactNode } from 'react';
import type { ConfigDev, ConfigPrd } from '../config.js';
import type { HandlerContext, ErrorCallback } from '../middleware/types.js';
type Elements = Record<string, unknown>;
export declare function renderHtml(config: ConfigDev | ConfigPrd, ctx: Pick<HandlerContext, 'unstable_modules' | 'unstable_devServer'>, htmlHead: string, elements: Elements, onError: Set<ErrorCallback>, html: ReactNode, rscPath: string, actionResult?: unknown): Promise<ReadableStream & {
    allReady: Promise<void>;
}>;
export {};
