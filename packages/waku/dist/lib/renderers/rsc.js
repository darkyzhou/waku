import { filePathToFileURL } from '../utils/path.js';
import { streamToArrayBuffer } from '../utils/stream.js';
import { bufferToString, parseFormData } from '../utils/buffer.js';
const resolveClientEntryForPrd = (id, config)=>{
    return config.basePath + id + '.js';
};
const temporaryReferencesMap = new WeakMap();
export async function renderRsc(config, ctx, elements, onError, moduleIdCallback) {
    const modules = ctx.unstable_modules;
    if (!modules) {
        throw new Error('handler middleware required (missing modules)');
    }
    const { default: { renderToReadableStream } } = modules.rsdwServer;
    const resolveClientEntry = ctx.unstable_devServer ? ctx.unstable_devServer.resolveClientEntry : resolveClientEntryForPrd;
    const clientBundlerConfig = new Proxy({}, {
        get (_target, encodedId) {
            const [file, name] = encodedId.split('#');
            const id = resolveClientEntry(file, config);
            moduleIdCallback?.(id);
            return {
                id,
                chunks: [
                    id
                ],
                name,
                async: true
            };
        }
    });
    return renderToReadableStream(elements, clientBundlerConfig, {
        onError: (err)=>{
            onError.forEach((fn)=>fn(err, ctx, 'rsc'));
            if (typeof err?.digest === 'string') {
                // This is not correct according to the type though.
                return err.digest;
            }
        },
        temporaryReferences: temporaryReferencesMap.get(ctx)
    });
}
export function renderRscElement(config, ctx, element, onError) {
    const modules = ctx.unstable_modules;
    if (!modules) {
        throw new Error('handler middleware required (missing modules)');
    }
    const { default: { renderToReadableStream } } = modules.rsdwServer;
    const resolveClientEntry = ctx.unstable_devServer ? ctx.unstable_devServer.resolveClientEntry : resolveClientEntryForPrd;
    const clientBundlerConfig = new Proxy({}, {
        get (_target, encodedId) {
            const [file, name] = encodedId.split('#');
            const id = resolveClientEntry(file, config);
            return {
                id,
                chunks: [
                    id
                ],
                name,
                async: true
            };
        }
    });
    return renderToReadableStream(element, clientBundlerConfig, {
        onError: (err)=>{
            onError.forEach((fn)=>fn(err, ctx, 'rsc'));
            if (typeof err?.digest === 'string') {
                // This is not correct according to the type though.
                return err.digest;
            }
        },
        temporaryReferences: temporaryReferencesMap.get(ctx)
    });
}
export async function collectClientModules(config, rsdwServer, elements) {
    const { default: { renderToReadableStream } } = rsdwServer;
    const idSet = new Set();
    const clientBundlerConfig = new Proxy({}, {
        get (_target, encodedId) {
            const [file, name] = encodedId.split('#');
            const id = resolveClientEntryForPrd(file, config);
            idSet.add(id);
            return {
                id,
                chunks: [
                    id
                ],
                name,
                async: true
            };
        }
    });
    const readable = renderToReadableStream(elements, clientBundlerConfig);
    await new Promise((resolve, reject)=>{
        const writable = new WritableStream({
            close () {
                resolve();
            },
            abort (reason) {
                reject(reason);
            }
        });
        readable.pipeTo(writable).catch(reject);
    });
    return Array.from(idSet);
}
export async function decodeBody(ctx) {
    const isDev = !!ctx.unstable_devServer;
    const modules = ctx.unstable_modules;
    if (!modules) {
        throw new Error('handler middleware required (missing modules)');
    }
    const { default: { decodeReply, createTemporaryReferenceSet } } = modules.rsdwServer;
    const serverBundlerConfig = new Proxy({}, {
        get (_target, encodedId) {
            const [fileId, name] = encodedId.split('#');
            const id = isDev ? filePathToFileURL(fileId) : fileId + '.js';
            return {
                id,
                chunks: [
                    id
                ],
                name,
                async: true
            };
        }
    });
    let decodedBody = ctx.req.url.searchParams;
    if (ctx.req.body) {
        const temporaryReferences = createTemporaryReferenceSet();
        temporaryReferencesMap.set(ctx, temporaryReferences);
        const bodyBuf = await streamToArrayBuffer(ctx.req.body);
        const contentType = ctx.req.headers['content-type'];
        if (typeof contentType === 'string' && contentType.startsWith('multipart/form-data')) {
            // XXX This doesn't support streaming unlike busboy
            const formData = await parseFormData(bodyBuf, contentType);
            decodedBody = await decodeReply(formData, serverBundlerConfig, {
                temporaryReferences
            });
        } else if (bodyBuf.byteLength > 0) {
            const bodyStr = bufferToString(bodyBuf);
            decodedBody = await decodeReply(bodyStr, serverBundlerConfig, {
                temporaryReferences
            });
        }
    }
    return decodedBody;
}
const EXTRACT_FORM_STATE_SYMBOL = Symbol('EXTRACT_FORM_STATE');
const setExtractFormState = (ctx, extractFormState)=>{
    ctx[EXTRACT_FORM_STATE_SYMBOL] = extractFormState;
};
export const getExtractFormState = (ctx)=>{
    const extractFormState = ctx[EXTRACT_FORM_STATE_SYMBOL];
    if (!extractFormState) {
        throw new Error('extractFormState not set');
    }
    return extractFormState;
};
export async function decodePostAction(ctx) {
    const isDev = !!ctx.unstable_devServer;
    const modules = ctx.unstable_modules;
    if (!modules) {
        throw new Error('handler middleware required (missing modules)');
    }
    const { default: { decodeAction, decodeFormState } } = modules.rsdwServer;
    if (ctx.req.body) {
        const contentType = ctx.req.headers['content-type'];
        if (typeof contentType === 'string' && contentType.startsWith('multipart/form-data')) {
            const [stream1, stream2] = ctx.req.body.tee();
            ctx.req.body = stream1;
            const bodyBuf = await streamToArrayBuffer(stream2);
            // XXX This doesn't support streaming unlike busboy
            const formData = await parseFormData(bodyBuf, contentType);
            if (Array.from(formData.keys()).every((key)=>!key.startsWith('$ACTION_'))) {
                // Assuming this is probably for api
                return null;
            }
            const serverBundlerConfig = new Proxy({}, {
                get (_target, encodedId) {
                    const [fileId, name] = encodedId.split('#');
                    const id = isDev ? filePathToFileURL(fileId) : fileId + '.js';
                    return {
                        id,
                        chunks: [
                            id
                        ],
                        name,
                        async: true
                    };
                }
            });
            setExtractFormState(ctx, (actionResult)=>decodeFormState(actionResult, formData, serverBundlerConfig));
            return decodeAction(formData, serverBundlerConfig);
        }
    }
    return null;
}

//# sourceMappingURL=rsc.js.map