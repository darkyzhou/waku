/** Remove (group)s from path. Like /(group)/foo => /foo */ export const getGrouplessPath = (path)=>{
    if (!import.meta.env?.VITE_EXPERIMENTAL_WAKU_ROUTER) {
        return path;
    }
    if (path.includes('(')) {
        const withoutGroups = path.split('/').filter((part)=>!part.startsWith('('));
        path = withoutGroups.length > 1 ? withoutGroups.join('/') : '/';
    }
    return path;
};

//# sourceMappingURL=create-pages.js.map