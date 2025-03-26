import * as swc from '@swc/core';
export declare const treeshake: (code: string, modifyModule?: (mod: swc.Module) => void, tsx?: boolean) => Promise<string>;
export declare const removeObjectProperty: (name: string) => (node: swc.Node) => void;
