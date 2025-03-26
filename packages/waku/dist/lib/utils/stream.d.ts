export declare const concatUint8Arrays: (arrs: Uint8Array[]) => Uint8Array;
export declare const streamToArrayBuffer: (stream: ReadableStream) => Promise<ArrayBuffer>;
export declare const streamToString: (stream: ReadableStream) => Promise<string>;
export declare const stringToStream: (str: string) => ReadableStream;
