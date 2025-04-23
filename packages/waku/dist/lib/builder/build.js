import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { build as buildVite, resolveConfig as resolveViteConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';
import { INTERNAL_setAllEnv, unstable_getBuildOptions } from '../../server.js';
import { resolveConfigDev } from '../config.js';
import { extname, filePathToFileURL, joinPath } from '../utils/path.js';
import { extendViteConfig } from '../utils/vite-config.js';
import { copyFile, createWriteStream, existsSync, mkdir, readdir, readFile, unlink, writeFile } from '../utils/node-fs.js';
import { encodeRscPath, generatePrefetchCode } from '../renderers/utils.js';
import { collectClientModules, renderRsc } from '../renderers/rsc.js';
import { renderHtml } from '../renderers/html.js';
import { SERVER_MODULE_MAP, CLIENT_MODULE_MAP, CLIENT_PREFIX } from '../middleware/handler.js';
import { rscRsdwPlugin } from '../plugins/vite-plugin-rsc-rsdw.js';
import { rscIndexPlugin } from '../plugins/vite-plugin-rsc-index.js';
import { rscAnalyzePlugin } from '../plugins/vite-plugin-rsc-analyze.js';
import { nonjsResolvePlugin } from '../plugins/vite-plugin-nonjs-resolve.js';
import { rscTransformPlugin } from '../plugins/vite-plugin-rsc-transform.js';
import { rscEntriesPlugin } from '../plugins/vite-plugin-rsc-entries.js';
import { rscEnvPlugin } from '../plugins/vite-plugin-rsc-env.js';
import { rscPrivatePlugin } from '../plugins/vite-plugin-rsc-private.js';
import { rscManagedPlugin } from '../plugins/vite-plugin-rsc-managed.js';
import { EXTENSIONS, DIST_ENTRIES_JS, DIST_PUBLIC, DIST_ASSETS, DIST_SSR } from './constants.js';
import { deployVercelPlugin } from '../plugins/vite-plugin-deploy-vercel.js';
import { deployNetlifyPlugin } from '../plugins/vite-plugin-deploy-netlify.js';
import { deployCloudflarePlugin } from '../plugins/vite-plugin-deploy-cloudflare.js';
import { deployDenoPlugin } from '../plugins/vite-plugin-deploy-deno.js';
import { deployPartykitPlugin } from '../plugins/vite-plugin-deploy-partykit.js';
import { deployAwsLambdaPlugin } from '../plugins/vite-plugin-deploy-aws-lambda.js';
import { deployTxikiPlugin } from '../plugins/vite-plugin-deploy-txiki.js';
import { emitPlatformData } from './platform-data.js';
// TODO this file and functions in it are too long. will fix.
// Upstream issue: https://github.com/rollup/rollup/issues/4699
const onwarn = (warning, defaultHandler)=>{
    if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && /"use (client|server)"/.test(warning.message)) {
        return;
    } else if (warning.code === 'SOURCEMAP_ERROR' && warning.loc?.column === 0 && warning.loc?.line === 1) {
        return;
    }
    defaultHandler(warning);
};
const deployPlugins = (config)=>[
        deployVercelPlugin(config),
        deployNetlifyPlugin(config),
        deployCloudflarePlugin(config),
        deployDenoPlugin(config),
        deployPartykitPlugin(config),
        deployAwsLambdaPlugin(config),
        deployTxikiPlugin(config)
    ];
