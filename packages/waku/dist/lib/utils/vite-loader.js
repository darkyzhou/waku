import { createServer as createViteServer } from 'vite';
import { fileURLToFilePath } from '../utils/path.js';
export const loadServerModule = async (idOrFileURL)=>{
    if (idOrFileURL === 'waku' || idOrFileURL.startsWith('waku/')) {
        // HACK `external: ['waku']` doesn't do the same
        return import(idOrFileURL);
    }
    const vite = await createViteServer({
        server: {
            middlewareMode: true,
            watch: null
        },
        appType: 'custom',
        environments: {
            config: {
                resolve: {
                    external: [
                        'waku'
                    ]
                }
            }
        }
    });
    await vite.ws.close();
    await Promise.all(Object.values(vite.environments).map((env)=>env.name === 'config' || env.close()));
    const mod = await vite.environments.config.runner.import(idOrFileURL.startsWith('file://') ? fileURLToFilePath(idOrFileURL) : idOrFileURL);
    return mod;
};

//# sourceMappingURL=vite-loader.js.map