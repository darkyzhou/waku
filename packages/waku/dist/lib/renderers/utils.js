// This file should not include Node specific code.
export const encodeRscPath = (rscPath)=>{
    if (rscPath.startsWith('_')) {
        throw new Error('rscPath must not start with `_`: ' + rscPath);
    }
    if (rscPath.endsWith('_')) {
        throw new Error('rscPath must not end with `_`: ' + rscPath);
    }
    if (rscPath === '') {
        rscPath = '_';
    }
    if (rscPath.startsWith('/')) {
        rscPath = '_' + rscPath;
    }
    if (rscPath.endsWith('/')) {
        rscPath += '_';
    }
    return rscPath + '.txt';
};
export const decodeRscPath = (rscPath)=>{
    if (!rscPath.endsWith('.txt')) {
        const err = new Error('Invalid encoded rscPath');
        err.statusCode = 400;
        throw err;
    }
    rscPath = rscPath.slice(0, -'.txt'.length);
    if (rscPath.startsWith('_')) {
        rscPath = rscPath.slice(1);
    }
    if (rscPath.endsWith('_')) {
        rscPath = rscPath.slice(0, -1);
    }
    return rscPath;
};
const FUNC_PREFIX = 'F/';
export const encodeFuncId = (funcId)=>{
    const [file, name] = funcId.split('#');
    if (name.includes('/')) {
        throw new Error('Function name must not include `/`: ' + name);
    }
    if (file.startsWith('_')) {
        throw new Error('File must not start with `_`: ' + file);
    }
    if (file.startsWith('/')) {
        return FUNC_PREFIX + '_' + file + '/' + name;
    }
    return FUNC_PREFIX + file + '/' + name;
};
export const decodeFuncId = (encoded)=>{
    if (!encoded.startsWith(FUNC_PREFIX)) {
        return null;
    }
    const index = encoded.lastIndexOf('/');
    const file = encoded.slice(FUNC_PREFIX.length, index);
    const name = encoded.slice(index + 1);
    if (file.startsWith('_')) {
        return file.slice(1) + '#' + name;
    }
    return file + '#' + name;
};
export const generatePrefetchCode = (basePrefix, rscPaths, moduleIds)=>{
    const rscPathArray = Array.from(rscPaths);
    let code = '';
    if (rscPathArray.length) {
        code += `
globalThis.__WAKU_PREFETCHED__ = {
${rscPathArray.map((rscPath)=>{
            const url = basePrefix + encodeRscPath(rscPath);
            return `  '${url}': fetch('${url}'),`;
        }).join('\n')}
};`;
    }
    for (const moduleId of moduleIds){
        code += `
import('${moduleId}');`;
    }
    return code;
};
export const deepFreeze = (x)=>{
    if (typeof x === 'object' && x !== null) {
        Object.freeze(x);
        for (const value of Object.values(x)){
            deepFreeze(value);
        }
    }
};

//# sourceMappingURL=utils.js.map