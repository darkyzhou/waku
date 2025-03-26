import * as swc from '@swc/core';
import { EXTENSIONS } from '../builder/constants.js';
import { extname, joinPath } from '../utils/path.js';
import { parseOpts } from '../utils/swc.js';
const collectExportNames = (mod)=>{
    const exportNames = new Set();
    for (const item of mod.body){
        if (item.type === 'ExportDeclaration') {
            if (item.declaration.type === 'FunctionDeclaration') {
                exportNames.add(item.declaration.identifier.value);
            } else if (item.declaration.type === 'ClassDeclaration') {
                exportNames.add(item.declaration.identifier.value);
            } else if (item.declaration.type === 'VariableDeclaration') {
                for (const d of item.declaration.declarations){
                    if (d.id.type === 'Identifier') {
                        exportNames.add(d.id.value);
                    }
                }
            }
        } else if (item.type === 'ExportNamedDeclaration') {
            for (const s of item.specifiers){
                if (s.type === 'ExportSpecifier') {
                    exportNames.add(s.exported ? s.exported.value : s.orig.value);
                }
            }
        } else if (item.type === 'ExportDefaultExpression') {
            exportNames.add('default');
        } else if (item.type === 'ExportDefaultDeclaration') {
            exportNames.add('default');
        }
    }
    return exportNames;
};
const transformClient = (code, ext, getServerId)=>{
    if (!code.includes('use server')) {
        return;
    }
    const mod = swc.parseSync(code, parseOpts(ext));
    let hasUseServer = false;
    for (const item of mod.body){
        if (item.type === 'ExpressionStatement') {
            if (item.expression.type === 'StringLiteral' && item.expression.value === 'use server') {
                hasUseServer = true;
            }
        } else {
            break;
        }
    }
    if (hasUseServer) {
        const exportNames = collectExportNames(mod);
        let newCode = `
import { createServerReference } from 'react-server-dom-webpack/client';
import { unstable_callServerRsc as callServerRsc } from 'waku/minimal/client';
`;
        for (const name of exportNames){
            newCode += `
export ${name === 'default' ? name : `const ${name} =`} createServerReference('${getServerId()}#${name}', callServerRsc);
`;
        }
        return swc.transformSync(newCode, {
            jsc: {
                parser: parseOpts(ext),
                target: 'esnext'
            },
            sourceMaps: true
        });
    }
};
const transformClientForSSR = (code, ext)=>{
    if (!code.includes('use server')) {
        return;
    }
    const mod = swc.parseSync(code, parseOpts(ext));
    let hasUseServer = false;
    for (const item of mod.body){
        if (item.type === 'ExpressionStatement') {
            if (item.expression.type === 'StringLiteral' && item.expression.value === 'use server') {
                hasUseServer = true;
            }
        } else {
            break;
        }
    }
    if (hasUseServer) {
        const exportNames = collectExportNames(mod);
        let newCode = '';
        for (const name of exportNames){
            newCode += `
export ${name === 'default' ? name : `const ${name} =`} () => {
  throw new Error('You cannot call server functions during SSR');
};
`;
        }
        return swc.transformSync(newCode, {
            jsc: {
                parser: parseOpts(ext),
                target: 'esnext'
            },
            sourceMaps: true
        });
    }
};
export const createEmptySpan = ()=>({
        start: 0,
        end: 0
    });
const createIdentifier = (value)=>({
        type: 'Identifier',
        value,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        ctxt: 0,
        optional: false,
        span: createEmptySpan()
    });
const createStringLiteral = (value)=>({
        type: 'StringLiteral',
        value,
        span: createEmptySpan()
    });
const createCallExpression = (callee, args)=>({
        type: 'CallExpression',
        callee,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        ctxt: 0,
        arguments: args.map((expression)=>({
                expression
            })),
        span: createEmptySpan()
    });
