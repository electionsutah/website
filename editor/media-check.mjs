import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleMedia, persistUpload, publicImage, mediaFolder } from './media.mjs';
const root = await mkdtemp(join(tmpdir(), 'elut-media-check-'));
const content = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/gAAAABJRU5ErkJggg==';
const asset = { path: `${mediaFolder}/portrait.png`, content, encoding: 'base64' };
try {
  await mkdir(join(root, 'src/data'), { recursive: true });
  await writeFile(join(root, 'src/data/editor-overrides.json'), '{}');
  const saved = await persistUpload(root, asset);
  assert.equal(saved.path, asset.path); assert.equal(saved.content, content);
  assert.equal((await handleMedia(root, 'getMedia', { mediaFolder })).length, 1);
  assert.equal((await handleMedia(root, 'getMediaFile', { path: asset.path })).id, saved.id);
  assert.equal((await publicImage(root, '/images/uploads/portrait.png')).type, 'image/png');
  assert.equal((await persistUpload(root, asset)).id, saved.id, 'Identical upload is idempotent');
  await assert.rejects(persistUpload(root, { ...asset, content: 'YWJj' }), /already exists/);
  for (const path of ['src/data/editor-overrides.json', `${mediaFolder}/../logo.png`, `${mediaFolder}/code.js`]) await assert.rejects(persistUpload(root, { ...asset, path }));
  await writeFile(join(root, 'src/data/editor-overrides.json'), JSON.stringify({ people: { example: { 'photo.src': '/images/uploads/portrait.png' } } }));
  await assert.rejects(handleMedia(root, 'deleteFiles', { paths: [asset.path] }), /assigned/);
  await writeFile(join(root, 'src/data/editor-overrides.json'), '{}');
  await handleMedia(root, 'deleteFiles', { paths: [asset.path] });
  assert.equal((await handleMedia(root, 'getMedia', { mediaFolder })).length, 0);
  await symlink('/etc/passwd', join(root, mediaFolder, 'outside.png'));
  await assert.rejects(handleMedia(root, 'getMediaFile', { path: `${mediaFolder}/outside.png` }), /regular file/);
  await assert.rejects(publicImage(root, '/images/uploads/outside.png'), /Invalid image path/);
  console.log('PASS: upload/list/preview, collision protection, assigned-image protection, deletion, and path isolation');
} finally { await rm(root, { recursive: true, force: true }); }
