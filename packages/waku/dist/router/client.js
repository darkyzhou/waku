'use client';
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, useTransition, Fragment, Component } from 'react';
import { prefetchRsc, Root, Slot, useRefetch, ThrowError_UNSTABLE as ThrowError, useResetError_UNSTABLE as useResetError } from '../minimal/client.js';
import { encodeRoutePath, ROUTE_ID, IS_STATIC_ID, HAS404_ID, SKIP_HEADER } from './common.js';
import { getErrorInfo } from '../lib/utils/custom-errors.js';
const normalizeRoutePath = (path)=>{
    for (const suffix of [
        '/',
        '/index.html'
    ]){
        if (path.endsWith(suffix)) {
            return path.slice(0, -suffix.length) || '/';
        }
    }
    return path;
};
const parseRoute = (url)=>{
    const { pathname, searchParams, hash } = url;
    return {
        path: normalizeRoutePath(pathname),
        query: searchParams.toString(),
        hash
    };
};
const parseRouteFromLocation = ()=>{
    if (globalThis.__WAKU_ROUTER_404__) {
        return {
            path: '/404',
            query: '',
            hash: ''
        };
    }
    return parseRoute(new URL(window.location.href));
};
let savedRscParams;
const createRscParams = (query)=>{
    if (savedRscParams && savedRscParams[0] === query) {
        return savedRscParams[1];
    }
    const rscParams = new URLSearchParams({
        query
    });
    savedRscParams = [
        query,
        rscParams
    ];
    return rscParams;
};
const RouterContext = createContext(null);
export function useRouter_UNSTABLE() {
    const router = useContext(RouterContext);
    if (!router) {
        throw new Error('Missing Router');
    }
    const { route, changeRoute, prefetchRoute } = router;
    const push = useCallback((to, options)=>{
        const url = new URL(to, window.location.href);
        const newPath = url.pathname !== window.location.pathname;
        window.history.pushState({
            ...window.history.state,
            waku_new_path: newPath
        }, '', url);
        changeRoute(parseRoute(url), {
            shouldScroll: options?.scroll ?? newPath
        });
    }, [
        changeRoute
    ]);
    const replace = useCallback((to, options)=>{
        const url = new URL(to, window.location.href);
        const newPath = url.pathname !== window.location.pathname;
        window.history.replaceState(window.history.state, '', url);
        changeRoute(parseRoute(url), {
            shouldScroll: options?.scroll ?? newPath
        });
    }, [
        changeRoute
    ]);
    const reload = useCallback(()=>{
        const url = new URL(window.location.href);
        changeRoute(parseRoute(url), {
            shouldScroll: true
        });
    }, [
        changeRoute
    ]);
    const back = useCallback(()=>{
        // FIXME is this correct?
        window.history.back();
    }, []);
    const forward = useCallback(()=>{
        // FIXME is this correct?
        window.history.forward();
    }, []);
    const prefetch = useCallback((to)=>{
        const url = new URL(to, window.location.href);
        prefetchRoute(parseRoute(url));
    }, [
        prefetchRoute
    ]);
    return {
        ...route,
        push,
        replace,
        reload,
        back,
        forward,
        prefetch
    };
}
export function Link({ to, children, scroll, unstable_pending, unstable_notPending, unstable_prefetchOnEnter, unstable_prefetchOnView, unstable_startTransition, ...props }) {
    const router = useContext(RouterContext);
    const changeRoute = router ? router.changeRoute : ()=>{
        throw new Error('Missing Router');
    };
    const prefetchRoute = router ? router.prefetchRoute : ()=>{
        throw new Error('Missing Router');
    };
    const [isPending, startTransition] = useTransition();
    const startTransitionFn = unstable_startTransition || (unstable_pending || unstable_notPending) && startTransition || ((fn)=>fn());
    const ref = useRef(undefined);
    useEffect(()=>{
        if (unstable_prefetchOnView && ref.current) {
            const observer = new IntersectionObserver((entries)=>{
                entries.forEach((entry)=>{
                    if (entry.isIntersecting) {
                        const url = new URL(to, window.location.href);
                        if (router && url.href !== window.location.href) {
                            const route = parseRoute(url);
                            router.prefetchRoute(route);
                        }
                    }
                });
            }, {
                threshold: 0.1
            });
            observer.observe(ref.current);
            return ()=>{
                observer.disconnect();
            };
        }
    }, [
        unstable_prefetchOnView,
        router,
        to
    ]);
    const onClick = (event)=>{
        event.preventDefault();
        const url = new URL(to, window.location.href);
        if (url.href !== window.location.href) {
            const route = parseRoute(url);
            prefetchRoute(route);
            startTransitionFn(()=>{
                const newPath = url.pathname !== window.location.pathname;
                window.history.pushState({
                    ...window.history.state,
                    waku_new_path: newPath
                }, '', url);
                changeRoute(route, {
                    shouldScroll: scroll ?? newPath
                });
            });
        }
        props.onClick?.(event);
    };
    const onMouseEnter = unstable_prefetchOnEnter ? (event)=>{
        const url = new URL(to, window.location.href);
        if (url.href !== window.location.href) {
            const route = parseRoute(url);
            prefetchRoute(route);
        }
        props.onMouseEnter?.(event);
    } : props.onMouseEnter;
    const ele = createElement('a', {
        ...props,
        href: to,
        onClick,
        onMouseEnter,
        ref
    }, children);
    if (isPending && unstable_pending !== undefined) {
        return createElement(Fragment, null, ele, unstable_pending);
    }
    if (!isPending && unstable_notPending !== undefined) {
        return createElement(Fragment, null, ele, unstable_notPending);
    }
    return ele;
}
const notAvailableInServer = (name)=>()=>{
        throw new Error(`${name} is not in the server`);
    };
