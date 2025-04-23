import type { Plugin } from 'vite';
import {
  unstable_getBuildOptions,
  unstable_builderConstants,
} from '../../server.js';

const { SRC_ENTRIES, DIST_PUBLIC } = unstable_builderConstants;

const SERVE_JS = 'serve-txiki.js';

const getServeJsContent = (
  distDir: string,
  distPublic: string,
  srcEntriesFile: string,
  honoEnhancerFile: string | undefined,
) => `
import getopts from "tjs:getopts";

const { serverEngine, importHono, importHonoServeStatic } = await import('waku/unstable_hono');
const { Hono } = await importHono();
const { serveStatic: baseServeStatic } = await importHonoServeStatic();

const distDir = '${distDir}';
const publicDir = '${distPublic}';
const loadEntries = () => import('${srcEntriesFile}');
const loadHonoEnhancer = async () => {
  ${
    honoEnhancerFile
      ? `return (await import('${honoEnhancerFile}')).default;`
      : `return (fn) => fn;`
  }
};
const env = tjs.env;

const serveStatic = (c, next) => {
  const isDir = async (path) => {
    try {
      const stat = await tjs.stat(path);
      return stat.isDirectory;
    } catch {
      return undefined;
    }
  };
  const getContent = async (path) => {
    try {
      if (await isDir(path)) {
        return null;
      }
      const handle = await tjs.open(path, "r");
      return handle.readable;
    } catch {
      return null;
    }
  };
  const pathResolve = (path) => {
    return path.startsWith('/') ? path : './' + path;
  };
  return baseServeStatic({
    isDir,
    getContent,
    pathResolve,
    root: distDir + '/' + publicDir
  })(c, next);
}

const createApp = (app) => {
  app.use(serveStatic);
  app.use(serverEngine({ cmd: 'start', loadEntries, env, unstable_onError: new Set() }));
  app.notFound(async (c) => {
    const file = distDir + '/' + publicDir + '/404.html';
    try {
      const info = await tjs.stat(file);
      if (info.isFile) {
        c.header('Content-Type', 'text/html; charset=utf-8');
        return c.body(await tjs.readFile(file), 404);
      }
    } catch {}
    return c.text('404 Not Found', 404);
  });
  return app;
};

const HONO_ENHANCER = await loadHonoEnhancer();
const HONO_APP = HONO_ENHANCER(createApp)(new Hono());

const ENCODER = new TextEncoder();
const ENCODED_NEWLINE = ENCODER.encode("\\r\\n");
const ENCODED_CHUNK_END = ENCODER.encode("0\\r\\n\\r\\n");

const parseRequestPayload = (request) => {
  if (!request || !request.includes('\\r\\n\\r\\n')) {
    return;
  }

  const [requestLineAndHeaders, body] = request.split("\\r\\n\\r\\n");
  const theBody = !body ? undefined : body;
  try {
    const [requestLine, ...requestLines] = requestLineAndHeaders.split("\\r\\n");
    const [method, path, protocol] = requestLine.split(" ");
    const headers = Object.fromEntries(requestLines.map(line => line.split(': ', 2)).filter(([key]) => key));
    return { method, path, protocol, headers, body: theBody };
  } catch (e) {
    console.error(\`parseRequestPayload error: \${e}, request: \${request}\`);
    return null;
  }
}

const handleConnection = async (listener, connection) => {
  let len = 0;
  const buf = new Uint8Array(65536);
  const nread = await connection.read(buf);
  len += (nread || 0);
  
  const requestString = new TextDecoder().decode(buf.subarray(0, len));
  const parseResult = parseRequestPayload(requestString);
  if (!parseResult) {
    return;
  }

  const { method, path, protocol, headers, body } = parseResult;
  const url = \`http://localhost:\${listener.localAddress.port}\${path}\`;
  const request = new Request(url, { method, path, protocol, headers, body });

  const response = await HONO_APP.fetch(request);
  let responseHeaders = "";
  for (const [key, value] of response.headers.entries()) {
    responseHeaders += \`\${key}: \${value}\\r\\n\`;
  }
  const bodyType = typeof response._bodyInit === 'string' ? 'string' :
    response._bodyInit instanceof ReadableStream ? 'stream' : 'buffer';
  if (bodyType === 'stream') {
    responseHeaders += \`transfer-encoding: chunked\\r\\n\`;
  }

  connection.setNoDelay(true);
  await connection.write(new TextEncoder().encode(\`HTTP/1.1 \${response.status} \${response.statusText}\\r\\n\${responseHeaders}\\r\\n\`));
  if (bodyType === 'string') {
    await connection.write(ENCODER.encode(await response.text()));
  } else if (bodyType === 'buffer') {
    const data = await response.arrayBuffer();
    await connection.write(new Uint8Array(data));
  } else {
    const chunkedEncoder = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(ENCODER.encode(chunk.length.toString(16)));
        controller.enqueue(ENCODED_NEWLINE);
        controller.enqueue(chunk);
        controller.enqueue(ENCODED_NEWLINE);
      },
      flush(controller) {
        controller.enqueue(ENCODED_CHUNK_END);
      }
    });
    const theBody = response._bodyInit;
    await theBody.pipeThrough(chunkedEncoder).pipeTo(connection.writable);
  }

  connection.close();
}

const options = getopts(tjs.args.slice(2), {
  alias: { listen: "l", port: "p" },
  default: { listen: "127.0.0.1", port: 8080 },
});
const listener = await tjs.listen("tcp", options.listen, options.port);

console.log(\`Listening on \${listener.localAddress.ip}:\${listener.localAddress.port}\`);
for await (let connection of listener) {
  handleConnection(listener, connection).catch((e) => {
    console.error('handleConnection error', e);
  });
  connection = undefined;
}
`.trim();

