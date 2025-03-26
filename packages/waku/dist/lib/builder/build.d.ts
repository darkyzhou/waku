import type { Config } from '../../config.js';
export declare function build(options: {
    config: Config;
    env?: Record<string, string>;
    partial?: boolean;
    deploy?: 'vercel-static' | 'vercel-serverless' | 'netlify-static' | 'netlify-functions' | 'cloudflare' | 'partykit' | 'deno' | 'aws-lambda' | 'txiki' | undefined;
}): Promise<void>;
