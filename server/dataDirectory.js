import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const bundledDirectory = fileURLToPath(new URL('../data/', import.meta.url));

export function collectionDataDirectory() {
  return process.env.DNU_DATA_DIR ? resolve(process.env.DNU_DATA_DIR) : bundledDirectory;
}

export function collectionDataPath(name) {
  return join(collectionDataDirectory(), name);
}

export function ensureCollectionData(directory = collectionDataDirectory()) {
  mkdirSync(directory, { recursive: true });
  const completed = join(directory, 'prepared-update.json');
  if (!existsSync(completed) && directory !== bundledDirectory)
    copyFileSync(join(bundledDirectory, 'prepared-update.json'), completed);
  return directory;
}
