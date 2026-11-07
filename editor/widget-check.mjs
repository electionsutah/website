import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the browser widget without a DOM or repository writes.
let widget;
const fields = [
  { path: 'photo.src', label: 'Portrait', type: 'image' },
  { path: 'photo.artist', label: 'Portrait creator' },
  { path: 'resources', label: 'Resources', type: 'resources' },
  { path: 'links', label: 'Websites and social accounts', type: 'links' }
];
const node = () => ({ append() {}, replaceChildren() {}, setAttribute() {} });
const CMS = { registerWidget(name, control) { widget = control; }, registerEventListener() {}, registerLocale() {}, init() {} };
await vm.runInNewContext(await readFile(new URL('./app.js', import.meta.url), 'utf8'), {
  URL, window: { CMS, createClass: spec => spec, h: (tag, props, ...children) => ({ tag, props: props ?? {}, children: children.flat(Infinity) }), location: { hash: '#/collections/people' }, addEventListener() {} },
  document: { body: { dataset: {} }, querySelector() { return null; }, getElementById: node, createElement: node, createTextNode: text => text },
  MutationObserver: class { observe() {} }, setInterval() {},
  fetch: async url => ({ json: async () => url === '/config.json' ? { collections: [] } : url === '/schema.json' ? { people: fields } : url === '/status.json' ? { counts: { people: 1, filings: 1, places: 1 }, siteUrl: 'http://localhost' } : {} })
});
let writes = 0;
const instance = { ...widget, state: widget.getInitialState(), setState(patch) { Object.assign(this.state, patch); }, props: {
  forID: 'record', field: { get() { return 'people'; } },
  value: { context: { identity: 'test' }, source: { photo: { src: '/images/people/original.webp', artist: 'Original creator' } }, overrides: {
    resources: [{ label: 'Guide', description: 'A guide', url: 'https://example.org/guide' }],
    links: [{ url: 'https://example.org', platform: 'website', source: 'Published source', verifiedOn: '2026-11-06', extraMetadata: 'preserved' }]
  } }, onChange(value) { writes++; instance.props.value = value; }
} };
const find = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : [...(predicate(tree) ? [tree] : []), ...(tree.children ?? []).flatMap(child => find(child, predicate))];
const all = predicate => find(instance.render(), predicate);
const input = id => all(n => n.props.id === id)[0];
const field = path => all(n => n.tag === 'section' && n.props.key === path)[0];
const button = (path, caption) => find(field(path), n => n.tag === 'button' && n.children.includes(caption))[0];
assert.equal(all(n => n.props.role === 'group' && n.props['aria-label'] === 'Websites and social accounts').length, 1);
assert.equal(all(n => n.tag === 'textarea').length, 2); // Resource and link descriptions, not JSON.
input('record-links-0-label').props.onChange({ target: { value: 'Official site' } });
assert.equal(instance.props.value.overrides.links[0].source, 'Published source');
assert.equal(instance.props.value.overrides.links[0].extraMetadata, 'preserved');
assert.equal(instance.props.value.overrides.links[0].verifiedOn, '2026-11-06');
button('resources', 'Add resource').props.onClick();
assert.notEqual(instance.isValid(), true);
assert.equal(instance.props.value.overrides.resources.length, 1); // Incomplete row is only a draft.
input('record-resources-1-label').props.onChange({ target: { value: 'Second guide' } });
input('record-resources-1-url').props.onChange({ target: { value: 'javascript:alert(1)' } });
assert.notEqual(instance.isValid(), true);
input('record-resources-1-url').props.onChange({ target: { value: 'https://example.org/second' } });
assert.equal(instance.isValid(), true);
assert.equal(instance.props.value.overrides.resources.length, 2);
assert.equal(instance.props.value.overrides.resources[1].label, 'Second guide');
instance.state.fieldQuery = 'contact.email';
assert.equal(instance.state.drafts.resources.length, 2);
instance.state.fieldQuery = '';
const remove = find(field('resources'), n => n.props['aria-label'] === 'Remove resource 2')[0];
remove.props.onClick();
assert.equal(instance.props.value.overrides.resources.length, 1);
button('links', 'Add link').props.onClick();
assert.notEqual(instance.isValid(), true);
find(field('links'), n => n.props['aria-label'] === 'Remove link 2')[0].props.onClick();
assert.equal(instance.isValid(), true);
assert.equal(instance.props.value.overrides.links[0].extraMetadata, 'preserved');
instance.change('photo.src', '/images/uploads/new.png');
assert.equal(instance.props.value.overrides['photo.artist'], '', 'Image replacement clears old attribution');
let selectedImage = '/images/uploads/picked.png', picker;
instance.props.onOpenMediaLibrary = options => { picker = options; };
instance.props.onRemoveInsertedMedia = () => { selectedImage = null; };
instance.props.mediaPaths = { get: id => id.endsWith('photo.src') ? selectedImage : undefined };
button('photo.src', 'Choose image').props.onClick();
assert.equal(picker.forImage, true); assert.equal(picker.allowMultiple, false);
instance.componentDidUpdate(instance.props);
assert.equal(instance.props.value.overrides['photo.src'], '/images/uploads/picked.png');
instance.change('photo.src', undefined);
assert(!('photo.src' in instance.props.value.overrides));
assert(!('photo.artist' in instance.props.value.overrides));
assert.equal(input('record-photo.src').props.value, '/images/people/original.webp');
assert.ok(writes > 0);
console.log('PASS: canonical link group, structured rows, URL validation/recovery, draft retention, deletion, and metadata preservation');
