export * as unstable_builderConstants from './lib/builder/constants.js';
export { emitPlatformData as unstable_emitPlatformData } from './lib/builder/platform-data.js';
/**
 * This is an internal function and not for public use.
 */
export declare function INTERNAL_setAllEnv(newEnv: Readonly<Record<string, string>>): void;
export declare function getEnv(key: string): string | undefined;
/**
 * This is an internal function and not for public use.
 */
export declare function INTERNAL_iterateSerializablePlatformData(): Iterable<[
    string,
    unknown
]>;
/**
 * This is an internal function and not for public use.
 */
export declare function INTERNAL_setPlatformDataLoader(loader: (key: string) => Promise<unknown>): void;
export declare function unstable_setPlatformData<T>(key: string, data: T, serializable: boolean): Promise<void>;
export declare function unstable_getPlatformData<T>(key: string): Promise<T | undefined>;
export declare function unstable_getHeaders(): Readonly<Record<string, string>>;
type BuildOptions = {
    deploy?: 'vercel-static' | 'vercel-serverless' | 'netlify-static' | 'netlify-functions' | 'cloudflare' | 'partykit' | 'deno' | 'aws-lambda' | 'txiki' | undefined;
    unstable_phase?: 'analyzeEntries' | 'buildServerBundle' | 'buildSsrBundle' | 'buildClientBundle' | 'buildDeploy' | 'emitStaticFiles';
};
export declare function unstable_getBuildOptions(): BuildOptions;
export declare function unstable_createAsyncIterable<T extends () => unknown>(create: () => Promise<Iterable<T>>): AsyncIterable<Awaited<ReturnType<T>>>;
