import { transformWithEsbuild } from 'vite';
import { EXTENSIONS } from '../builder/constants.js';
import { extname } from '../utils/path.js';
// https://github.com/vite-plugin/vite-plugin-commonjs/blob/5e3294e78fabb037e12aab75433908fbee17192a/src/utils.ts#L9-L15
const isCommonjs = (code)=>/\b(?:require|module|exports)\b/.test(code.replace(/\/\*(.|[\r\n])*?\*\//gm, '').replace(/\/\/.*/g, ''));
export function devCommonJsPlugin(opts) {
    return {
        name: 'dev-commonjs-plugin',
        async transform (code, id) {
            if (opts.filter) {
                if (!opts.filter(id)) {
                    return;
                }
            } else {
                const ext = extname(id.split('?')[0]);
                if (!EXTENSIONS.includes(ext)) {
                    return;
                }
                if (code.startsWith("import { createRequire } from 'module';")) {
                    return;
                }
                if (!isCommonjs(code)) {
                    return;
                }
            }
            const result = await transformWithEsbuild(code, id, {
                format: 'esm',
                banner: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`
            });
            return result;
        }
    };
}

//# sourceMappingURL=vite-plugin-dev-commonjs.js.map