import type { Plugin } from 'vite';

import { unstable_getBuildOptions } from '../../server.js';
import { SRC_ENTRIES } from '../constants.js';
import { DIST_PUBLIC } from '../builder/constants.js';

const SERVE_JS = 'serve-txiki.js';

const getServeJsContent = (
  distDir: string,
  distPublic: string,
  srcEntriesFile: string,
) => `
import ffi from "tjs:ffi";
import getopts from "tjs:getopts";

const { serverEngine, importHono, importHonoServeStatic } = await import('waku/unstable_hono');
const { Hono } = await importHono();
const { serveStatic: baseServeStatic } = await importHonoServeStatic();

const distDir = '${distDir}';
const publicDir = '${distPublic}';
const loadEntries = () => import('${srcEntriesFile}');
const configPromise = loadEntries().then((entries) => entries.loadConfig());
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

const HONO_ENHANCER = (await configPromise).unstable_honoEnhancer || ((createApp) => createApp);
const HONO_APP = HONO_ENHANCER(createApp)(new Hono());

const ENCODER = new TextEncoder();
const ENCODED_NEWLINE = ENCODER.encode("\\r\\n");
const ENCODED_CHUNK_END = ENCODER.encode("0\\r\\n\\r\\n");

const handleConnection = async (listener, connection) => {
  const buf = new Uint8Array(1024);
  await connection.read(buf);
  const requestString = ffi.bufferToString(buf);
  const requestLines = requestString.split("\\r\\n");
  const requestLine = requestLines[0].split(" ");
  const headers = {};
  for (let i = 1; i < requestLines.length; i++) {
    const line = requestLines[i];
    if (line) {
      const [key, ...valueParts] = line.split(": ");
      headers[key] = valueParts.join(": ");
    }
  }

  const method = requestLine[0];
  const path = requestLine[1];
  const protocol = requestLine[2];
  const url = \`http://localhost:\${listener.localAddress.port}\${path}\`;
  const request = new Request(url, {
    method,
    path,
    protocol,
    headers,
  });
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
}): Plugin {
  const buildOptions = unstable_getBuildOptions();
  let entriesFile: string;
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
        return getServeJsContent(opts.distDir, DIST_PUBLIC, entriesFile);
      }
    },
  };
}
