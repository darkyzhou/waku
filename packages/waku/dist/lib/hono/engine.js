import { resolveConfigDev } from '../config.js';
// Internal context key
const HONO_CONTEXT = '__hono_context';
// serverEngine returns hono middleware that runs Waku middleware.
export const serverEngine = (options)=>{
    const entriesPromise = options.cmd === 'start' ? options.loadEntries() : 'Error: loadEntries are not available';
    const configPromise = options.cmd === 'start' ? entriesPromise.then((entries)=>// TODO eliminate loadConfig
        entries.loadConfig().then((config)=>resolveConfigDev(config))) : resolveConfigDev(options.config);
    const handlersPromise = configPromise.then((config)=>Promise.all(config.middleware().map(async (middleware)=>(await middleware).default(options))));
    return async (c, next)=>{
        const ctx = {
            req: {
                body: c.req.raw.body,
                url: new URL(c.req.url),
                method: c.req.method,
                headers: c.req.header()
            },
            res: {},
            context: {
                [HONO_CONTEXT]: c
            },
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

//# sourceMappingURL=engine.js.map