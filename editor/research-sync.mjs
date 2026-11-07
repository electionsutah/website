import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const researchFiles = [
  'src/data/researched-candidates.json', 'src/data/place-election-notes.json',
  'src/data/newspaper-candidates.json', 'src/data/municipal-results.json',
  'public/data/municipal-results.json', 'src/data/place-enrichment.json'
];
const arrayInputs = new Set(researchFiles.filter(path => !path.endsWith('place-election-notes.json') && !path.endsWith('place-enrichment.json')));
const hash = text => createHash('sha256').update(text).digest('hex');

/** Follow only the declared research inputs in the default-branch worktree. */
export function researchSource(root) {
  if (process.env.EDITOR_RESEARCH_SOURCE) return resolve(process.env.EDITOR_RESEARCH_SOURCE);
  try {
    const branch = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], { cwd: root, encoding: 'utf8' }).trim().replace(/^refs\/remotes\/origin\//, '');
    const worktrees = execFileSync('git', ['worktree', 'list', '--porcelain', '-z'], { cwd: root, encoding: 'utf8' }).split('\0\0');
    const match = worktrees.find(entry => entry.split('\0').includes(`branch refs/heads/${branch}`));
    const source = match?.split('\0').find(line => line.startsWith('worktree '))?.slice(9);
    return source && resolve(source) !== resolve(root) ? source : null;
  } catch { return null; }
}
async function atomic(path, text) {
  await writeFile(`${path}.tmp`, text); await rename(`${path}.tmp`, path);
}
export async function createResearchSync(root, source, baselinePath) {
  let baseline = await readFile(baselinePath, 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (baseline?.source !== resolve(source)) baseline = null;
  return async function sync() {
    const files = await Promise.all(researchFiles.map(async path => {
      const [local, incoming] = await Promise.all([readFile(join(root, path), 'utf8'), readFile(join(source, path), 'utf8')]);
      const value = JSON.parse(incoming);
      if (arrayInputs.has(path) ? !Array.isArray(value) : !value || Array.isArray(value) || typeof value !== 'object') throw new Error(`Unexpected research data format: ${path}`);
      return { path, local, incoming };
    }));
    const sourceResults = files.find(file => file.path === 'src/data/municipal-results.json');
    const publicResults = files.find(file => file.path === 'public/data/municipal-results.json');
    if (JSON.stringify(JSON.parse(sourceResults.incoming)) !== JSON.stringify(JSON.parse(publicResults.incoming))) {
      throw new Error('Research sync stopped: municipal result source and public mirror differ; waiting for import to finish.');
    }
    // Check every input before writing any. Never overwrite independent local work.
    for (const file of files) {
      if (file.local !== file.incoming && (!baseline || hash(file.local) !== baseline.hashes[file.path])) {
        throw new Error(`Research sync stopped: ${file.path} has local edits or needs an initial reviewed synchronization.`);
      }
    }
    const changed = files.filter(file => file.local !== file.incoming);
    for (const file of changed) { await mkdir(resolve(root, file.path, '..'), { recursive: true }); await atomic(join(root, file.path), file.incoming); }
    const nextBaseline = { source: resolve(source), hashes: Object.fromEntries(files.map(file => [file.path, hash(file.incoming)])) };
    if (JSON.stringify(baseline) !== JSON.stringify(nextBaseline)) {
      await mkdir(resolve(baselinePath, '..'), { recursive: true });
      await atomic(baselinePath, JSON.stringify(nextBaseline));
      baseline = nextBaseline;
    }
    return changed.map(file => file.path);
  };
}
