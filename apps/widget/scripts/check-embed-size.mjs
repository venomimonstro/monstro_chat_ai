import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const embedPath = join(distDir, 'embed.js');
const iframeAssetsDir = join(distDir, 'iframe', 'assets');

const MAX_EMBED_GZIP = 8 * 1024;
const MAX_IFRAME_INITIAL_GZIP = 120 * 1024;

function gzipSize(filePath) {
  const content = readFileSync(filePath);
  return gzipSync(content).length;
}

let failed = false;

try {
  const embedGzip = gzipSize(embedPath);
  console.log(`embed.js gzip: ${embedGzip} bytes (limit: ${MAX_EMBED_GZIP})`);
  if (embedGzip > MAX_EMBED_GZIP) {
    console.error(`FAIL: embed.js exceeds ${MAX_EMBED_GZIP} bytes gzip`);
    failed = true;
  } else {
    console.log('OK: embed.js size check passed');
  }
} catch {
  console.error('embed.js not found. Run: npm run build -w @ai-consultant/widget');
  process.exit(1);
}

try {
  const files = readdirSync(iframeAssetsDir).filter((f) => f.endsWith('.js'));
  const initialJs = files
    .filter((f) => !f.includes('socket') && !f.includes('vendor'))
    .map((f) => join(iframeAssetsDir, f));

  if (!initialJs.length) {
    console.warn('WARN: no initial iframe JS chunk found');
  } else {
    let totalInitial = 0;
    for (const file of initialJs) {
      const size = gzipSize(file);
      totalInitial += size;
      console.log(`iframe ${file.split(/[/\\]/).pop()} gzip: ${size} bytes`);
    }
    console.log(
      `iframe initial JS total gzip: ${totalInitial} bytes (limit: ${MAX_IFRAME_INITIAL_GZIP})`,
    );
    if (totalInitial > MAX_IFRAME_INITIAL_GZIP) {
      console.error(
        `FAIL: iframe initial bundle exceeds ${MAX_IFRAME_INITIAL_GZIP} bytes gzip`,
      );
      failed = true;
    } else {
      console.log('OK: iframe initial bundle size check passed');
    }
  }

  const socketChunk = files.find((f) => f.includes('socket'));
  if (socketChunk) {
    const socketPath = join(iframeAssetsDir, socketChunk);
    console.log(
      `iframe socket chunk gzip: ${gzipSize(socketPath)} bytes (lazy-loaded)`,
    );
  }
} catch {
  console.error('iframe assets not found. Run: npm run build:iframe -w @ai-consultant/widget');
  failed = true;
}

if (failed) process.exit(1);
