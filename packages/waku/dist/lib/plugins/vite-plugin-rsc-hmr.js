import { joinPath, fileURLToFilePath, decodeFilePathFromAbsolute, filePathToFileURL } from '../utils/path.js';
const injectingHmrCode = `
import { createHotContext as __vite__createHotContext } from "/@vite/client";
import.meta.hot = __vite__createHotContext(import.meta.url);

if (import.meta.hot && !globalThis.__WAKU_HMR_CONFIGURED__) {
  globalThis.__WAKU_HMR_CONFIGURED__ = true;
  import.meta.hot.on('vite:afterUpdate', (data) => {
    if (data.type === 'update') {
      for (const update of data.updates) {
        if (
          update.type === 'js-update' &&
          globalThis.__WAKU_CLIENT_MODULE_LOADING__.has(update.path)
        ) {
          globalThis.__WAKU_CLIENT_MODULE_LOADING__.set(update.path,
            globalThis.__WAKU_CLIENT_IMPORT__(update.path + '?t=' + update.timestamp).then((m) => {
              globalThis.__WAKU_CLIENT_MODULE_CACHE__.set(update.path, m);
            })
          );
        }
      }
    }
  });
  import.meta.hot.on('rsc-reload', () => {
    globalThis.__WAKU_RSC_RELOAD_LISTENERS__?.forEach((l) => l());
  });
  import.meta.hot.on('hot-import', (data) => import(/* @vite-ignore */ data));
  import.meta.hot.on('module-import', (data) => {
    // remove element with the same 'waku-module-id'
    let script = document.querySelector('script[waku-module-id="' + data.id + '"]');
    let style = document.querySelector('style[waku-module-id="' + data.id + '"]');
    script?.remove();
    const code = data.code;
    script = document.createElement('script');
    script.type = 'module';
    script.text = code;
    script.setAttribute('waku-module-id', data.id);
    document.head.appendChild(script);
    // avoid HMR flash by first applying the new and removing the old styles 
    if (style) {
      queueMicrotask(() => style.parentElement?.removeChild(style));
    }
  });
  import.meta.hot.on('vite:invalidate', () => {
    // FIXME is there a better solution?
    location.reload();
  });
}
`;
export function rscHmrPlugin() {
    const wakuMinimalClientDist = decodeFilePathFromAbsolute(joinPath(fileURLToFilePath(import.meta.url), '../../../minimal/client.js'));
    const wakuRouterClientDist = decodeFilePathFromAbsolute(joinPath(fileURLToFilePath(import.meta.url), '../../../router/client.js'));
    let viteServer;
    return {
        name: 'rsc-hmr-plugin',
        enforce: 'post',
        configureServer (server) {
            viteServer = server;
        },
        async transformIndexHtml () {
            return [
                ...await generateInitialScripts(viteServer),
                {
                    tag: 'script',
                    attrs: {
                        type: 'module',
                        async: true
                    },
                    children: injectingHmrCode,
                    injectTo: 'head'
                }
            ];
        },
        async transform (code, id) {
            if (id.startsWith(wakuMinimalClientDist)) {
                // FIXME this is fragile. Can we do it better?
                return code.replace(/\nexport const fetchRsc = \(.*?\)=>\{/, (m)=>m + `
{
  const refetchRsc = () => {
    delete fetchCache[ENTRY];
    const data = fetchRsc(rscPath, rscParams, fetchCache);
    fetchCache[SET_ELEMENTS](() => data);
  };
  globalThis.__WAKU_RSC_RELOAD_LISTENERS__ ||= [];
  const index = globalThis.__WAKU_RSC_RELOAD_LISTENERS__.indexOf(globalThis.__WAKU_REFETCH_RSC__);
  if (index !== -1) {
    globalThis.__WAKU_RSC_RELOAD_LISTENERS__.splice(index, 1, refetchRsc);
  } else {
    globalThis.__WAKU_RSC_RELOAD_LISTENERS__.push(refetchRsc);
  }
  globalThis.__WAKU_REFETCH_RSC__ = refetchRsc;
}
`);
            } else if (id.startsWith(wakuRouterClientDist)) {
                // FIXME this is fragile. Can we do it better?
                return code.replace(/\nconst InnerRouter = \(.*?\)=>\{/, (m)=>m + `
{
  const refetchRoute = () => {
    staticPathSet.clear();
    routerData[2].clear(); // cacheIdSet
    const rscPath = encodeRoutePath(route.path);
    const rscParams = createRscParams(route.query, []);
    refetch(rscPath, rscParams);
  };
  globalThis.__WAKU_RSC_RELOAD_LISTENERS__ ||= [];
  const index = globalThis.__WAKU_RSC_RELOAD_LISTENERS__.indexOf(globalThis.__WAKU_REFETCH_ROUTE__);
  if (index !== -1) {
    globalThis.__WAKU_RSC_RELOAD_LISTENERS__.splice(index, 1, refetchRoute);
  } else {
    globalThis.__WAKU_RSC_RELOAD_LISTENERS__.unshift(refetchRoute);
  }
  globalThis.__WAKU_REFETCH_ROUTE__ = refetchRoute;
}
`);
            }
        },
        handleHotUpdate ({ file, server }) {
            if (file.endsWith('/pages.gen.ts')) {
                // auto generated file by fsRouterTypegenPlugin
                return [];
            }
            handleModuleUpdate(file, server);
            const module = server.moduleGraph.getModuleById(file);
            if (module?.file?.endsWith('.module.css')) {
                module.importers.forEach((importer)=>{
                    handleModuleUpdate(importer.file, server);
                });
            }
        }
    };
}
const pendingMap = new WeakMap();
function viteHot(viteServer) {
    return viteServer.hot ?? viteServer.ws;
}
function hotImport(viteServer, source) {
    const hot = viteHot(viteServer);
    let sourceSet = pendingMap.get(hot);
    if (!sourceSet) {
        sourceSet = new Set();
        pendingMap.set(hot, sourceSet);
        hot.on('connection', ()=>{
            for (const source of sourceSet){
                hot.send({
                    type: 'custom',
                    event: 'hot-import',
                    data: source
                });
            }
        });
    }
    sourceSet.add(source);
    hot.send({
        type: 'custom',
        event: 'hot-import',
        data: source
    });
}
const modulePendingMap = new WeakMap();
function moduleImport(viteServer, result) {
    const hot = viteHot(viteServer);
    let sources = modulePendingMap.get(hot);
    if (!sources) {
        sources = new Map();
        modulePendingMap.set(hot, sources);
    }
    sources.set(result.id, result);
    hot.send({
        type: 'custom',
        event: 'module-import',
        data: result
    });
}
async function generateInitialScripts(viteServer) {
    const hot = viteHot(viteServer);
    const sources = modulePendingMap.get(hot);
    if (!sources) {
        return [];
    }
    const scripts = [];
    for (const result of sources.values()){
        scripts.push({
            tag: 'script',
            attrs: {
                type: 'module',
                async: true,
                blocking: 'render',
                'waku-module-id': result.id
            },
            children: result.code,
            injectTo: 'head'
        });
    }
    return scripts;
}
export function hotUpdate(vite, payload) {
    const hot = viteHot(vite);
    if (payload.type === 'full-reload') {
        hot.send(payload);
    } else if (payload.event === 'rsc-reload') {
        hot.send(payload);
    } else if (payload.event === 'hot-import') {
        hotImport(vite, payload.data);
    } else if (payload.event === 'module-import') {
        moduleImport(vite, payload.data);
    }
}
function handleModuleUpdate(filePath, viteServer) {
    const moduleLoading = globalThis.__WAKU_CLIENT_MODULE_LOADING__;
    const moduleCache = globalThis.__WAKU_CLIENT_MODULE_CACHE__;
    if (!moduleLoading || !moduleCache) {
        return;
    }
    const normalizedPath = filePath.startsWith(viteServer.config.root + '/') ? filePath.slice(viteServer.config.root.length + 1) : filePath;
    const id = filePathToFileURL(normalizedPath);
    if (moduleLoading.has(id)) {
        moduleLoading.set(id, viteServer.ssrLoadModule(normalizedPath).then((m)=>{
            // XXX There can be a race condition, but it should be very rare.
            moduleCache.set(id, m);
        }));
    }
}

//# sourceMappingURL=vite-plugin-rsc-hmr.js.map