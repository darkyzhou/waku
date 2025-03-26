import * as swc from '@swc/core';
import { EXTENSIONS } from '../builder/constants.js';
import { extname } from '../utils/path.js';
import { parseOpts } from '../utils/swc.js';
// HACK: Is it common to depend on another plugin like this?
import { rscTransformPlugin } from './vite-plugin-rsc-transform.js';
const hash = async (code)=>{
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b)=>b.toString(16).padStart(2, '0')).join('').slice(0, 9);
};
const isServerFunction = (node)=>node.body?.type === 'BlockStatement' && node.body.stmts.some((s)=>s.type === 'ExpressionStatement' && s.expression.type === 'StringLiteral' && s.expression.value === 'use server');
const containsServerFunction = (mod)=>{
    const walk = (node)=>{
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
            if (isServerFunction(node)) {
                return true;
            }
        }
        // FIXME do we need to walk the entire tree? feels inefficient
        return Object.values(node).some((value)=>(Array.isArray(value) ? value : [
                value
            ]).some((v)=>{
                if (typeof v?.type === 'string') {
                    return walk(v);
                }
                if (typeof v?.expression?.type === 'string') {
                    return walk(v.expression);
                }
                return false;
            }));
    };
    return walk(mod);
};
export function rscAnalyzePlugin(opts) {
    const rscTransform = rscTransformPlugin({
        isClient: false,
        isBuild: false,
        resolvedMap: new Map()
    }).transform;
    return {
        name: 'rsc-analyze-plugin',
        async transform (code, id, options) {
            const ext = extname(id);
            if (EXTENSIONS.includes(ext)) {
                const mod = swc.parseSync(code, parseOpts(ext));
                for (const item of mod.body){
                    if (item.type === 'ExpressionStatement' && item.expression.type === 'StringLiteral') {
                        if (!opts.clientFileMap.has(id) && item.expression.value === 'use client') {
                            opts.clientFileMap.set(id, await hash(code));
                        }
                        if (!opts.serverFileMap.has(id) && item.expression.value === 'use server') {
                            opts.serverFileMap.set(id, await hash(code));
                        }
                    }
                }
                if (!opts.isClient && !opts.clientFileMap.has(id) && !opts.serverFileMap.has(id) && code.includes('use server') && containsServerFunction(mod)) {
                    opts.serverFileMap.set(id, await hash(code));
                }
            }
            // Avoid walking after the client boundary
            if (!opts.isClient && opts.clientFileMap.has(id)) {
                // TODO this isn't efficient. let's refactor it in the future.
                return rscTransform.call(this, code, id, options);
            }
        }
    };
}

//# sourceMappingURL=vite-plugin-rsc-analyze.js.map