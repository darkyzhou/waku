export declare const parseOpts: (ext: string) => {
    readonly syntax: "typescript";
    readonly tsx: boolean;
    readonly jsx?: never;
} | {
    readonly syntax: "ecmascript";
    readonly jsx: boolean;
    readonly tsx?: never;
};
