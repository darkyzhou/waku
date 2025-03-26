import type { UserConfig } from 'vite';
import type { ConfigDev } from '../config.js';
export declare const extendViteConfig: (viteConfig: UserConfig, configDev: ConfigDev, key: Exclude<keyof NonNullable<ConfigDev["unstable_viteConfigs"]>, "common">) => Record<string, any>;
