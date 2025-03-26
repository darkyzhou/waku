import { EXTENSIONS } from '../builder/constants.js';
import { extname } from '../utils/path.js';
export function nonjsResolvePlugin() {
    return {
        name: 'nonjs-resolve-plugin',
        async resolveId (id, importer, options) {
            if (id.endsWith('.js')) {
                for (const ext of EXTENSIONS){
                    const resolved = await this.resolve(id.slice(0, -extname(id).length) + ext, importer, options);
                    if (resolved) {
                        return resolved;
                    }
                }
            }
        }
    };
}

//# sourceMappingURL=vite-plugin-nonjs-resolve.js.map