function renderError(message) {
    return createElement('html', null, createElement('body', null, createElement('h1', null, message)));
}
export class ErrorBoundary extends Component {
    constructor(props){
        super(props);
        this.state = {};
    }
    static getDerivedStateFromError(error) {
        return {
            error
        };
    }
    render() {
        if ('error' in this.state) {
            if (this.state.error instanceof Error) {
                return renderError(this.state.error.message);
            }
            return renderError(String(this.state.error));
        }
        return this.props.children;
    }
}
const NotFound = ({ has404, reset })=>{
    const resetError = useResetError();
    const router = useContext(RouterContext);
    if (!router) {
        throw new Error('Missing Router');
    }
    const { changeRoute } = router;
    useEffect(()=>{
        if (has404) {
            const url = new URL('/404', window.location.href);
            changeRoute(parseRoute(url), {
                shouldScroll: true
            });
            resetError?.();
            reset();
        }
    }, [
        has404,
        resetError,
        reset,
        changeRoute
    ]);
    return has404 ? null : createElement('h1', null, 'Not Found');
};
const Redirect = ({ to, reset })=>{
    const resetError = useResetError();
    const router = useContext(RouterContext);
    if (!router) {
        throw new Error('Missing Router');
    }
    const { changeRoute } = router;
    useEffect(()=>{
        const url = new URL(to, window.location.href);
        // FIXME this condition seems too naive
        if (url.hostname !== window.location.hostname) {
            window.location.replace(to);
            return;
        }
        const newPath = url.pathname !== window.location.pathname;
        window.history.pushState({
            ...window.history.state,
            waku_new_path: newPath
        }, '', url);
        changeRoute(parseRoute(url), {
            shouldScroll: newPath
        });
        resetError?.();
        reset();
    }, [
        to,
        resetError,
        reset,
        changeRoute
    ]);
    return null;
};
class CustomErrorHandler extends Component {
    constructor(props){
        super(props);
        this.state = {
            error: null
        };
        this.reset = this.reset.bind(this);
    }
    static getDerivedStateFromError(error) {
        return {
            error
        };
    }
    reset() {
        this.setState({
            error: null
        });
    }
    render() {
        const { error } = this.state;
        if (error !== null) {
            const info = getErrorInfo(error);
            if (info?.status === 404) {
                return createElement(NotFound, {
                    has404: this.props.has404,
                    reset: this.reset
                });
            }
            if (info?.location) {
                return createElement(Redirect, {
                    to: info.location,
                    reset: this.reset
                });
            }
            throw error;
        }
        return this.props.children;
    }
}
const getRouteSlotId = (path)=>'route:' + decodeURIComponent(path);
const handleScroll = ()=>{
    const { hash } = window.location;
    const { state } = window.history;
    const element = hash && document.getElementById(hash.slice(1));
    window.scrollTo({
        left: 0,
        top: element ? element.getBoundingClientRect().top + window.scrollY : 0,
        behavior: state?.waku_new_path ? 'instant' : 'auto'
    });
};
const InnerRouter = ({ routerData, initialRoute })=>{
    const [locationListeners, staticPathSet, , has404] = routerData;
    const refetch = useRefetch();
    const [route, setRoute] = useState(()=>({
            // This is the first initialization of the route, and it has
            // to ignore the hash, because on server side there is none.
            // Otherwise there will be a hydration error.
            // The client side route, including the hash, will be updated in the effect below.
            ...initialRoute,
            hash: ''
        }));
    // Update the route post-load to include the current hash.
    useEffect(()=>{
        setRoute((prev)=>{
            if (prev.path === initialRoute.path && prev.query === initialRoute.query && prev.hash === initialRoute.hash) {
                return prev;
            }
            return initialRoute;
        });
    }, [
        initialRoute
    ]);
    const changeRoute = useCallback((route, options)=>{
        const { skipRefetch } = options || {};
        if (!staticPathSet.has(route.path) && !skipRefetch) {
            const rscPath = encodeRoutePath(route.path);
            const rscParams = createRscParams(route.query);
            refetch(rscPath, rscParams);
        }
        if (options.shouldScroll) {
            handleScroll();
        }
        setRoute(route);
    }, [
        refetch,
        staticPathSet
    ]);
    const prefetchRoute = useCallback((route)=>{
        if (staticPathSet.has(route.path)) {
            return;
        }
        const rscPath = encodeRoutePath(route.path);
        const rscParams = createRscParams(route.query);
        prefetchRsc(rscPath, rscParams);
        globalThis.__WAKU_ROUTER_PREFETCH__?.(route.path);
    }, [
        staticPathSet
    ]);
    useEffect(()=>{
        const callback = ()=>{
            const route = parseRoute(new URL(window.location.href));
            changeRoute(route, {
                shouldScroll: true
            });
        };
        window.addEventListener('popstate', callback);
        return ()=>{
            window.removeEventListener('popstate', callback);
        };
    }, [
        changeRoute
    ]);
    useEffect(()=>{
        const callback = (path, query)=>{
            const url = new URL(window.location.href);
            url.pathname = path;
            url.search = query;
            url.hash = '';
            if (path !== '/404') {
                window.history.pushState({
                    ...window.history.state,
                    waku_new_path: url.pathname !== window.location.pathname
                }, '', url);
            }
            changeRoute(parseRoute(url), {
                skipRefetch: true,
                shouldScroll: false
            });
        };
        locationListeners.add(callback);
        return ()=>{
            locationListeners.delete(callback);
        };
    }, [
        changeRoute,
        locationListeners
    ]);
    const routeElement = createElement(Slot, {
        id: getRouteSlotId(route.path)
    });
    const rootElement = createElement(Slot, {
        id: 'root',
        unstable_handleError: createElement(CustomErrorHandler, {
            has404
        }, createElement(ThrowError))
    }, createElement(CustomErrorHandler, {
        has404
    }, routeElement));
    return createElement(RouterContext.Provider, {
        value: {
            route,
            changeRoute,
            prefetchRoute
        }
    }, rootElement);
};
const DEFAULT_ROUTER_DATA = [];
export function Router({ routerData = DEFAULT_ROUTER_DATA, initialRoute = parseRouteFromLocation(), unstable_enhanceFetch, unstable_enhanceCreateData }) {
    const initialRscPath = encodeRoutePath(initialRoute.path);
    const locationListeners = routerData[0] ||= new Set();
    const staticPathSet = routerData[1] ||= new Set();
    const cachedIdSet = routerData[2] ||= new Set();
    const enhanceFetch = (fetchFn)=>(input, init = {})=>{
            const skipStr = JSON.stringify(Array.from(cachedIdSet));
            const headers = init.headers ||= {};
            if (Array.isArray(headers)) {
                headers.push([
                    SKIP_HEADER,
                    skipStr
                ]);
            } else {
                headers[SKIP_HEADER] = skipStr;
            }
            return fetchFn(input, init);
        };
    const enhanceCreateData = (createData)=>async (responsePromise)=>{
            const data = createData(responsePromise);
            Promise.resolve(data).then((data)=>{
                if (data && typeof data === 'object') {
                    const { [ROUTE_ID]: routeData, [IS_STATIC_ID]: isStatic, [HAS404_ID]: has404, ...rest } = data;
                    if (routeData) {
                        const [path, query] = routeData;
                        // FIXME this check here seems ad-hoc (less readable code)
                        if (window.location.pathname !== path || !isStatic && window.location.search.replace(/^\?/, '') !== query) {
                            locationListeners.forEach((listener)=>listener(path, query));
                        }
                        if (isStatic) {
                            staticPathSet.add(path);
                        }
                    }
                    if (has404) {
                        routerData[3] = true;
                    }
                    Object.keys(rest).forEach((id)=>{
                        cachedIdSet.add(id);
                    });
                }
            }).catch(()=>{});
            return data;
        };
    const initialRscParams = createRscParams(initialRoute.query);
    return createElement(Root, {
        initialRscPath,
        initialRscParams,
        unstable_enhanceFetch: unstable_enhanceFetch ? (fn)=>unstable_enhanceFetch(enhanceFetch(fn)) : enhanceFetch,
        unstable_enhanceCreateData: unstable_enhanceCreateData ? (fn)=>unstable_enhanceCreateData(enhanceCreateData(fn)) : enhanceCreateData
    }, createElement(InnerRouter, {
        routerData: routerData,
        initialRoute
    }));
}
/**
 * ServerRouter for SSR
 * This is not a public API.
 */ export function INTERNAL_ServerRouter({ route }) {
    const routeElement = createElement(Slot, {
        id: getRouteSlotId(route.path)
    });
    const rootElement = createElement(Slot, {
        id: 'root',
        unstable_handleError: null
    }, routeElement);
    return createElement(Fragment, null, createElement(RouterContext.Provider, {
        value: {
            route,
            changeRoute: notAvailableInServer('changeRoute'),
            prefetchRoute: notAvailableInServer('prefetchRoute')
        }
    }, rootElement));
}

//# sourceMappingURL=client.js.map