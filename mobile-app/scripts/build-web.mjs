/**
 * Bundle the existing static website into Capacitor's webDir without altering
 * the live GitHub Pages site or rewriting any study data.
 *
 * Run from the repository: npm --prefix mobile-app run build:web
 */
import { readdir, lstat, mkdir, rm, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(mobileDir, '..');
const targetDir = path.join(mobileDir, 'www');

// Do not ship development infrastructure or server/database experiments.
// Everything else is copied by supported public-asset extension, retaining
// the original relative paths and hence the existing internal navigation.
const skipDirs = new Set([
  '.git', '.github', 'node_modules', 'mobile-app', 'verification',
  'scripts', 'cloud-sync', '.cache', '.next', 'dist'
]);
const copyExtensions = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.json', '.webmanifest',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.csv', '.txt', '.xml',
  '.md', '.webm', '.mp3', '.mp4', '.wav', '.vtt'
]);
const alwaysCopy = new Set(['LICENSE', '.nojekyll']);
const required = [
  'index.html', 'v2.5/index.html', 'study-desk/index.html',
  'lectures/index.html', 'backup/index.html', 'manifest.webmanifest'
];
let copied = 0;
let bytes = 0;

async function walk(relative = '') {
  const sourceDir = path.join(repoDir, relative);
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      await walk(next);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!copyExtensions.has(path.extname(entry.name).toLowerCase())
       && !alwaysCopy.has(entry.name)) continue;
    const from = path.join(repoDir, next);
    const to = path.join(targetDir, next);
    // Disallow non-regular files when building from untrusted worktrees.
    if (!(await lstat(from)).isFile()) continue;
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
    copied++;
    bytes += (await stat(from)).size;
  }
}

// Build only inside mobile-app/www. Never delete user/browser data.
await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await walk();
for (const file of required) {
  if (!(await stat(path.join(targetDir, file)).catch(() => null))?.isFile()) {
    throw new Error('Required website asset missing: ' + file);
  }
}
console.log(`Mobile web bundle: ${copied} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB → ${targetDir}`);
