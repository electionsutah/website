import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, lstat, unlink, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';

export const mediaFolder = 'public/images/uploads';
export const publicFolder = '/images/uploads';
const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const contentTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml' };
export const mediaActions = new Set(['listImages', 'getMedia', 'getMediaFile', 'persistMedia', 'deleteFiles']);

function imagePath(root, path, writing = false) {
  if (typeof path !== 'string' || !/^public\/images\/(?:[\w -]+\/)+[\w][\w. -]*$/.test(path)) throw new Error('Media must be inside an images subfolder');
  const extension = extname(path).toLowerCase();
  if (writing ? !extensions.has(extension) : !contentTypes[extension]) throw new Error('Choose a PNG, JPEG, WebP, GIF, or AVIF filename');
  return join(root, path);
}
async function safeUploadDirectory(root, folder = mediaFolder) {
  // Only the default folder is created automatically; other destinations must exist.
  if (folder === mediaFolder) await mkdir(join(root, folder), { recursive: true });
  imagePath(root, `${folder}/image.png`, true);
  const directory = join(root, folder);
  if (await realpath(directory) !== join(await realpath(root), folder)) throw new Error('Image folders must not use symbolic links');
  return directory;
}
export async function imageFolders(root) {
  await safeUploadDirectory(root);
  const folders = [];
  async function visit(relative) {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      if (entry.isDirectory() && /^[\w -]+$/.test(entry.name)) {
        const path = `${relative}/${entry.name}`; folders.push(path); await visit(path);
      }
    }
  }
  await visit('public/images');
  return folders.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}
async function mediaFile(root, path) {
  const file = imagePath(root, path);
  await safeUploadDirectory(root, path.slice(0, path.lastIndexOf('/')));
  if (!(await lstat(file)).isFile()) throw new Error('Media must be a regular file');
  const content = await readFile(file);
  return { path, name: path.split('/').at(-1), id: createHash('sha256').update(content).digest('hex'), content: content.toString('base64'), encoding: 'base64' };
}
export async function persistUpload(root, asset) {
  const file = imagePath(root, asset?.path, true);
  await safeUploadDirectory(root, asset.path.slice(0, asset.path.lastIndexOf('/')));
  if (asset.encoding !== 'base64' || typeof asset.content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.content)) throw new Error('Invalid image encoding');
  const content = Buffer.from(asset.content, 'base64');
  if (!content.length || content.length > 10 * 1024 * 1024) throw new Error('Images must be between 1 byte and 10 MB');
  try { await writeFile(file, content, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!(await lstat(file)).isFile() || !(await readFile(file)).equals(content)) throw new Error('That filename already exists. Choose a different filename to preserve the existing image.');
  }
  return mediaFile(root, asset.path);
}
export async function handleMedia(root, action, params) {
  await safeUploadDirectory(root);
  if (action === 'getMedia' || action === 'listImages') {
    await safeUploadDirectory(root, params.mediaFolder);
    const entries = await readdir(join(root, params.mediaFolder), { withFileTypes: true });
    const files = entries.filter(entry => entry.isFile() && contentTypes[extname(entry.name).toLowerCase()]);
    if (action === 'listImages') return files.map(entry => ({ path: `${params.mediaFolder}/${entry.name}`, name: entry.name, url: '/' + `${params.mediaFolder}/${entry.name}`.slice('public/'.length) }));
    return Promise.all(files.map(entry => mediaFile(root, `${params.mediaFolder}/${entry.name}`)));
  }
  if (action === 'getMediaFile') return mediaFile(root, params.path);
  if (action === 'persistMedia') return persistUpload(root, params.asset);
  if (action === 'deleteFiles') {
    const paths = params.paths;
    if (!Array.isArray(paths)) throw new Error('Expected a list of image paths');
    const saved = await readFile(join(root, 'src/data/editor-overrides.json'), 'utf8');
    const files = paths.map(path => {
      if (!path.startsWith(`${mediaFolder}/`)) throw new Error('Original image folders cannot be deleted through the library');
      const file = imagePath(root, path);
      if (saved.includes(JSON.stringify('/' + path.slice('public/'.length)))) throw new Error('This image is assigned to a record. Replace or clear its image field before deleting it.');
      return file;
    });
    for (const file of files) await unlink(file);
    return {};
  }
  throw new Error('Unsupported media action');
}
/** Read previews from public image folders, without exposing the rest of the repository. */
export async function publicImage(root, pathname) {
  const path = decodeURIComponent(pathname);
  if (!/^\/(?:images|party-logos)\//.test(path) || !contentTypes[extname(path).toLowerCase()]) return null;
  const publicRoot = await realpath(join(root, 'public'));
  const candidate = resolve(publicRoot, `.${path}`);
  if (!candidate.startsWith(publicRoot + '/')) throw new Error('Invalid image path');
  const actual = await realpath(candidate);
  if (!actual.startsWith(publicRoot + '/')) throw new Error('Invalid image path');
  return { content: await readFile(actual), type: contentTypes[extname(path).toLowerCase()] };
}
