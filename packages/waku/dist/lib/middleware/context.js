const setContextStorage = (storage)=>{
    globalThis.__WAKU_MIDDLEWARE_CONTEXT_STORAGE__ ||= storage;
};
const getContextStorage = ()=>{
    return globalThis.__WAKU_MIDDLEWARE_CONTEXT_STORAGE__;
};
try {
    const { AsyncLocalStorage } = await import('node:async_hooks');
    setContextStorage(new AsyncLocalStorage());
} catch  {
    console.warn('AsyncLocalStorage is not available');
}
let previousContext;
let currentContext;
const runWithContext = (context, fn)=>{
    const contextStorage = getContextStorage();
    if (contextStorage) {
        return contextStorage.run(context, fn);
    }
    previousContext = currentContext;
    currentContext = context;
    try {
        return fn();
    } finally{
        currentContext = previousContext;
    }
};
export const context = ()=>{
    return async (ctx, next)=>{
        const context = {
            req: ctx.req,
            data: ctx.data
        };
        return runWithContext(context, next);
    };
};
export function getContext() {
    const contextStorage = getContextStorage();
    const context = contextStorage?.getStore() ?? currentContext;
    if (!context) {
        throw new Error('Context is not available. Make sure to use the context middleware. For now, Context is not available during the build time.');
    }
    return context;
}
export function getContextData() {
    const contextStorage = getContextStorage();
    const context = contextStorage?.getStore() ?? currentContext;
    if (!context) {
        return {};
    }
    return context.data;
}

//# sourceMappingURL=context.js.map