export function deployTxikiPlugin(opts: {
  srcDir: string;
  distDir: string;
  unstable_honoEnhancer: string | undefined;
}): Plugin {
  const buildOptions = unstable_getBuildOptions();
  let entriesFile: string;
  let honoEnhancerFile: string | undefined;
  return {
    name: 'deploy-txiki-plugin',
    config(viteConfig) {
      const { deploy, unstable_phase } = buildOptions;
      if (unstable_phase !== 'buildServerBundle' || deploy !== 'txiki') {
        return;
      }

      const { input } = viteConfig.build?.rollupOptions ?? {};
      if (input && !(typeof input === 'string') && !(input instanceof Array)) {
        input[SERVE_JS.replace(/\.js$/, '')] = `${opts.srcDir}/${SERVE_JS}`;
      }
    },
    configResolved(config) {
      entriesFile = `${config.root}/${opts.srcDir}/${SRC_ENTRIES}`;

      if (opts.unstable_honoEnhancer) {
        honoEnhancerFile = `${config.root}/${opts.unstable_honoEnhancer}`;
      }

      const { deploy, unstable_phase } = buildOptions;
      if (
        (unstable_phase !== 'buildServerBundle' &&
          unstable_phase !== 'buildSsrBundle') ||
        deploy !== 'txiki'
      ) {
        return;
      }
      config.ssr.target = 'webworker';
      config.ssr.resolve ||= {};
      config.ssr.resolve.conditions ||= [];
      config.ssr.resolve.conditions.push('worker');
      config.ssr.resolve.externalConditions ||= [];
      config.ssr.resolve.externalConditions.push('worker');

      if (Array.isArray(config.build.rollupOptions.output)) {
        throw new Error('vite-plugin-deploy-txiki: unexpected array output');
      }

      if (!config.build?.rollupOptions?.output) {
        config.build.rollupOptions.output = {};
      }
      config.build.rollupOptions.output.manualChunks = (id: string) => {
        if (id.includes('/lib/config.js')) {
          return 'config';
        }
      };
    },
    resolveId(source) {
      if (source === `${opts.srcDir}/${SERVE_JS}`) {
        return source;
      }

      if (source.startsWith('tjs:')) {
        return { id: source, external: true };
      }
    },
    load(id) {
      if (id === `${opts.srcDir}/${SERVE_JS}`) {
        return getServeJsContent(opts.distDir, DIST_PUBLIC, entriesFile, honoEnhancerFile);
      }
    },
  };
}
