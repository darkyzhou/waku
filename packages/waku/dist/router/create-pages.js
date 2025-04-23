import { createElement, Fragment } from 'react';
import { unstable_defineRouter } from './define-router.js';
import { joinPath, parsePathWithSlug, getPathMapping, pathSpecAsString, parseExactPath } from '../lib/utils/path.js';
import { getGrouplessPath } from '../lib/utils/create-pages.js';
import { Children, Slot } from '../minimal/client.js';
import { ErrorBoundary } from '../router/client.js';
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
export const METHODS = [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'DELETE',
    'CONNECT',
    'OPTIONS',
    'TRACE',
    'PATCH'
];
const sanitizeSlug = (slug)=>slug.replace(/\./g, '').replace(/ /g, '-');
/**
 * Root component for all pages
 * ```tsx
 *   <html>
 *     <head></head>
 *     <body>{children}</body>
 *   </html>
 * ```
 */ const DefaultRoot = ({ children })=>createElement(ErrorBoundary, null, createElement('html', null, createElement('head', null), createElement('body', null, children)));
const createNestedElements = (elements, children)=>{
    return elements.reduceRight((result, element)=>createElement(element.component, element.props, result), children);
};
export const createPages = (fn)=>{
    let configured = false;
    // layout lookups retain (group) path and pathMaps store without group
    // paths are stored without groups to easily detect duplicates
    const groupPathLookup = new Map();
    const staticPathMap = new Map();
    const pagePartRenderModeMap = new Map();
    const staticPagePartRoutes = new Set();
    const dynamicPagePathMap = new Map();
    const wildcardPagePathMap = new Map();
    const dynamicLayoutPathMap = new Map();
    const apiPathMap = new Map();
    const staticComponentMap = new Map();
    let rootItem = undefined;
    const noSsrSet = new WeakSet();
    /** helper to find dynamic path when slugs are used */ const getPageRoutePath = (path)=>{
        if (staticComponentMap.has(joinPath(path, 'page').slice(1)) || staticPagePartRoutes.has(path)) {
            return path;
        }
        const allPaths = [
            ...dynamicPagePathMap.keys(),
            ...wildcardPagePathMap.keys()
        ];
        for (const p of allPaths){
            if (getPathMapping(parsePathWithSlug(p), path)) {
                return p;
            }
        }
    };
    const getApiRoutePath = (path, method)=>{
        for (const [p, v] of apiPathMap.entries()){
            if ((method in v.handlers || v.handlers.all) && getPathMapping(parsePathWithSlug(p), path)) {
                return p;
            }
        }
    };
    const pagePathExists = (path)=>{
        for (const pathKey of apiPathMap.keys()){
            const [_m, p] = pathKey.split(' ');
            if (p === path) {
                return true;
            }
        }
        return staticPathMap.has(path) || dynamicPagePathMap.has(path) || wildcardPagePathMap.has(path);
    };
    /** helper to get original static slug path */ const getOriginalStaticPathSpec = (path)=>{
        const staticPathSpec = staticPathMap.get(path);
        if (staticPathSpec) {
            return staticPathSpec.originalSpec ?? staticPathSpec.literalSpec;
        }
    };
    const registerStaticComponent = (id, component)=>{
        if (staticComponentMap.has(id) && staticComponentMap.get(id) !== component) {
            throw new Error(`Duplicated component for: ${id}`);
        }
        staticComponentMap.set(id, component);
    };
    const createPage = (page)=>{
        if (configured) {
            throw new Error('createPage no longer available');
        }
        if (pagePathExists(page.path)) {
            throw new Error(`Duplicated path: ${page.path}`);
        }
        const pathSpec = parsePathWithSlug(page.path);
        const { numSlugs, numWildcards } = getSlugsAndWildcards(pathSpec);
        if (page.unstable_disableSSR) {
            noSsrSet.add(pathSpec);
        }
        if (page.exactPath) {
            const spec = parseExactPath(page.path);
            if (page.render === 'static') {
                staticPathMap.set(page.path, {
                    literalSpec: spec
                });
                const id = joinPath(page.path, 'page').replace(/^\//, '');
                if (page.component) {
                    registerStaticComponent(id, page.component);
                }
            } else if (page.component) {
                dynamicPagePathMap.set(page.path, [
                    spec,
                    page.component
                ]);
            } else {
                dynamicPagePathMap.set(page.path, [
                    spec,
                    []
                ]);
            }
        } else if (page.render === 'static' && numSlugs === 0) {
            const pagePath = getGrouplessPath(page.path);
            staticPathMap.set(pagePath, {
                literalSpec: pathSpec
            });
            const id = joinPath(pagePath, 'page').replace(/^\//, '');
            if (pagePath !== page.path) {
                groupPathLookup.set(pagePath, page.path);
            }
            if (page.component) {
                registerStaticComponent(id, page.component);
            }
        } else if (page.render === 'static' && numSlugs > 0 && 'staticPaths' in page) {
            const staticPaths = page.staticPaths.map((item)=>(Array.isArray(item) ? item : [
                    item
                ]).map(sanitizeSlug));
            for (const staticPath of staticPaths){
                if (staticPath.length !== numSlugs && numWildcards === 0) {
                    throw new Error('staticPaths does not match with slug pattern');
                }
                const mapping = {};
                let slugIndex = 0;
                const pathItems = [];
                pathSpec.forEach(({ type, name })=>{
                    switch(type){
                        case 'literal':
                            pathItems.push(name);
                            break;
                        case 'wildcard':
                            mapping[name] = staticPath.slice(slugIndex);
                            staticPath.slice(slugIndex++).forEach((slug)=>{
                                pathItems.push(slug);
                            });
                            break;
                        case 'group':
                            pathItems.push(staticPath[slugIndex++]);
                            mapping[name] = pathItems[pathItems.length - 1];
                            break;
                    }
                });
                const definedPath = '/' + pathItems.join('/');
                const pagePath = getGrouplessPath(definedPath);
                staticPathMap.set(pagePath, {
                    literalSpec: pathItems.map((name)=>({
                            type: 'literal',
                            name
                        })),
                    originalSpec: pathSpec
                });
                if (pagePath !== definedPath) {
                    groupPathLookup.set(pagePath, definedPath);
                }
                const id = joinPath(...pathItems, 'page');
                const WrappedComponent = (props)=>createElement(page.component, {
                        ...props,
                        ...mapping
                    });
                registerStaticComponent(id, WrappedComponent);
            }
        } else if (page.render === 'dynamic' && numWildcards === 0) {
            const pagePath = getGrouplessPath(page.path);
            if (pagePath !== page.path) {
                groupPathLookup.set(pagePath, page.path);
            }
            dynamicPagePathMap.set(pagePath, [
                pathSpec,
                page.component
            ]);
        } else if (page.render === 'dynamic' && numWildcards === 1) {
            const pagePath = getGrouplessPath(page.path);
            if (pagePath !== page.path) {
                groupPathLookup.set(pagePath, page.path);
            }
            wildcardPagePathMap.set(pagePath, [
                pathSpec,
                page.component
            ]);
        } else {
            throw new Error('Invalid page configuration');
        }
        return page;
    };
    const createLayout = (layout)=>{
        if (configured) {
            throw new Error('createLayout no longer available');
        }
        if (layout.render === 'static') {
            const id = joinPath(layout.path, 'layout').replace(/^\//, '');
            registerStaticComponent(id, layout.component);
        } else if (layout.render === 'dynamic') {
            if (dynamicLayoutPathMap.has(layout.path)) {
                throw new Error(`Duplicated dynamic path: ${layout.path}`);
            }
            const pathSpec = parsePathWithSlug(layout.path);
            dynamicLayoutPathMap.set(layout.path, [
                pathSpec,
                layout.component
            ]);
        } else {
            throw new Error('Invalid layout configuration');
        }
    };
    const createApi = (options)=>{
        if (configured) {
            throw new Error('createApi no longer available');
        }
        if (apiPathMap.has(options.path)) {
            throw new Error(`Duplicated api path: ${options.path}`);
        }
        const pathSpec = parsePathWithSlug(options.path);
        if (options.render === 'static') {
            apiPathMap.set(options.path, {
                render: 'static',
                pathSpec,
                handlers: {
                    GET: options.handler
                }
            });
        } else {
            apiPathMap.set(options.path, {
                render: 'dynamic',
                pathSpec,
                handlers: options.handlers
            });
        }
    };
    const createRoot = (root)=>{
        if (configured) {
            throw new Error('createRoot no longer available');
        }
        if (rootItem) {
            throw new Error(`Duplicated root component`);
        }
        if (root.render === 'static' || root.render === 'dynamic') {
            rootItem = root;
        } else {
            throw new Error('Invalid root configuration');
        }
    };
    const createPagePart = (params)=>{
        if (!import.meta.env.VITE_EXPERIMENTAL_WAKU_ROUTER) {
            console.warn('createPagePart is still experimental');
            return params;
        }
        if (params.path.endsWith('[path]')) {
            throw new Error('Page part file cannot be named [path]. This will conflict with the path prop of the page component.');
        }
        if (configured) {
            throw new Error('createPagePart no longer available');
        }
        const pagePartRenderMode = pagePartRenderModeMap.get(params.path);
        if (!pagePartRenderMode) {
            pagePartRenderModeMap.set(params.path, params.render);
        } else if (params.render === 'dynamic' && pagePartRenderMode === 'static') {
            pagePartRenderModeMap.set(params.path, 'dynamic');
        }
        const pathSpec = parsePathWithSlug(params.path);
        const { numWildcards } = getSlugsAndWildcards(pathSpec);
        const pagePathMap = numWildcards === 0 ? dynamicPagePathMap : wildcardPagePathMap;
        if (pagePathMap.has(params.path) && !Array.isArray(pagePathMap.get(params.path)?.[1])) {
            throw new Error(`Duplicated path: ${params.path}. Tip: createPagePart cannot be used with createPage. Only one at a time is allowed.`);
        }
        if (params.render === 'static') {
            const id = joinPath(params.path, 'page').replace(/^\//, '') + ':' + params.order;
            registerStaticComponent(id, params.component);
        }
        if (!pagePathMap.has(params.path)) {
            const pathComponents = [];
            pathComponents[params.order] = {
                component: params.component,
                render: params.render
            };
            pagePathMap.set(params.path, [
                pathSpec,
                pathComponents
            ]);
        } else {
            const pageComponents = pagePathMap.get(params.path)?.[1];
            if (Array.isArray(pageComponents)) {
                if (pageComponents[params.order]) {
                    throw new Error('Duplicated pagePartComponent order: ' + params.order);
                }
                pageComponents[params.order] = {
                    render: params.render,
                    component: params.component
                };
            }
        }
        return params;
    };
    let ready;
    const configure = async ()=>{
        if (!configured && !ready) {
            ready = fn({
                createPage,
                createLayout,
                createRoot,
                createApi,
                createPagePart
            });
            await ready;
            // check for page parts pages that can be made static
            for (const [path, renderMode] of pagePartRenderModeMap){
                if (renderMode === 'dynamic') {
                    continue;
                }
                staticPagePartRoutes.add(path);
                const pathSpec = parsePathWithSlug(path);
                const { numWildcards } = getSlugsAndWildcards(pathSpec);
                const pagePathMap = numWildcards === 0 ? dynamicPagePathMap : wildcardPagePathMap;
                pagePathMap.delete(path);
                const pagePath = getGrouplessPath(path);
                staticPathMap.set(pagePath, {
                    literalSpec: pathSpec
                });
                if (path !== pagePath) {
                    groupPathLookup.set(pagePath, pagePath);
                }
            }
            configured = true;
        }
        await ready;
    };
    const getLayouts = (spec)=>{
        const pathSegments = spec.reduce((acc, _segment, index)=>{
            acc.push(pathSpecAsString(spec.slice(0, index + 1)));
            return acc;
        }, [
            '/'
        ]);
        return pathSegments.filter((segment)=>dynamicLayoutPathMap.has(segment) || staticComponentMap.has(joinPath(segment, 'layout').slice(1)));
    };
    const definedRouter = unstable_defineRouter({
        getRouteConfig: async ()=>{
            await configure();
            const paths = [];
            const rootIsStatic = !rootItem || rootItem.render === 'static';
            for (const [path, { literalSpec, originalSpec }] of staticPathMap){
                const noSsr = noSsrSet.has(literalSpec);
                const layoutPaths = getLayouts(originalSpec ?? literalSpec);
                const elements = {
                    ...layoutPaths.reduce((acc, lPath)=>{
                        acc[`layout:${lPath}`] = {
                            isStatic: !dynamicLayoutPathMap.has(lPath)
                        };
                        return acc;
                    }, {}),
                    [`page:${path}`]: {
                        isStatic: staticPathMap.has(path)
                    }
                };
                paths.push({
                    path: literalSpec.filter((part)=>!part.name?.startsWith('(')),
                    ...originalSpec && {
                        pathPattern: originalSpec
                    },
                    rootElement: {
                        isStatic: rootIsStatic
                    },
                    routeElement: {
                        isStatic: true
                    },
                    elements,
                    noSsr
                });
            }
            for (const [path, [pathSpec, components]] of dynamicPagePathMap){
                const noSsr = noSsrSet.has(pathSpec);
                const layoutPaths = getLayouts(pathSpec);
                const elements = {
                    ...layoutPaths.reduce((acc, lPath)=>{
                        acc[`layout:${lPath}`] = {
                            isStatic: !dynamicLayoutPathMap.has(lPath)
                        };
                        return acc;
                    }, {})
                };
                if (Array.isArray(components)) {
                    for(let i = 0; i < components.length; i++){
                        const component = components[i];
                        if (component) {
                            elements[`page:${path}:${i}`] = {
                                isStatic: component.render === 'static'
                            };
                        }
                    }
                } else {
                    elements[`page:${path}`] = {
                        isStatic: false
                    };
                }
                paths.push({
                    path: pathSpec.filter((part)=>!part.name?.startsWith('(')),
                    rootElement: {
                        isStatic: rootIsStatic
                    },
                    routeElement: {
                        isStatic: true
                    },
                    elements,
                    noSsr
                });
            }
            for (const [path, [pathSpec, components]] of wildcardPagePathMap){
                const noSsr = noSsrSet.has(pathSpec);
                const layoutPaths = getLayouts(pathSpec);
                const elements = {
                    ...layoutPaths.reduce((acc, lPath)=>{
                        acc[`layout:${lPath}`] = {
                            isStatic: !dynamicLayoutPathMap.has(lPath)
                        };
                        return acc;
                    }, {})
                };
                if (Array.isArray(components)) {
                    for(let i = 0; i < components.length; i++){
                        const component = components[i];
                        if (component) {
                            elements[`page:${path}:${i}`] = {
                                isStatic: component.render === 'static'
                            };
                        }
                    }
                } else {
                    elements[`page:${path}`] = {
                        isStatic: false
                    };
                }
                paths.push({
                    path: pathSpec.filter((part)=>!part.name?.startsWith('(')),
                    rootElement: {
                        isStatic: rootIsStatic
                    },
                    routeElement: {
                        isStatic: true
                    },
                    elements,
                    noSsr
                });
            }
            return paths;
        },
        handleRoute: async (path, { query })=>{
            await configure();
            // path without slugs
            const routePath = getPageRoutePath(path);
            if (!routePath) {
                throw new Error('Route not found: ' + path);
            }
            let pageComponent = staticComponentMap.get(joinPath(routePath, 'page').slice(1)) ?? dynamicPagePathMap.get(routePath)?.[1] ?? wildcardPagePathMap.get(routePath)?.[1];
            if (!pageComponent && staticPagePartRoutes.has(routePath)) {
                pageComponent = [];
                for (const [name, v] of staticComponentMap.entries()){
                    if (name.startsWith(joinPath(routePath, 'page').slice(1))) {
                        pageComponent.push({
                            component: v,
                            render: 'static'
                        });
                    }
                }
            }
            if (!pageComponent) {
                throw new Error('Page not found: ' + path);
            }
            const layoutMatchPath = groupPathLookup.get(routePath) ?? routePath;
            const pathSpec = parsePathWithSlug(layoutMatchPath);
            const mapping = getPathMapping(pathSpec, path);
            const result = {};
            if (Array.isArray(pageComponent)) {
                for(let i = 0; i < pageComponent.length; i++){
                    const comp = pageComponent[i];
                    if (!comp) {
                        continue;
                    }
                    result[`page:${routePath}:${i}`] = createElement(comp.component, {
                        ...mapping,
                        ...query ? {
                            query
                        } : {},
                        path
                    });
                }
            } else {
                result[`page:${routePath}`] = createElement(pageComponent, {
                    ...mapping,
                    ...query ? {
                        query
                    } : {},
                    path
                }, createElement(Children));
            }
            const layoutPaths = getLayouts(getOriginalStaticPathSpec(path) ?? pathSpec);
            for (const segment of layoutPaths){
                const layout = dynamicLayoutPathMap.get(segment)?.[1] ?? staticComponentMap.get(joinPath(segment, 'layout').slice(1)); // feels like a hack
                const isDynamic = dynamicLayoutPathMap.has(segment);
                if (layout && !Array.isArray(layout)) {
                    const id = 'layout:' + segment;
                    result[id] = createElement(layout, isDynamic ? {
                        path
                    } : null, createElement(Children));
                } else {
                    throw new Error('Invalid layout ' + segment);
                }
            }
            // loop over all layouts for path
            const layouts = layoutPaths.map((lPath)=>({
                    component: Slot,
                    props: {
                        id: `layout:${lPath}`
                    }
                }));
            const finalPageChildren = Array.isArray(pageComponent) ? createElement(Fragment, null, pageComponent.map((_comp, order)=>createElement(Slot, {
                    id: `page:${routePath}:${order}`,
                    key: `page:${routePath}:${order}`
                }))) : createElement(Slot, {
                id: `page:${routePath}`
            });
            return {
                elements: result,
                rootElement: createElement(rootItem ? rootItem.component : DefaultRoot, null, createElement(Children)),
                routeElement: createNestedElements(layouts, finalPageChildren)
            };
        },
        getApiConfig: async ()=>{
            await configure();
            return Array.from(apiPathMap.values()).map(({ pathSpec, render })=>{
                return {
                    path: pathSpec,
                    isStatic: render === 'static'
                };
            });
        },
        handleApi: async (path, { url, ...options })=>{
            await configure();
            const routePath = getApiRoutePath(path, options.method);
            if (!routePath) {
                throw new Error('API Route not found: ' + path);
            }
            const { handlers } = apiPathMap.get(routePath);
            const req = new Request(url, options);
            const handler = handlers[options.method] ?? handlers.all;
            if (!handler) {
                throw new Error('API method not found: ' + options.method + 'for path: ' + path);
            }
            const res = await handler(req);
            return {
                ...res.body ? {
                    body: res.body
                } : {},
                headers: Object.fromEntries(res.headers.entries()),
                status: res.status
            };
        }
    });
    return definedRouter;
};
const getSlugsAndWildcards = (pathSpec)=>{
    let numSlugs = 0;
    let numWildcards = 0;
    for (const slug of pathSpec){
        if (slug.type !== 'literal') {
            numSlugs++;
        }
        if (slug.type === 'wildcard') {
            numWildcards++;
        }
    }
    return {
        numSlugs,
        numWildcards
    };
};

//# sourceMappingURL=create-pages.js.map