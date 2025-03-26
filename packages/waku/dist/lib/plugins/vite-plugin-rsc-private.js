import { joinPath } from '../utils/path.js';
export function rscPrivatePlugin({ privateDir, hotUpdateCallback }) {
    let privatePath;
    return {
        name: 'rsc-private-plugin',
        configResolved (config) {
            privatePath = joinPath(config.root, privateDir);
        },
        load (id) {
            if (id.startsWith(privatePath)) {
                throw new Error('Private file access is not allowed');
            }
        },
        handleHotUpdate ({ file }) {
            if (file.startsWith(privatePath)) {
                hotUpdateCallback?.({
                    type: 'custom',
                    event: 'rsc-reload'
                });
            }
        }
    };
}

//# sourceMappingURL=vite-plugin-rsc-private.js.map