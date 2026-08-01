import * as esbuild from 'esbuild';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outfile = join(root, 'dist/embed.js');

const watch = process.argv.includes('--watch');

mkdirSync(dirname(outfile), { recursive: true });

const ctx = await esbuild.context({
  entryPoints: [join(root, 'embed/embed.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'AICWEmbed',
  outfile,
  target: 'es2020',
});

if (watch) {
  await ctx.watch();
  console.log('Watching embed.js...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Built', outfile);
}
