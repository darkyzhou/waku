import * as swc from '@swc/core';
import { EXTENSIONS } from '../builder/constants.js';
import { extname } from '../utils/path.js';
import { parseOpts } from '../utils/swc.js';
const isClientEntry = (id, code)=>{
    const ext = extname(id);
    if (EXTENSIONS.includes(ext)) {
        const mod = swc.parseSync(code, parseOpts(ext));
        for (const item of mod.body){
            if (item.type === 'ExpressionStatement' && item.expression.type === 'StringLiteral' && item.expression.value === 'use client') {
                return true;
            }
        }
    }
    return false;
};
// import { CSS_LANGS_RE } from "vite/dist/node/constants.js";
const CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
export function rscDelegatePlugin(callback) {
    const moduleImports = new Set();
    let mode = 'development';
    let base = '/';
    let server;
    const updateStyle = async (id, importer)=>{
        const resolvedSource = await server.pluginContainer.resolveId(id, importer, {
            ssr: true
        });
        if (resolvedSource?.id) {
            const { default: source } = await server.ssrLoadModule(resolvedSource.id);
            const transformedResult = await server.transformRequest(resolvedSource.id);
            if (transformedResult) {
                moduleImports.add(resolvedSource.id);
                callback({
                    type: 'custom',
                    event: 'module-import',
                    data: {
                        ...transformedResult,
                        source,
                        id: resolvedSource.id,
                        css: true
                    }
                });
            }
        }
    };
    const styleFiles = new Map(); // id -> importer
    const updateAllStyles = async ()=>{
        for (const [id, importer] of styleFiles){
            await updateStyle(id, importer);
        }
    };
    return {
        name: 'rsc-delegate-plugin',
        configResolved (config) {
            mode = config.mode;
            base = config.base;
        },
        configureServer (serverInstance) {
            server = serverInstance;
        },
        async handleHotUpdate (ctx) {
            if (mode === 'development') {
                if (ctx.file.endsWith('/pages.gen.ts')) {
                    // auto generated file by fsRouterTypegenPlugin
                    return [];
                }
                await updateAllStyles(); // FIXME is this too aggressive?
                if (moduleImports.has(ctx.file)) {
                    // re-inject
                    const transformedResult = await server.transformRequest(ctx.file);
                    if (transformedResult) {
                        const { default: source } = await server.ssrLoadModule(ctx.file);
                        console.log('[rsc] module import', ctx.file);
                        callback({
                            type: 'custom',
                            event: 'module-import',
                            data: {
                                ...transformedResult,
                                source,
                                id: ctx.file
                            }
                        });
                    }
                }
                if (ctx.modules.length && !isClientEntry(ctx.file, await ctx.read())) {
                    console.log('[rsc] hot reload', ctx.file);
                    callback({
                        type: 'custom',
                        event: 'rsc-reload'
                    });
                }
            }
            return [];
        },
        async transform (code, id) {
            // id can contain query string with vite deps optimization
            id = id.split('?')[0];
            const ext = extname(id);
            if (mode === 'development' && EXTENSIONS.includes(ext)) {
                const mod = swc.parseSync(code, parseOpts(ext));
                for (const item of mod.body){
                    if (item.type === 'ImportDeclaration') {
                        if (item.source.value.startsWith('virtual:')) {
                            // HACK this relies on Vite's internal implementation detail.
                            const source = base + '@id/__x00__' + item.source.value;
                            callback({
                                type: 'custom',
                                event: 'hot-import',
                                data: source
                            });
                        } else if (CSS_LANGS_RE.test(item.source.value)) {
                            styleFiles.set(item.source.value, id);
                            await updateStyle(item.source.value, id);
                        }
                    }
                }
            }
            return code;
        }
    };
}

//# sourceMappingURL=vite-plugin-rsc-delegate.js.map