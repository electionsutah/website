import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleMedia, imageFolders } from './media.mjs';
const root = await mkdtemp(join(tmpdir(), 'elut-folder-picker-'));
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.value = ''; this.textContent = ''; this.listeners = {}; }
  setAttribute(key, value) { this.attrs[key] = value; if (key === 'value') this.value = value; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, action) { this.listeners[name] = action; }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.close?.(); }
  focus() {}
  click() { this.onclick?.(); }
  get selectedOptions() { return this.children.filter(child => child.value === this.value); }
}
const body = new Node('body'); let library, inserted;
const response = value => ({ ok: true, json: async () => value });
try {
  await mkdir(join(root, 'public/images/people'), { recursive: true });
  await mkdir(join(root, 'public/images/places/cache'), { recursive: true });
  await vm.runInNewContext(await readFile(new URL('./media-library.js', import.meta.url), 'utf8'), {
    window: { CMS: { registerMediaLibrary(value) { library = value; } } },
    document: { body, createElement: tag => new Node(tag), activeElement: new Node('button') },
    FileReader: class { readAsDataURL(file) { this.result = `data:image/png;base64,${file.content}`; this.onload(); } },
    fetch: async (url, options) => {
      if (url === '/media-folders.json') return response(await imageFolders(root));
      const { action, params } = JSON.parse(options.body);
      return response(await handleMedia(root, action, params));
    }, navigator: { clipboard: { writeText: async () => {} } }
  });
  const api = await library.init({ handleInsert: value => { inserted = value; } });
  await api.show({ id: 'portrait' });
  const dialog = body.children[0], controls = dialog.children[1];
  const folders = controls.children[0].children[0], fileInput = controls.children[2];
  assert(folders.children.some(option => option.value === 'public/images/places/cache'));
  assert.equal(folders.value, 'public/images/uploads');
  folders.value = 'public/images/people'; await folders.onchange();
  fileInput.files = [{ name: 'portrait.png', size: 4, content: 'YWJjZA==' }];
  await fileInput.onchange();
  assert.equal((await handleMedia(root, 'listImages', { mediaFolder: 'public/images/people' }))[0].url, '/images/people/portrait.png');
  assert.equal((await handleMedia(root, 'listImages', { mediaFolder: 'public/images/uploads' })).length, 0);
  dialog.children.at(-1).children[0].onclick();
  assert.equal(inserted, '/images/people/portrait.png'); assert.equal(dialog.open, false);
  await api.show({ id: 'portrait', value: '/images/places/cache/test.png' });
  assert.equal(folders.value, 'public/images/places/cache', 'Existing image selects its folder');
  api.hide(); assert.equal(dialog.open, false);
  await assert.rejects(handleMedia(root, 'persistMedia', { asset: { path: 'public/images/people/../outside.png', content: 'YWJjZA==', encoding: 'base64' } }));
  console.log('PASS: folder discovery, chosen-destination upload, existing-image folder, selected public URL, and picker close');
} finally { await rm(root, { recursive: true, force: true }); }
