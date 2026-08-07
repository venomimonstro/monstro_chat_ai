#!/usr/bin/env node
/**
 * Resolve tsc without relying on .bin symlinks (often broken on VPS deploys).
 * Prefer typescript/lib/tsc.js; fall back to bin/tsc.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const candidates = [
  path.join(root, 'node_modules/typescript/lib/tsc.js'),
  path.join(__dirname, 'node_modules/typescript/lib/tsc.js'),
  path.join(root, 'node_modules/typescript/bin/tsc'),
  path.join(__dirname, 'node_modules/typescript/bin/tsc'),
];

let tsc = null;
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    tsc = candidate;
    break;
  }
}

if (!tsc) {
  console.error(
    [
      'ERROR: typescript/tsc не найден в node_modules.',
      'Восстановите зависимости на сервере:',
      '  sudo bash scripts/fix-npm-install.sh',
      '  sudo bash scripts/fast-update.sh --full --no-pull',
    ].join('\n'),
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsc, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
