import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = join(root, 'data/collection-2026-10-14-working.json');
const main = JSON.parse(readFileSync(path, 'utf8'));
for (const [first, last, name] of [[140, 156, 'part2'], [157, 173, 'part3']]) {
  const part = JSON.parse(readFileSync(join(root, `data/collection-2026-10-14-${name}-working.json`), 'utf8'));
  for (let number = first; number <= last; number++) {
    const id = `source-${number}`;
    if (!part.sources[id]) continue; // Some source numbers are absent from the supplied list.
    if (part.sources[id].status !== 'complete') throw new Error(`${id} is still ${part.sources[id].status}`);
    main.sources[id] = part.sources[id];
  }
}
writeFileSync(path, `${JSON.stringify(main, null, 2)}\n`);
console.log(`${Object.values(main.sources).filter(source => source.status === 'complete').length} sources complete`);
