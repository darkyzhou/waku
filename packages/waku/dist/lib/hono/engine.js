import { resolveConfigDev } from '../config.js';
// Internal context key
const HONO_CONTEXT = '__hono_context';
// serverEngine returns hono middleware that runs Waku middleware.
export const serverEngine = (options)=>{
    const middlewarePromise = options.cmd === 'start' ? options.loadEntries().then((entries)=>entries.loadMiddleware()) : resolveConfigDev(options.config).then((config)=>loadMiddlewareDev(config));
    const handlersPromise = middlewarePromise.then((middlewareList)=>middlewareList.map((middleware)=>middleware.default(options)));
    return async (c, next)=>{
        const ctx = {
            req: {
                body: c.req.raw.body,
                url: new URL(c.req.url),
                method: c.req.method,
                headers: c.req.header()
            },
            res: {},
            data: {
                [HONO_CONTEXT]: c
            }
        };
        const handlers = await handlersPromise;
        const run = async (index)=>{
            if (index >= handlers.length) {
                return;
            }
            let alreadyCalled = false;
            await handlers[index](ctx, async ()=>{
                if (!alreadyCalled) {
                    alreadyCalled = true;
                    await run(index + 1);
                }
            });
        };
        await run(0);
        if (ctx.res.body || ctx.res.status) {
            const status = ctx.res.status || 200;
            const headers = ctx.res.headers || {};
            if (ctx.res.body) {
                return c.body(ctx.res.body, status, headers);
            }
            return c.body(null, status, headers);
        }
        await next();
    };
};
const DO_NOT_BUNDLE = '';
async function loadMiddlewareDev(configDev) {
    const [{ resolve }, { pathToFileURL }, { loadServerModule }] = await Promise.all([
        import(/* @vite-ignore */ DO_NOT_BUNDLE + 'node:path'),
        import(/* @vite-ignore */ DO_NOT_BUNDLE + 'node:url'),
        import(/* @vite-ignore */ DO_NOT_BUNDLE + '../utils/vite-loader.js')
    ]);
    return Promise.all(configDev.middleware.map(async (file)=>{
        const idOrFileURL = file.startsWith('./') ? pathToFileURL(resolve(file)).toString() : file;
        return loadServerModule(idOrFileURL);
    }));
}

//# sourceMappingURL=engine.js.map