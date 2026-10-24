import { cpSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function syncPagesBuild(buildDirectory, pagesWorktree) {
  const source = resolve(buildDirectory);
  const target = resolve(pagesWorktree);
  if (source === target || !existsSync(join(source, 'index.html')) || !existsSync(join(source, 'article-bodies.json')) || !existsSync(join(target, '.git'))) {
    throw new Error('Pass a complete Pages build and an existing gh-pages worktree.');
  }
  for (const name of readdirSync(source)) {
    cpSync(join(source, name), join(target, name), { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/sync-pages.mjs dist /path/to/gh-pages-worktree');
  syncPagesBuild(process.argv[2], process.argv[3]);
}
