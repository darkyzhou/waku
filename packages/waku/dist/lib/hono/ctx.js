import { getContextData } from '../middleware/context.js';
// Internal context key
const HONO_CONTEXT = '__hono_context';
export const getHonoContext = ()=>{
    const c = getContextData()[HONO_CONTEXT];
    if (!c) {
        throw new Error('Hono context is not available');
    }
    return c;
};

//# sourceMappingURL=ctx.js.map