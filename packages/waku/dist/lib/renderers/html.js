import { createElement } from 'react';
import { injectRSCPayload } from 'rsc-html-stream/server';
import { SRC_MAIN } from '../builder/constants.js';
import { concatUint8Arrays } from '../utils/stream.js';
import { filePathToFileURL } from '../utils/path.js';
import { encodeRscPath } from './utils.js';
import { renderRsc, renderRscElement, getExtractFormState } from './rsc.js';
const fakeFetchCode = `
Promise.resolve(new Response(new ReadableStream({
  start(c) {
    const d = (self.__FLIGHT_DATA ||= []);
    const t = new TextEncoder();
    const f = (s) => c.enqueue(typeof s === 'string' ? t.encode(s) : s);
    d.forEach(f);
    d.push = f;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => c.close());
    } else {
      c.close();
    }
  }
})))
`.split('\n').map((line)=>line.trim()).join('');
const CLOSING_HEAD = '</head>';
const CLOSING_BODY = '</body>';
const injectHtmlHead = (urlForFakeFetch, htmlHead, mainJsPath)=>{
    const modifyHeadAndBody = (data)=>{
        const closingHeadIndex = data.indexOf(CLOSING_HEAD);
        let [head, body] = closingHeadIndex === -1 ? [
            '<head>' + CLOSING_HEAD,
            data
        ] : [
            data.slice(0, closingHeadIndex + CLOSING_HEAD.length),
            data.slice(closingHeadIndex + CLOSING_HEAD.length)
        ];
        head = head.slice(0, -CLOSING_HEAD.length) + htmlHead + CLOSING_HEAD;
        const matchPrefetched = head.match(// HACK This is very brittle
        /(.*<script[^>]*>\nglobalThis\.__WAKU_PREFETCHED__ = {\n)(.*?)(\n};.*)/s);
        if (matchPrefetched) {
            // HACK This is very brittle
            // TODO(daishi) find a better way
            const removed = matchPrefetched[2].replace(new RegExp(`  '${urlForFakeFetch}': .*?,`), '');
            head = matchPrefetched[1] + `  '${urlForFakeFetch}': ${fakeFetchCode},` + removed + matchPrefetched[3];
        }
        let code = `
globalThis.__WAKU_HYDRATE__ = true;
`;
        if (!matchPrefetched) {
            code += `
globalThis.__WAKU_PREFETCHED__ = {
  '${urlForFakeFetch}': ${fakeFetchCode},
};
`;
        }
        if (code) {
            head = head.slice(0, -CLOSING_HEAD.length) + `<script type="module" async>${code}</script>` + CLOSING_HEAD;
        }
        if (mainJsPath) {
            const closingBodyIndex = body.indexOf(CLOSING_BODY);
            const [firstPart, secondPart] = closingBodyIndex === -1 ? [
                body,
                ''
            ] : [
                body.slice(0, closingBodyIndex),
                body.slice(closingBodyIndex)
            ];
            body = firstPart + `<script src="${mainJsPath}" async type="module"></script>` + secondPart;
        }
        return head + body;
    };
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let headSent = false;
    let data = '';
    return new TransformStream({
        transform (chunk, controller) {
            if (!(chunk instanceof Uint8Array)) {
                throw new Error('Unknown chunk type');
            }
            data += decoder.decode(chunk);
            if (!headSent) {
                if (!/<body[^>]*>/.test(data)) {
                    return;
                }
                headSent = true;
                data = modifyHeadAndBody(data);
            }
            controller.enqueue(encoder.encode(data));
            data = '';
        },
        flush (controller) {
            if (!headSent) {
                headSent = true;
                data = modifyHeadAndBody(data);
                controller.enqueue(encoder.encode(data));
                data = '';
            }
        }
    });
};
// HACK for now, do we want to use HTML parser?
const rectifyHtml = ()=>{
    const pending = [];
    const decoder = new TextDecoder();
    let timer;
    return new TransformStream({
        transform (chunk, controller) {
            if (!(chunk instanceof Uint8Array)) {
                throw new Error('Unknown chunk type');
            }
            pending.push(chunk);
            if (/<\/\w+>$/.test(decoder.decode(chunk))) {
                clearTimeout(timer);
                timer = setTimeout(()=>{
                    controller.enqueue(concatUint8Arrays(pending.splice(0)));
                });
            }
        },
        flush (controller) {
            clearTimeout(timer);
            if (pending.length) {
                controller.enqueue(concatUint8Arrays(pending.splice(0)));
            }
        }
    });
};
// FIXME Why does it error on the first time?
let hackToIgnoreTheVeryFirstError = true;
export async function renderHtml(config, ctx, htmlHead, elements, onError, html, rscPath, actionResult) {
    const modules = ctx.unstable_modules;
    if (!modules) {
        throw new Error('handler middleware required (missing modules)');
    }
    const { default: { renderToReadableStream } } = modules.rdServer;
    const { default: { createFromReadableStream } } = modules.rsdwClient;
    const { INTERNAL_ServerRoot } = modules.wakuMinimalClient;
    const stream = await renderRsc(config, ctx, elements, onError);
    const htmlStream = renderRscElement(config, ctx, html, onError);
    const isDev = !!ctx.unstable_devServer;
    const moduleMap = new Proxy({}, {
        get (_target, filePath) {
            return new Proxy({}, {
                get (_target, name) {
                    if (isDev) {
                        let id = filePath.slice(config.basePath.length);
                        if (id.startsWith('@id/')) {
                            id = id.slice('@id/'.length);
                        } else if (id.startsWith('@fs/')) {
                            id = filePathToFileURL(id.slice('@fs'.length));
                        } else {
                            id = filePathToFileURL(id);
                        }
                        globalThis.__WAKU_CLIENT_CHUNK_LOAD__(id);
                        return {
                            id,
                            chunks: [
                                id
                            ],
                            name
                        };
                    }
                    // !isDev
                    const id = filePath.slice(config.basePath.length);
                    globalThis.__WAKU_CLIENT_CHUNK_LOAD__(id);
                    return {
                        id,
                        chunks: [
                            id
                        ],
                        name
                    };
                }
            });
        }
    });
    const [stream1, stream2] = stream.tee();
    const elementsPromise = createFromReadableStream(stream1, {
        serverConsumerManifest: {
            moduleMap,
            moduleLoading: null
        }
    });
    const htmlNode = createFromReadableStream(htmlStream, {
        serverConsumerManifest: {
            moduleMap,
            moduleLoading: null
        }
    });
    try {
        const readable = await renderToReadableStream(createElement(INTERNAL_ServerRoot, {
            elementsPromise
        }, htmlNode), {
            formState: actionResult === undefined ? null : await getExtractFormState(ctx)(actionResult),
            onError (err) {
                if (hackToIgnoreTheVeryFirstError) {
                    return;
                }
                console.error(err);
                onError.forEach((fn)=>fn(err, ctx, 'html'));
                if (typeof err?.digest === 'string') {
                    return err.digest;
                }
            }
        });
        const injected = readable.pipeThrough(rectifyHtml()).pipeThrough(injectHtmlHead(config.basePath + config.rscBase + '/' + encodeRscPath(rscPath), htmlHead, isDev ? `${config.basePath}${config.srcDir}/${SRC_MAIN}` : '')).pipeThrough(injectRSCPayload(stream2));
        injected.allReady = readable.allReady;
        return injected;
    } catch (e) {
        if (hackToIgnoreTheVeryFirstError) {
            hackToIgnoreTheVeryFirstError = false;
            return renderHtml(config, ctx, htmlHead, elements, onError, html, rscPath, actionResult);
        }
        throw e;
    }
}

//# sourceMappingURL=html.js.map