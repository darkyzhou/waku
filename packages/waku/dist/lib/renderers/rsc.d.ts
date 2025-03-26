import type { ReactNode } from 'react';
import type { default as RSDWServerType } from 'react-server-dom-webpack/server.edge';
import type { ConfigPrd } from '../config.js';
import type { HandlerContext, ErrorCallback } from '../middleware/types.js';
export declare function renderRsc(config: ConfigPrd, ctx: Pick<HandlerContext, 'unstable_modules' | 'unstable_devServer'>, elements: Record<string, unknown>, onError: Set<ErrorCallback>, moduleIdCallback?: (id: string) => void): Promise<ReadableStream>;
export declare function renderRscElement(config: ConfigPrd, ctx: Pick<HandlerContext, 'unstable_modules' | 'unstable_devServer'>, element: ReactNode, onError: Set<ErrorCallback>): ReadableStream;
export declare function collectClientModules(config: ConfigPrd, rsdwServer: {
    default: typeof RSDWServerType;
}, elements: Record<string, unknown>): Promise<string[]>;
export declare function decodeBody(ctx: Pick<HandlerContext, 'unstable_modules' | 'unstable_devServer' | 'req'>): Promise<unknown>;
type ExtractFormState = (actionResult: unknown) => ReturnType<(typeof RSDWServerType)['decodeFormState']>;
export declare const getExtractFormState: (ctx: object) => ExtractFormState;
export declare function decodePostAction(ctx: Pick<HandlerContext, 'unstable_modules' | 'unstable_devServer' | 'req'>): Promise<(() => Promise<unknown>) | null>;
export {};