const analyzeEntries = async (rootDir, config)=>{
    const clientFileMap = new Map();
    const serverFileMap = new Map();
    const serverPageFiles = {}; // page id -> full path
    const pagesDirPath = joinPath(rootDir, config.srcDir, config.pagesDir);
    if (existsSync(pagesDirPath)) {
        const files = await readdir(pagesDirPath, {
            encoding: 'utf8',
            recursive: true
        });
        for (const file of files){
            const ext = extname(file);
            if (EXTENSIONS.includes(ext)) {
                serverPageFiles[joinPath(config.pagesDir, file.slice(0, -ext.length))] = joinPath(pagesDirPath, file);
            }
        }
    }
    await buildVite(extendViteConfig({
        mode: 'production',
        plugins: [
            rscAnalyzePlugin({
                isClient: false,
                clientFileMap,
                serverFileMap
            }),
            rscManagedPlugin({
                ...config,
                addEntriesToInput: true
            }),
            ...deployPlugins(config)
        ],
        ssr: {
            target: 'webworker',
            resolve: {
                conditions: [
                    'react-server'
                ],
                externalConditions: [
                    'react-server'
                ]
            },
            noExternal: /^(?!node:)/
        },
        build: {
            write: false,
            ssr: true,
            target: 'node20',
            rollupOptions: {
                onwarn,
                input: {
                    ...SERVER_MODULE_MAP,
                    ...serverPageFiles
                },
                output: {
                    inlineDynamicImports: false
                }
            }
        }
    }, config, 'build-analyze'));
    const clientAnalyzeOutput = await buildVite(extendViteConfig({
        mode: 'production',
        plugins: [
            rscAnalyzePlugin({
                isClient: true,
                clientFileMap,
                serverFileMap
            }),
            rscManagedPlugin({
                ...config,
                addMainToInput: true
            }),
            ...deployPlugins(config)
        ],
        ssr: {
            target: 'webworker',
            noExternal: /^(?!node:)/
        },
        build: {
            write: false,
            ssr: true,
            target: 'node20',
            rollupOptions: {
                onwarn,
                input: {
                    ...CLIENT_MODULE_MAP,
                    ...Object.fromEntries(Array.from(clientFileMap).map(([fname, hash], i)=>[
                            `${DIST_ASSETS}/rsc${i}-${hash}`,
                            fname
                        ]))
                },
                output: {
                    inlineDynamicImports: false
                }
            }
        }
    }, config, 'build-analyze'));
    if (!('output' in clientAnalyzeOutput)) {
        throw new Error('Unexpected vite client analyze output');
    }
    const clientEntryFiles = {};
    const clientEntryAliasMap = new Map();
    let index = 0;
    for (const [fname, hash] of clientFileMap){
        const entry = `${DIST_ASSETS}/rsc${index++}-${hash}`;
        clientEntryFiles[entry] = fname;
        for (const key of Object.keys(CLIENT_MODULE_MAP)){
            if (clientAnalyzeOutput.output.find((item)=>item.type === 'chunk' && item.name === key && item.moduleIds.includes(fname))) {
                clientEntryAliasMap.set(key, entry);
            }
        }
    }
    const serverEntryFiles = {};
    index = 0;
    for (const [fname, hash] of serverFileMap){
        const entry = `${DIST_ASSETS}/rsf${index++}-${hash}`;
        serverEntryFiles[entry] = fname;
    }
    return {
        clientEntryFiles,
        serverEntryFiles,
        serverPageFiles,
        clientEntryAliasMap
    };
};
// For RSC
const buildServerBundle = async (rootDir, env, config, clientEntryFiles, serverEntryFiles, serverPageFiles, clientEntryAliasMap, partial)=>{
    const serverBuildOutput = await buildVite(extendViteConfig({
        mode: 'production',
        plugins: [
            nonjsResolvePlugin(),
            rscTransformPlugin({
                isClient: false,
                isBuild: true,
                clientEntryFiles,
                serverEntryFiles
            }),
            rscRsdwPlugin(),
            rscEnvPlugin({
                isDev: false,
                env,
                config
            }),
            rscPrivatePlugin(config),
            rscManagedPlugin({
                ...config,
                addEntriesToInput: true
            }),
            rscEntriesPlugin({
                basePath: config.basePath,
                rscBase: config.rscBase,
                middleware: config.middleware,
                rootDir,
                srcDir: config.srcDir,
                ssrDir: DIST_SSR,
                moduleMap: {
                    ...SERVER_MODULE_MAP,
                    ...Object.fromEntries(Object.entries(serverEntryFiles).map(([key, val])=>[
                            `${key}.js`,
                            val
                        ])),
                    ...Object.fromEntries(Object.keys(CLIENT_MODULE_MAP).map((key)=>[
                            `${CLIENT_PREFIX}${key}`,
                            `./${DIST_SSR}/${clientEntryAliasMap.get(key) || key}.js`
                        ])),
                    ...Object.fromEntries(Object.keys(clientEntryFiles).map((key)=>[
                            `${DIST_SSR}/${key}.js`,
                            `./${DIST_SSR}/${key}.js`
                        ]))
                }
            }),
            ...deployPlugins(config)
        ],
        ssr: {
            resolve: {
                conditions: [
                    'react-server'
                ],
                externalConditions: [
                    'react-server'
                ]
            },
            noExternal: /^(?!node:)/
        },
        esbuild: {
            jsx: 'automatic'
        },
        define: {
            'process.env.NODE_ENV': JSON.stringify('production')
        },
        publicDir: false,
        build: {
            emptyOutDir: !partial,
            ssr: true,
            ssrEmitAssets: true,
            target: 'node20',
            outDir: joinPath(rootDir, config.distDir),
            rollupOptions: {
                onwarn,
                input: {
                    ...clientEntryFiles,
                    ...serverEntryFiles,
                    ...SERVER_MODULE_MAP,
                    ...serverPageFiles
                }
            }
        }
    }, config, 'build-server'));
    if (!('output' in serverBuildOutput)) {
        throw new Error('Unexpected vite server build output');
    }
    const serverAssets = serverBuildOutput.output.flatMap(({ type, fileName })=>type === 'asset' ? [
            fileName
        ] : []);
    return {
        serverAssets
    };
};
// For SSR (render client components on server to generate HTML)
const buildSsrBundle = async (rootDir, env, config, clientEntryFiles, serverEntryFiles, serverAssets, partial)=>{
    const cssAssets = serverAssets.filter((fileName)=>fileName.endsWith('.css'));
    await buildVite(extendViteConfig({
        mode: 'production',
        base: config.basePath,
        plugins: [
            rscRsdwPlugin(),
            rscIndexPlugin({
                ...config,
                cssAssets
            }),
            rscEnvPlugin({
                isDev: false,
                env,
                config
            }),
            rscPrivatePlugin(config),
            rscManagedPlugin({
                ...config,
                addMainToInput: true
            }),
            rscTransformPlugin({
                isClient: true,
                isBuild: true,
                serverEntryFiles
            }),
            ...deployPlugins(config)
        ],
        ssr: {
            noExternal: /^(?!node:)/
        },
        esbuild: {
            jsx: 'automatic'
        },
        define: {
            'process.env.NODE_ENV': JSON.stringify('production')
        },
        publicDir: false,
        build: {
            emptyOutDir: !partial,
            ssr: true,
            target: 'node20',
            outDir: joinPath(rootDir, config.distDir, DIST_SSR),
            rollupOptions: {
                onwarn,
                input: {
                    ...clientEntryFiles,
                    ...CLIENT_MODULE_MAP
                },
                output: {
                    entryFileNames: (chunkInfo)=>{
                        if (CLIENT_MODULE_MAP[chunkInfo.name] || clientEntryFiles[chunkInfo.name]) {
                            return '[name].js';
                        }
                        return DIST_ASSETS + '/[name]-[hash].js';
                    }
                }
            }
        }
    }, config, 'build-ssr'));
};
// For Browsers
const buildClientBundle = async (rootDir, env, config, clientEntryFiles, serverEntryFiles, serverAssets, partial)=>{
    const nonJsAssets = serverAssets.filter((fileName)=>!fileName.endsWith('.js'));
    const cssAssets = nonJsAssets.filter((asset)=>asset.endsWith('.css'));
    const clientBuildOutput = await buildVite(extendViteConfig({
        mode: 'production',
        base: config.basePath,
        plugins: [
            viteReact(),
            rscRsdwPlugin(),
            rscIndexPlugin({
                ...config,
                cssAssets
            }),
            rscEnvPlugin({
                isDev: false,
                env,
                config
            }),
            rscPrivatePlugin(config),
            rscManagedPlugin({
                ...config,
                addMainToInput: true
            }),
            rscTransformPlugin({
                isClient: true,
                isBuild: true,
                serverEntryFiles
            }),
            ...deployPlugins(config)
        ],
        build: {
            emptyOutDir: !partial,
            outDir: joinPath(rootDir, config.distDir, DIST_PUBLIC),
            rollupOptions: {
                onwarn,
                // rollup will ouput the style files related to clientEntryFiles, but since it does not find any link to them in the index.html file, it will not inject them. They are only mentioned by the standalone `clientEntryFiles`
                input: clientEntryFiles,
                preserveEntrySignatures: 'exports-only',
                output: {
                    entryFileNames: (chunkInfo)=>{
                        if (clientEntryFiles[chunkInfo.name]) {
                            return '[name].js';
                        }
                        return DIST_ASSETS + '/[name]-[hash].js';
                    }
                }
            }
        }
    }, config, 'build-client'));
    if (!('output' in clientBuildOutput)) {
        throw new Error('Unexpected vite client build output');
    }
    const clientAssets = clientBuildOutput.output.flatMap(({ type, fileName })=>type === 'asset' ? [
            fileName
        ] : []);
    for (const nonJsAsset of nonJsAssets){
        const from = joinPath(rootDir, config.distDir, nonJsAsset);
        const to = joinPath(rootDir, config.distDir, DIST_PUBLIC, nonJsAsset);
        await copyFile(from, to);
    }
    return {
        clientAssets
    };
};
// TODO: Add progress indication for static builds.
const createTaskRunner = (limit)=>{
    let running = 0;
    const waiting = [];
    const errors = [];
    const scheduleTask = async (task)=>{
        if (running >= limit) {
            await new Promise((resolve)=>waiting.push(resolve));
        }
        running++;
        try {
            await task();
        } catch (err) {
            errors.push(err);
        } finally{
            running--;
            waiting.shift()?.();
        }
    };
    const runTask = (task)=>{
        scheduleTask(task).catch(()=>{});
    };
    const waitForTasks = async ()=>{
        if (running > 0) {
            await new Promise((resolve)=>waiting.push(resolve));
            await waitForTasks();
        }
        if (errors.length > 0) {
            console.error('Errors occurred during running tasks:', errors);
            throw errors[0];
        }
    };
    return {
        runTask,
        waitForTasks
    };
};
const WRITE_FILE_BATCH_SIZE = 2500;
const { runTask, waitForTasks } = createTaskRunner(WRITE_FILE_BATCH_SIZE);
const emitStaticFile = (rootDir, config, pathname, body)=>{
    const destFile = joinPath(rootDir, config.distDir, DIST_PUBLIC, extname(pathname) ? pathname : pathname === '/404' ? '404.html' // HACK special treatment for 404, better way?
     : pathname + '/index.html');
    // In partial mode, skip if the file already exists.
    if (existsSync(destFile)) {
        return;
    }
    runTask(async ()=>{
        await mkdir(joinPath(destFile, '..'), {
            recursive: true
        });
        if (typeof body === 'string') {
            await writeFile(destFile, body);
        } else {
            await pipeline(Readable.fromWeb(await body), createWriteStream(destFile));
        }
    });
};
const emitStaticFiles = async (rootDir, config, distEntriesFile, distEntries, cssAssets)=>{
    const unstable_modules = {
        rsdwServer: await distEntries.loadModule('rsdw-server'),
        rdServer: await distEntries.loadModule(CLIENT_PREFIX + 'rd-server'),
        rsdwClient: await distEntries.loadModule(CLIENT_PREFIX + 'rsdw-client'),
        wakuMinimalClient: await distEntries.loadModule(CLIENT_PREFIX + 'waku-minimal-client')
    };
    const publicIndexHtmlFile = joinPath(rootDir, config.distDir, DIST_PUBLIC, 'index.html');
    const publicIndexHtml = await readFile(publicIndexHtmlFile, {
        encoding: 'utf8'
    });
    const publicIndexHtmlHead = publicIndexHtml.replace(/.*?<head>(.*?)<\/head>.*/s, '$1');
    const cssStr = cssAssets.map((asset)=>`<link rel="stylesheet" href="${config.basePath}${asset}">`).join('\n');
    const defaultHtmlStr = publicIndexHtml// HACK is this too naive to inject style code?
    .replace(/<\/head>/, cssStr + '</head>');
    const defaultHtmlHead = publicIndexHtmlHead + cssStr;
    const baseRscPrefix = config.basePath + config.rscBase + '/';
    const utils = {
        renderRsc: (elements, options)=>renderRsc(config, {
                unstable_modules
            }, elements, new Set(), options?.moduleIdCallback),
        renderHtml: async (elements, html, options)=>{
            const body = await renderHtml(config, {
                unstable_modules
            }, defaultHtmlHead + (options.htmlHead || ''), elements, new Set(), html, options.rscPath);
            const headers = {
                'content-type': 'text/html; charset=utf-8'
            };
            return {
                body,
                headers
            };
        },
        rscPath2pathname: (rscPath)=>joinPath(config.rscBase, encodeRscPath(rscPath)),
        unstable_generatePrefetchCode: (rscPaths, moduleIds)=>generatePrefetchCode(baseRscPrefix, rscPaths, moduleIds),
        unstable_collectClientModules: (elements)=>collectClientModules(config, unstable_modules.rsdwServer, elements)
    };
    const dynamicHtmlPathMap = new Map();
    const buildConfigs = distEntries.default.handleBuild(utils);
    if (buildConfigs) {
        await unlink(publicIndexHtmlFile);
    }
    for await (const buildConfig of buildConfigs || []){
        switch(buildConfig.type){
            case 'file':
                emitStaticFile(rootDir, config, buildConfig.pathname, buildConfig.body);
                break;
            case 'htmlHead':
                dynamicHtmlPathMap.set(buildConfig.pathSpec, defaultHtmlHead + (buildConfig.head || ''));
                break;
            case 'defaultHtml':
                emitStaticFile(rootDir, config, buildConfig.pathname, // HACK is this too naive to inject script code?
                defaultHtmlStr.replace(/<\/head>/, (buildConfig.head || '') + '</head>'));
                break;
        }
    }
    await waitForTasks();
    const dynamicHtmlPaths = Array.from(dynamicHtmlPathMap);
    let distEntriesFileContent = await readFile(distEntriesFile, {
        encoding: 'utf8'
    });
    distEntriesFileContent = distEntriesFileContent.replace('globalThis.__WAKU_DEFAULT_HTML_HEAD__', JSON.stringify(defaultHtmlHead));
    distEntriesFileContent = distEntriesFileContent.replace('globalThis.__WAKU_DYNAMIC_HTML_PATHS__', JSON.stringify(dynamicHtmlPaths));
    distEntriesFileContent = distEntriesFileContent.replace('globalThis.__WAKU_PUBLIC_INDEX_HTML__', JSON.stringify(defaultHtmlStr));
    await writeFile(distEntriesFile, distEntriesFileContent);
};
// For Deploy
// FIXME Is this a good approach? I wonder if there's something missing.
const buildDeploy = async (rootDir, config)=>{
    const DUMMY = 'dummy-entry';
    await buildVite(extendViteConfig({
        plugins: [
            {
                // FIXME This is too hacky. There must be a better way.
                name: 'dummy-entry-plugin',
                resolveId (source) {
                    if (source === DUMMY) {
                        return source;
                    }
                },
                load (id) {
                    if (id === DUMMY) {
                        return '';
                    }
                },
                generateBundle (_options, bundle) {
                    Object.entries(bundle).forEach(([key, value])=>{
                        if (value.name === DUMMY) {
                            delete bundle[key];
                        }
                    });
                }
            },
            ...deployPlugins(config)
        ],
        publicDir: false,
        build: {
            emptyOutDir: false,
            ssr: true,
            rollupOptions: {
                onwarn: (warning, warn)=>{
                    if (!warning.message.startsWith('Generated an empty chunk:')) {
                        warn(warning);
                    }
                },
                input: {
                    [DUMMY]: DUMMY
                }
            },
            outDir: joinPath(rootDir, config.distDir)
        }
    }, config, 'build-deploy'));
};
export async function build(options) {
    const env = options.env || {};
    const config = await resolveConfigDev(options.config);
    const rootDir = (await resolveViteConfig({}, 'build', 'production', 'production')).root;
    const distEntriesFile = joinPath(rootDir, config.distDir, DIST_ENTRIES_JS);
    const buildOptions = unstable_getBuildOptions();
    buildOptions.deploy = options.deploy;
    buildOptions.unstable_phase = 'analyzeEntries';
    const { clientEntryFiles, serverEntryFiles, serverPageFiles, clientEntryAliasMap } = await analyzeEntries(rootDir, config);
    buildOptions.unstable_phase = 'buildServerBundle';
    const { serverAssets } = await buildServerBundle(rootDir, env, config, clientEntryFiles, serverEntryFiles, serverPageFiles, clientEntryAliasMap, !!options.partial);
    buildOptions.unstable_phase = 'buildSsrBundle';
    await buildSsrBundle(rootDir, env, config, clientEntryFiles, serverEntryFiles, serverAssets, !!options.partial);
    buildOptions.unstable_phase = 'buildClientBundle';
    const { clientAssets } = await buildClientBundle(rootDir, env, config, clientEntryFiles, serverEntryFiles, serverAssets, !!options.partial);
    delete buildOptions.unstable_phase;
    const distEntries = await import(filePathToFileURL(distEntriesFile));
    INTERNAL_setAllEnv(env);
    const cssAssets = clientAssets.filter((fileName)=>fileName.endsWith('.css'));
    buildOptions.unstable_phase = 'emitStaticFiles';
    await emitStaticFiles(rootDir, config, distEntriesFile, distEntries, cssAssets);
    buildOptions.unstable_phase = 'buildDeploy';
    await buildDeploy(rootDir, config);
    delete buildOptions.unstable_phase;
    if (existsSync(distEntriesFile)) {
        await emitPlatformData(joinPath(rootDir, config.distDir));
    }
}

//# sourceMappingURL=build.js.map