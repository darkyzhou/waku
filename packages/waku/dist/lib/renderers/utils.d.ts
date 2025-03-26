export declare const encodeRscPath: (rscPath: string) => string;
export declare const decodeRscPath: (rscPath: string) => string;
export declare const encodeFuncId: (funcId: string) => string;
export declare const decodeFuncId: (encoded: string) => string | null;
export declare const generatePrefetchCode: (basePrefix: string, rscPaths: Iterable<string>, moduleIds: Iterable<string>) => string;
export declare const deepFreeze: (x: unknown) => void;
