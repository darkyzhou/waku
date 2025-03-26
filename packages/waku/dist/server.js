import { getContext } from './middleware/context.js';
export * as unstable_builderConstants from './lib/builder/constants.js';
export { emitPlatformData as unstable_emitPlatfromData } from './lib/builder/platform-data.js';
// The use of `globalThis` in this file is more or less a hack.
// It should be revisited with a better solution.
/**
 * This is an internal function and not for public use.
 */ export function INTERNAL_setAllEnv(newEnv) {
    globalThis.__WAKU_SERVER_ENV__ = newEnv;
}
export function getEnv(key) {
    return globalThis.__WAKU_SERVER_ENV__?.[key];
}
/**
 * This is an internal function and not for public use.
 */ export function INTERNAL_iterateSerializablePlatformData() {
    const platformData = globalThis.__WAKU_SERVER_PLATFORM_DATA__ ||= {};
    return Object.entries(platformData).flatMap(([key, [data, serializable]])=>serializable ? [
            [
                key,
                data
            ]
        ] : []);
}
/**
 * This is an internal function and not for public use.
 */ export function INTERNAL_setPlatformDataLoader(loader) {
    globalThis.__WAKU_SERVER_PLATFORM_DATA_LOADER__ = loader;
}
export async function unstable_setPlatformData(key, data, serializable) {
    const platformData = globalThis.__WAKU_SERVER_PLATFORM_DATA__ ||= {};
    platformData[key] = [
        data,
        serializable
    ];
}
export async function unstable_getPlatformData(key) {
    const platformData = globalThis.__WAKU_SERVER_PLATFORM_DATA__ ||= {};
    const item = platformData[key];
    if (item) {
        return item[0];
    }
    const loader = globalThis.__WAKU_SERVER_PLATFORM_DATA_LOADER__;
    if (loader) {
        return loader(key);
    }
}
export function unstable_getHeaders() {
    return getContext().req.headers;
}
// TODO tentative name
export function unstable_getBuildOptions() {
    return globalThis.__WAKU_BUILD_OPTIONS__ ||= {};
}
export function unstable_createAsyncIterable(create) {
    return {
        [Symbol.asyncIterator]: ()=>{
            let tasks;
            return {
                next: async ()=>{
                    if (!tasks) {
                        tasks = Array.from(await create());
                    }
                    const task = tasks.shift();
                    if (task) {
                        return {
                            value: await task()
                        };
                    }
                    return {
                        done: true,
                        value: undefined
                    };
                }
            };
        }
    };
}

//# sourceMappingURL=server.js.map