const serverInitCode = swc.parseSync(`
import { registerServerReference as __waku_registerServerReference } from 'react-server-dom-webpack/server.edge';
`).body;
const findLastImportIndex = (mod)=>{
    const lastImportIndex = mod.body.findIndex((node)=>node.type !== 'ExpressionStatement' && node.type !== 'ImportDeclaration');
    return lastImportIndex === -1 ? 0 : lastImportIndex;
};
const replaceNode = (origNode, newNode)=>{
    Object.keys(origNode).forEach((key)=>{
        delete origNode[key];
    });
    return Object.assign(origNode, newNode);
};
const transformExportedClientThings = (mod, getFuncId)=>{
    const exportNames = new Set();
    // HACK this doesn't cover all cases
    const allowServerItems = new Map();
    const allowServerDependencies = new Set();
    const visited = new WeakSet();
    const findDependencies = (node)=>{
        if (visited.has(node)) {
            return;
        }
        visited.add(node);
        if (node.type === 'Identifier') {
            const id = node;
            if (!allowServerItems.has(id.value) && !exportNames.has(id.value)) {
                allowServerDependencies.add(id.value);
            }
        }
        Object.values(node).forEach((value)=>{
            (Array.isArray(value) ? value : [
                value
            ]).forEach((v)=>{
                if (typeof v?.type === 'string') {
                    findDependencies(v);
                } else if (typeof v?.expression?.type === 'string') {
                    findDependencies(v.expression);
                }
            });
        });
    };
    // Pass 1: find allowServer identifier
    let allowServer = 'unstable_allowServer';
    for (const item of mod.body){
        if (item.type === 'ImportDeclaration') {
            if (item.source.value === 'waku/client') {
                for (const specifier of item.specifiers){
                    if (specifier.type === 'ImportSpecifier') {
                        if (specifier.imported?.value === allowServer) {
                            allowServer = specifier.local.value;
                            break;
                        }
                    }
                }
                break;
            }
        }
    }
    // Pass 2: collect export names and allowServer names
    for (const item of mod.body){
        if (item.type === 'ExportDeclaration') {
            if (item.declaration.type === 'FunctionDeclaration') {
                exportNames.add(item.declaration.identifier.value);
            } else if (item.declaration.type === 'ClassDeclaration') {
                exportNames.add(item.declaration.identifier.value);
            } else if (item.declaration.type === 'VariableDeclaration') {
                for (const d of item.declaration.declarations){
                    if (d.id.type === 'Identifier') {
                        if (d.init?.type === 'CallExpression' && d.init.callee.type === 'Identifier' && d.init.callee.value === allowServer) {
                            if (d.init.arguments.length !== 1) {
                                throw new Error('allowServer should have exactly one argument');
                            }
                            allowServerItems.set(d.id.value, d.init.arguments[0].expression);
                            findDependencies(d.init);
                        } else {
                            exportNames.add(d.id.value);
                        }
                    }
                }
            }
        } else if (item.type === 'ExportNamedDeclaration') {
            for (const s of item.specifiers){
                if (s.type === 'ExportSpecifier') {
                    exportNames.add(s.exported ? s.exported.value : s.orig.value);
                }
            }
        } else if (item.type === 'ExportDefaultExpression') {
            exportNames.add('default');
        } else if (item.type === 'ExportDefaultDeclaration') {
            exportNames.add('default');
        }
    }
    // Pass 3: collect dependencies
    let dependenciesSize;
    do {
        dependenciesSize = allowServerDependencies.size;
        for (const item of mod.body){
            if (item.type === 'VariableDeclaration') {
                for (const d of item.declarations){
                    if (d.id.type === 'Identifier' && allowServerDependencies.has(d.id.value)) {
                        findDependencies(d);
                    }
                }
            } else if (item.type === 'FunctionDeclaration') {
                if (allowServerDependencies.has(item.identifier.value)) {
                    findDependencies(item);
                }
            } else if (item.type === 'ClassDeclaration') {
                if (allowServerDependencies.has(item.identifier.value)) {
                    findDependencies(item);
                }
            }
        }
    }while (dependenciesSize < allowServerDependencies.size)
    allowServerDependencies.delete(allowServer);
    // Pass 4: filter with dependencies
    for(let i = 0; i < mod.body.length; ++i){
        const item = mod.body[i];
        if (item.type === 'ImportDeclaration' && item.specifiers.some((s)=>s.type === 'ImportSpecifier' && allowServerDependencies.has(s.imported ? s.imported.value : s.local.value))) {
            continue;
        }
        if (item.type === 'VariableDeclaration') {
            item.declarations = item.declarations.filter((d)=>d.id.type === 'Identifier' && allowServerDependencies.has(d.id.value));
            if (item.declarations.length) {
                continue;
            }
        }
        if (item.type === 'FunctionDeclaration') {
            if (allowServerDependencies.has(item.identifier.value)) {
                continue;
            }
        }
        if (item.type === 'ClassDeclaration') {
            if (allowServerDependencies.has(item.identifier.value)) {
                continue;
            }
        }
        mod.body.splice(i--, 1);
    }
    // Pass 5: add allowServer exports
    for (const [allowServerName, callExp] of allowServerItems){
        const stmt = {
            type: 'ExportDeclaration',
            declaration: {
                type: 'VariableDeclaration',
                kind: 'const',
                declare: false,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                ctxt: 0,
                declarations: [
                    {
                        type: 'VariableDeclarator',
                        id: createIdentifier(allowServerName),
                        init: createCallExpression(createIdentifier('__waku_registerClientReference'), [
                            callExp,
                            createStringLiteral(getFuncId()),
                            createStringLiteral(allowServerName)
                        ]),
                        definite: false,
                        span: createEmptySpan()
                    }
                ],
                span: createEmptySpan()
            },
            span: createEmptySpan()
        };
        mod.body.push(stmt);
    }
    return exportNames;
};
const transformExportedServerFunctions = (mod, getFuncId)=>{
    let changed = false;
    for(let i = 0; i < mod.body.length; ++i){
        const item = mod.body[i];
        const handleDeclaration = (name, fn)=>{
            changed = true;
            if (fn.body) {
                fn.body.stmts = fn.body.stmts.filter((stmt)=>!isUseServerDirective(stmt));
            }
            const stmt = {
                type: 'ExpressionStatement',
                expression: createCallExpression(createIdentifier('__waku_registerServerReference'), [
                    createIdentifier(name),
                    createStringLiteral(getFuncId()),
                    createStringLiteral(name)
                ]),
                span: createEmptySpan()
            };
            mod.body.splice(++i, 0, stmt);
        };
        const handleExpression = (name, fn)=>{
            changed = true;
            if (fn.body?.type === 'BlockStatement') {
                fn.body.stmts = fn.body.stmts.filter((stmt)=>!isUseServerDirective(stmt));
            }
            const callExp = createCallExpression(createIdentifier('__waku_registerServerReference'), [
                Object.assign({}, fn),
                createStringLiteral(getFuncId()),
                createStringLiteral(name)
            ]);
            replaceNode(fn, callExp);
        };
        if (item.type === 'ExportDeclaration') {
            if (item.declaration.type === 'FunctionDeclaration') {
                handleDeclaration(item.declaration.identifier.value, item.declaration);
            } else if (item.declaration.type === 'VariableDeclaration') {
                for (const d of item.declaration.declarations){
                    if (d.id.type === 'Identifier' && (d.init?.type === 'FunctionExpression' || d.init?.type === 'ArrowFunctionExpression')) {
                        handleExpression(d.id.value, d.init);
                    }
                }
            }
        } else if (item.type === 'ExportDefaultDeclaration') {
            if (item.decl.type === 'FunctionExpression') {
                handleExpression('default', item.decl);
                const callExp = item.decl;
                const decl = {
                    type: 'ExportDefaultExpression',
                    expression: callExp,
                    span: createEmptySpan()
                };
                replaceNode(item, decl);
            }
        } else if (item.type === 'ExportDefaultExpression') {
            if (item.expression.type === 'FunctionExpression' || item.expression.type === 'ArrowFunctionExpression') {
                handleExpression('default', item.expression);
            }
        }
    }
    return changed;
};
const isUseServerDirective = (node)=>node.type === 'ExpressionStatement' && node.expression.type === 'StringLiteral' && node.expression.value === 'use server';
const isInlineServerFunction = (node)=>(node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') && node.body?.type === 'BlockStatement' && node.body.stmts.some(isUseServerDirective);
const prependArgsToFn = (fn, args)=>{
    if (fn.type === 'ArrowFunctionExpression') {
        return {
            ...fn,
            params: [
                ...args.map(createIdentifier),
                ...fn.params
            ],
            body: {
                type: 'BlockStatement',
                ctxt: 0,
                stmts: fn.body.stmts.filter((stmt)=>!isUseServerDirective(stmt)),
                span: createEmptySpan()
            }
        };
    }
    return {
        ...fn,
        params: [
            ...args.map((arg)=>({
                    type: 'Parameter',
                    pat: createIdentifier(arg),
                    span: createEmptySpan()
                })),
            ...fn.params
        ],
        body: {
            type: 'BlockStatement',
            ctxt: 0,
            stmts: fn.body.stmts.filter((stmt)=>!isUseServerDirective(stmt)),
            span: createEmptySpan()
        }
    };
};
// HACK this doesn't work for 100% of cases
const collectIndentifiers = (node, ids)=>{
    if (node.type === 'Identifier') {
        ids.add(node.value);
    } else if (node.type === 'MemberExpression') {
        collectIndentifiers(node.object, ids);
    } else if (node.type === 'KeyValuePatternProperty') {
        collectIndentifiers(node.key, ids);
    } else if (node.type === 'AssignmentPatternProperty') {
        collectIndentifiers(node.key, ids);
    } else {
        Object.values(node).forEach((value)=>{
            if (Array.isArray(value)) {
                value.forEach((v)=>collectIndentifiers(v, ids));
            } else if (typeof value === 'object' && value !== null) {
                collectIndentifiers(value, ids);
            }
        });
    }
};
// HACK this doesn't work for 100% of cases
const collectLocalNames = (fn, ids)=>{
    fn.params.forEach((param)=>{
        collectIndentifiers(param, ids);
    });
    let stmts;
    if (!fn.body) {
        stmts = [];
    } else if (fn.body?.type === 'BlockStatement') {
        stmts = fn.body.stmts;
    } else {
        // body is Expression
        stmts = [
            {
                type: 'ReturnStatement',
                argument: fn.body,
                span: createEmptySpan()
            }
        ];
    }
    for (const stmt of stmts){
        if (stmt.type === 'VariableDeclaration') {
            for (const decl of stmt.declarations){
                collectIndentifiers(decl.id, ids);
            }
        }
    }
};
const collectClosureVars = (parentFn, fn)=>{
    const parentFnVarNames = new Set();
    if (parentFn) {
        collectLocalNames(parentFn, parentFnVarNames);
    }
    const fnVarNames = new Set();
    collectIndentifiers(fn, fnVarNames);
    const varNames = Array.from(parentFnVarNames).filter((n)=>fnVarNames.has(n));
    return varNames;
};
const transformInlineServerFunctions = (mod, getFuncId)=>{
    let serverFunctionIndex = 0;
    const serverFunctions = new Map();
    const registerServerFunction = (parentFn, fn)=>{
        const closureVars = collectClosureVars(parentFn, fn);
        serverFunctions.set(++serverFunctionIndex, [
            fn,
            closureVars
        ]);
        const name = '__waku_func' + serverFunctionIndex;
        if (fn.type === 'FunctionDeclaration') {
            fn.identifier = createIdentifier(name);
        }
        return createCallExpression({
            type: 'MemberExpression',
            object: createIdentifier(name),
            property: createIdentifier('bind'),
            span: createEmptySpan()
        }, [
            createIdentifier('null'),
            ...closureVars.map((v)=>createIdentifier(v))
        ]);
    };
    const handleDeclaration = (parentFn, decl)=>{
        if (isInlineServerFunction(decl)) {
            const callExp = registerServerFunction(parentFn, Object.assign({}, decl));
            const newDecl = {
                type: 'VariableDeclaration',
                kind: 'const',
                declare: false,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                ctxt: 0,
                declarations: [
                    {
                        type: 'VariableDeclarator',
                        id: createIdentifier(decl.identifier.value),
                        init: callExp,
                        definite: false,
                        span: createEmptySpan()
                    }
                ],
                span: createEmptySpan()
            };
            replaceNode(decl, newDecl);
        }
    };
    const handleExpression = (parentFn, exp)=>{
        if (isInlineServerFunction(exp)) {
            const callExp = registerServerFunction(parentFn, Object.assign({}, exp));
            return replaceNode(exp, callExp);
        }
    };
    const walk = (parentFn, node)=>{
        if (node.type === 'ExportDefaultDeclaration') {
            const item = node;
            if (item.decl.type === 'FunctionExpression') {
                const callExp = handleExpression(parentFn, item.decl);
                if (callExp) {
                    const decl = {
                        type: 'ExportDefaultExpression',
                        expression: callExp,
                        span: createEmptySpan()
                    };
                    replaceNode(item, decl);
                    return;
                }
            }
        }
        // FIXME do we need to walk the entire tree? feels inefficient
        Object.values(node).forEach((value)=>{
            const fn = node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' ? node : parentFn;
            (Array.isArray(value) ? value : [
                value
            ]).forEach((v)=>{
                if (typeof v?.type === 'string') {
                    walk(fn, v);
                } else if (typeof v?.expression?.type === 'string') {
                    walk(fn, v.expression);
                }
            });
        });
        if (node.type === 'FunctionDeclaration') {
            handleDeclaration(parentFn, node);
        } else if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
            handleExpression(parentFn, node);
        }
    };
    walk(undefined, mod);
    if (!serverFunctionIndex) {
        return false;
    }
    const serverFunctionsCode = Array.from(serverFunctions).flatMap(([funcIndex, [func, closureVars]])=>{
        if (func.type === 'FunctionDeclaration') {
            const stmt1 = {
                type: 'ExportDeclaration',
                declaration: prependArgsToFn(func, closureVars),
                span: createEmptySpan()
            };
            const stmt2 = {
                type: 'ExpressionStatement',
                expression: createCallExpression(createIdentifier('__waku_registerServerReference'), [
                    createIdentifier(func.identifier.value),
                    createStringLiteral(getFuncId()),
                    createStringLiteral('__waku_func' + funcIndex)
                ]),
                span: createEmptySpan()
            };
            return [
                stmt1,
                stmt2
            ];
        } else {
            const stmt = {
                type: 'ExportDeclaration',
                declaration: {
                    type: 'VariableDeclaration',
                    kind: 'const',
                    declare: false,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    ctxt: 0,
                    declarations: [
                        {
                            type: 'VariableDeclarator',
                            id: createIdentifier('__waku_func' + funcIndex),
                            init: createCallExpression(createIdentifier('__waku_registerServerReference'), [
                                prependArgsToFn(func, closureVars),
                                createStringLiteral(getFuncId()),
                                createStringLiteral('__waku_func' + funcIndex)
                            ]),
                            definite: false,
                            span: createEmptySpan()
                        }
                    ],
                    span: createEmptySpan()
                },
                span: createEmptySpan()
            };
            return [
                stmt
            ];
        }
    });
    mod.body.splice(findLastImportIndex(mod), 0, ...serverFunctionsCode);
    return true;
};
const transformServer = (code, ext, getClientId, getServerId)=>{
    if (!code.includes('use client') && !code.includes('use server')) {
        return;
    }
    const mod = swc.parseSync(code, parseOpts(ext));
    let hasUseClient = false;
    let hasUseServer = false;
    for(let i = 0; i < mod.body.length; ++i){
        const item = mod.body[i];
        if (item.type === 'ExpressionStatement') {
            if (item.expression.type === 'StringLiteral') {
                if (item.expression.value === 'use client') {
                    hasUseClient = true;
                    break;
                } else if (item.expression.value === 'use server') {
                    hasUseServer = true;
                    mod.body.splice(i, 1); // remove this directive
                    break;
                }
            }
        } else {
        // HACK we can't stop the loop here, because vite may put some import statements before the directives
        // break;
        }
    }
    if (hasUseClient) {
        const exportNames = transformExportedClientThings(mod, getClientId);
        let newCode = `
import { registerClientReference as __waku_registerClientReference } from 'react-server-dom-webpack/server.edge';
`;
        newCode += swc.printSync(mod).code;
        for (const name of exportNames){
            newCode += `
export ${name === 'default' ? name : `const ${name} =`} __waku_registerClientReference(() => { throw new Error('It is not possible to invoke a client function from the server: ${getClientId()}#${name}'); }, '${getClientId()}', '${name}');
`;
        }
        return swc.transformSync(newCode, {
            jsc: {
                parser: parseOpts(ext),
                target: 'esnext'
            },
            sourceMaps: true
        });
    }
    let transformed = hasUseServer && transformExportedServerFunctions(mod, getServerId);
    transformed = transformInlineServerFunctions(mod, getServerId) || transformed;
    if (transformed) {
        mod.body.splice(findLastImportIndex(mod), 0, ...serverInitCode);
        return swc.printSync(mod, {
            sourceMaps: true
        });
    }
};
export function rscTransformPlugin(opts) {
    const getClientId = (id)=>{
        if (opts.isClient) {
            throw new Error('getClientId is only for server');
        }
        if (!opts.isBuild) {
            return id.split('?')[0];
        }
        for (const [k, v] of Object.entries(opts.clientEntryFiles)){
            if (v === id) {
                return k;
            }
        }
        throw new Error('client id not found: ' + id);
    };
    const getServerId = (id)=>{
        if (!opts.isBuild) {
            return id.split('?')[0];
        }
        for (const [k, v] of Object.entries(opts.serverEntryFiles)){
            if (v === id) {
                return k;
            }
        }
        throw new Error('server id not found: ' + id);
    };
    return {
        name: 'rsc-transform-plugin',
        enforce: 'pre',
        async resolveId (id, importer, options) {
            if (opts.isBuild) {
                return;
            }
            if (id.startsWith('/@id/')) {
                return (await this.resolve(id.slice('/@id/'.length), importer, options))?.id;
            }
            if (id.startsWith('/@fs/')) {
                return (await this.resolve(id.slice('/@fs'.length), importer, options))?.id;
            }
            if ('resolvedMap' in opts) {
                const resolved = await this.resolve(id, importer, options);
                const srcId = importer && (id.startsWith('./') || id.startsWith('../')) ? joinPath(importer.split('?')[0], '..', id) : id;
                const dstId = resolved && resolved.id.split('?')[0];
                if (dstId && dstId !== srcId) {
                    if (!opts.resolvedMap.has(dstId)) {
                        opts.resolvedMap.set(dstId, srcId);
                    }
                }
            }
        },
        async transform (code, id, options) {
            const ext = opts.isBuild ? extname(id) : extname(id.split('?')[0]);
            if (!EXTENSIONS.includes(ext)) {
                return;
            }
            if (opts.isClient) {
                if (options?.ssr) {
                    return transformClientForSSR(code, ext);
                }
                return transformClient(code, ext, ()=>getServerId(id));
            }
            // isClient === false
            if (!options?.ssr) {
                return;
            }
            return transformServer(code, ext, ()=>getClientId(id), ()=>getServerId(id));
        }
    };
}

//# sourceMappingURL=vite-plugin-rsc-transform.js.map