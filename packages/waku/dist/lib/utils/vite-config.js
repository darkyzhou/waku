import { mergeConfig } from 'vite';
const areProbablySamePlugins = (a, b)=>{
    if (typeof a !== 'object' || a === null) {
        return false;
    }
    if (typeof b !== 'object' || b === null) {
        return false;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, index)=>areProbablySamePlugins(item, b[index]));
    }
    return 'name' in a && 'name' in b && a.name === b.name;
};
export const extendViteConfig = (viteConfig, configDev, key)=>{
    const mergedConfig = mergeConfig(viteConfig, {
        // shallow merge
        ...configDev.unstable_viteConfigs?.['common']?.(),
        ...configDev.unstable_viteConfigs?.[key]?.()
    });
    // remove duplicate plugins (latter wins)
    mergedConfig.plugins = mergedConfig.plugins?.filter((plugin, index, arr)=>arr.findLastIndex((p)=>areProbablySamePlugins(p, plugin)) === index);
    return mergedConfig;
};

//# sourceMappingURL=vite-config.js.map