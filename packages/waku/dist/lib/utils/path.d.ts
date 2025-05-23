export declare const encodeFilePathToAbsolute: (filePath: string) => string;
export declare const decodeFilePathFromAbsolute: (filePath: string) => string;
export declare const filePathToFileURL: (filePath: string) => string;
export declare const fileURLToFilePath: (fileURL: string) => string;
export declare const joinPath: (...paths: string[]) => string;
export declare const extname: (filePath: string) => string;
export type PathSpecItem = {
    type: 'literal';
    name: string;
} | {
    type: 'group';
    name?: string;
} | {
    type: 'wildcard';
    name?: string;
};
export type PathSpec = readonly PathSpecItem[];
export declare const parsePathWithSlug: (path: string) => PathSpec;
export declare const parseExactPath: (path: string) => PathSpec;
/**
 * Transform a path spec to a regular expression.
 */
export declare const path2regexp: (path: PathSpec) => string;
/** Convert a path spec to a string for the path */
export declare const pathSpecAsString: (path: PathSpec) => string;
/**
 * Helper function to get the path mapping from the path spec and the pathname.
 *
 * @param pathSpec
 * @param pathname - route as a string
 * @example
 * getPathMapping(
 *   [
 *     { type: 'literal', name: 'foo' },
 *     { type: 'group', name: 'a' },
 *   ],
 *   '/foo/bar',
 * );
 * // => { a: 'bar' }
 */
export declare const getPathMapping: (pathSpec: PathSpec, pathname: string) => Record<string, string | string[]> | null;
