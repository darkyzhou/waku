import { createElement } from 'react';
import { unstable_getPlatformData, unstable_setPlatformData, unstable_createAsyncIterable as createAsyncIterable } from '../server.js';
import { unstable_defineEntries as defineEntries } from '../minimal/server.js';
import { encodeRoutePath, decodeRoutePath, ROUTE_ID, IS_STATIC_ID, HAS404_ID, SKIP_HEADER } from './common.js';
import { getPathMapping, path2regexp } from '../lib/utils/path.js';
import { INTERNAL_ServerRouter } from './client.js';
import { getContext } from '../middleware/context.js';
import { stringToStream } from '../lib/utils/stream.js';
import { createCustomError, getErrorInfo } from '../lib/utils/custom-errors.js';
const isStringArray = (x)=>Array.isArray(x) && x.every((y)=>typeof y === 'string');
const parseRscParams = (rscParams)=>{
    if (!(rscParams instanceof URLSearchParams)) {
        return {
            query: ''
        };
    }
    const query = rscParams.get('query') || '';
    return {
        query
    };
};
const RERENDER_SYMBOL = Symbol('RERENDER');
const setRerender = (rerender)=>{
    try {
        const context = getContext();
        context[RERENDER_SYMBOL] = rerender;
    } catch  {
    // ignore
    }
};
const getRerender = ()=>{
    const context = getContext();
    return context[RERENDER_SYMBOL];
};
const pathSpec2pathname = (pathSpec)=>{
    if (pathSpec.some(({ type })=>type !== 'literal')) {
        return undefined;
    }
    return '/' + pathSpec.map(({ name })=>name).join('/');
};
export function unstable_rerenderRoute(pathname, query) {
    const rscPath = encodeRoutePath(pathname);
    getRerender()(rscPath, query && new URLSearchParams({
        query
    }));
}
export function unstable_notFound() {
    throw createCustomError('Not Found', {
        status: 404
    });
}
export function unstable_redirect(location, status = 307) {
    throw createCustomError('Redirect', {
        status,
        location
    });
}
const ROUTE_SLOT_ID_PREFIX = 'route:';
export function unstable_defineRouter(fns) {
    let cachedPathConfig;
    const getMyPathConfig = async ()=>{
        const pathConfig = await unstable_getPlatformData('defineRouterPathConfigs');
        if (pathConfig) {
            return pathConfig;
        }
        if (!cachedPathConfig) {
            cachedPathConfig = [
                ...Array.from(await fns.getRouteConfig()).map((item)=>{
                    const is404 = item.path.length === 1 && item.path[0].type === 'literal' && item.path[0].name === '404';
                    const isStatic = !!item.rootElement.isStatic && !!item.routeElement.isStatic && Object.values(item.elements).every((x)=>x.isStatic);
                    return {
                        pathSpec: item.path,
                        pathname: pathSpec2pathname(item.path),
                        pattern: path2regexp(item.pathPattern || item.path),
                        specs: {
                            ...item.rootElement.isStatic ? {
                                rootElementIsStatic: true
                            } : {},
                            ...item.routeElement.isStatic ? {
                                routeElementIsStatic: true
                            } : {},
                            staticElementIds: Object.entries(item.elements).flatMap(([id, { isStatic }])=>isStatic ? [
                                    id
                                ] : []),
                            ...isStatic ? {
                                isStatic: true
                            } : {},
                            ...is404 ? {
                                is404: true
                            } : {},
                            ...item.noSsr ? {
                                noSsr: true
                            } : {}
                        }
                    };
                }),
                ...Array.from(await fns.getApiConfig?.() || []).map((item)=>{
                    return {
                        pathSpec: item.path,
                        pathname: pathSpec2pathname(item.path),
                        pattern: path2regexp(item.path),
                        specs: {
                            ...item.isStatic ? {
                                isStatic: true
                            } : {},
                            isApi: true
                        }
                    };
                })
            ];
        }
        return cachedPathConfig;
    };
    const getPathConfigItem = async (pathname)=>{
        const pathConfig = await getMyPathConfig();
        const found = pathConfig.find(({ pathSpec })=>getPathMapping(pathSpec, pathname));
        return found;
    };
    const has404 = async ()=>{
        const pathConfig = await getMyPathConfig();
        return pathConfig.some(({ specs: { is404 } })=>is404);
    };
    const getEntries = async (rscPath, rscParams, headers)=>{
        const pathname = decodeRoutePath(rscPath);
        const pathConfigItem = await getPathConfigItem(pathname);
        if (!pathConfigItem) {
            return null;
        }
        let skipParam;
        try {
            skipParam = JSON.parse(headers[SKIP_HEADER.toLowerCase()] || '');
        } catch  {
        // ignore
        }
        const skipIdSet = new Set(isStringArray(skipParam) ? skipParam : []);
        const { query } = parseRscParams(rscParams);
        const { rootElement, routeElement, elements } = await fns.handleRoute(pathname, pathConfigItem.specs.isStatic ? {} : {
            query
        });
        if (Object.keys(elements).some((id)=>id.startsWith(ROUTE_SLOT_ID_PREFIX))) {
            throw new Error('Element ID cannot start with "route:"');
        }
        const entries = {
            ...elements
        };
        for (const id of pathConfigItem.specs.staticElementIds || []){
            if (skipIdSet.has(id)) {
                delete entries[id];
            }
        }
        if (!pathConfigItem.specs.rootElementIsStatic || !skipIdSet.has('root')) {
            entries.root = rootElement;
        }
        const decodedPathname = decodeURIComponent(pathname);
        const routeId = ROUTE_SLOT_ID_PREFIX + decodedPathname;
        if (!pathConfigItem.specs.routeElementIsStatic || !skipIdSet.has(routeId)) {
            entries[routeId] = routeElement;
        }
        entries[ROUTE_ID] = [
            decodedPathname,
            query
        ];
        entries[IS_STATIC_ID] = !!pathConfigItem.specs.isStatic;
        if (await has404()) {
            entries[HAS404_ID] = true;
        }
        return entries;
    };
    const handleRequest = async (input, { renderRsc, renderHtml })=>{
        if (input.type === 'component') {
            const entries = await getEntries(input.rscPath, input.rscParams, input.req.headers);
            if (!entries) {
                return null;
            }
            return renderRsc(entries);
        }
        if (input.type === 'function') {
            let elementsPromise = Promise.resolve({});
            let rendered = false;
            const rerender = async (rscPath, rscParams)=>{
                if (rendered) {
                    throw new Error('already rendered');
                }
                elementsPromise = Promise.all([
                    elementsPromise,
                    getEntries(rscPath, rscParams, input.req.headers)
                ]).then(([oldElements, newElements])=>{
                    if (newElements === null) {
                        console.warn('getEntries returned null');
                    }
                    return {
                        ...oldElements,
                        ...newElements
                    };
                });
            };
            setRerender(rerender);
            const value = await input.fn(...input.args);
            rendered = true;
            return renderRsc({
                ...await elementsPromise,
                _value: value
            });
        }
        const pathConfigItem = await getPathConfigItem(input.pathname);
        if (pathConfigItem?.specs?.isApi && fns.handleApi) {
            return fns.handleApi(input.pathname, {
                url: input.req.url,
                body: input.req.body,
                headers: input.req.headers,
                method: input.req.method
            });
        }
        if (input.type === 'action' || input.type === 'custom') {
            const renderIt = async (pathname, query)=>{
                const rscPath = encodeRoutePath(pathname);
                const rscParams = new URLSearchParams({
                    query
                });
                const entries = await getEntries(rscPath, rscParams, input.req.headers);
                if (!entries) {
                    return null;
                }
                const html = createElement(INTERNAL_ServerRouter, {
                    route: {
                        path: pathname,
                        query,
                        hash: ''
                    }
                });
                const actionResult = input.type === 'action' ? await input.fn() : undefined;
                return renderHtml(entries, html, {
                    rscPath,
                    actionResult
                });
            };
            const query = input.req.url.searchParams.toString();
            if (pathConfigItem?.specs?.noSsr) {
                return null;
            }
            try {
                if (pathConfigItem) {
                    return await renderIt(input.pathname, query);
                }
            } catch (e) {
                const info = getErrorInfo(e);
                if (info?.status !== 404) {
                    throw e;
                }
            }
            if (await has404()) {
                return {
                    ...await renderIt('/404', ''),
                    status: 404
                };
            } else {
                return null;
            }
        }
    };
    const handleBuild = ({ renderRsc, renderHtml, rscPath2pathname, unstable_generatePrefetchCode, unstable_collectClientModules })=>createAsyncIterable(async ()=>{
            const tasks = [];
            const pathConfig = await getMyPathConfig();
            for (const { pathname, specs } of pathConfig){
                const { handleApi } = fns;
                if (pathname && specs.isStatic && specs.isApi && handleApi) {
                    tasks.push(async ()=>({
                            type: 'file',
                            pathname,
                            body: handleApi(pathname, {
                                url: new URL(pathname, 'http://localhost:3000'),
                                body: null,
                                headers: {},
                                method: 'GET'
                            }).then(({ body })=>body || stringToStream(''))
                        }));
                }
            }
            const path2moduleIds = {};
            const moduleIdsForPrefetch = new WeakMap();
            // FIXME this approach keeps all entries in memory during the loop
            const entriesCache = new Map();
            await Promise.all(pathConfig.map(async ({ pathSpec, pathname, pattern, specs })=>{
                if (specs.isApi) {
                    return;
                }
                const moduleIds = new Set();
                moduleIdsForPrefetch.set(pathSpec, moduleIds);
                if (!pathname) {
                    return;
                }
                const rscPath = encodeRoutePath(pathname);
                const entries = await getEntries(rscPath, undefined, {});
                if (entries) {
                    entriesCache.set(pathname, entries);
                    path2moduleIds[pattern] = await unstable_collectClientModules(entries);
                    if (specs.isStatic) {
                        tasks.push(async ()=>({
                                type: 'file',
                                pathname: rscPath2pathname(rscPath),
                                body: renderRsc(entries, {
                                    moduleIdCallback: (id)=>moduleIds.add(id)
                                })
                            }));
                    }
                }
            }));
            const getRouterPrefetchCode = ()=>`
globalThis.__WAKU_ROUTER_PREFETCH__ = (path) => {
  const path2ids = ${JSON.stringify(path2moduleIds)};
  const pattern = Object.keys(path2ids).find((key) => new RegExp(key).test(path));
  if (pattern && path2ids[pattern]) {
    for (const id of path2ids[pattern] || []) {
      import(id);
    }
  }
};`;
            for (const { pathSpec, pathname, specs } of pathConfig){
                if (specs.isApi) {
                    continue;
                }
                tasks.push(async ()=>{
                    const moduleIds = moduleIdsForPrefetch.get(pathSpec);
                    if (pathname) {
                        const rscPath = encodeRoutePath(pathname);
                        const code = unstable_generatePrefetchCode([
                            rscPath
                        ], moduleIds) + getRouterPrefetchCode() + (specs.is404 ? 'globalThis.__WAKU_ROUTER_404__ = true;' : '');
                        const entries = entriesCache.get(pathname);
                        if (specs.isStatic && entries) {
                            const html = createElement(INTERNAL_ServerRouter, {
                                route: {
                                    path: pathname,
                                    query: '',
                                    hash: ''
                                }
                            });
                            return {
                                type: 'file',
                                pathname,
                                body: renderHtml(entries, html, {
                                    rscPath,
                                    htmlHead: `<script type="module" async>${code}</script>`
                                }).then(({ body })=>body)
                            };
                        }
                    }
                    const code = unstable_generatePrefetchCode([], moduleIds) + getRouterPrefetchCode() + (specs.is404 ? 'globalThis.__WAKU_ROUTER_404__ = true;' : '');
                    return {
                        type: 'htmlHead',
                        pathSpec,
                        head: `<script type="module" async>${code}</script>`
                    };
                });
            }
            await unstable_setPlatformData('defineRouterPathConfigs', pathConfig, true);
            return tasks;
        });
    return defineEntries({
        handleRequest,
        handleBuild
    });
}

//# sourceMappingURL=define-router.js.map