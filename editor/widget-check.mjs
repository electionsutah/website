import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the browser widget without a DOM or repository writes.
let widget;
let preSave;
const fields = [
  { path: 'photo.src', label: 'Portrait', type: 'image' },
  { path: 'photo.artist', label: 'Portrait creator' },
  { path: 'lastVerified', label: 'Profile verification date', type: 'date' },
  { path: 'resources', label: 'Resources', type: 'resources' },
  { path: 'links', label: 'Websites and social accounts', type: 'links' }
];
const node = () => ({ append() {}, replaceChildren() {}, setAttribute() {} });
const CMS = { registerWidget(name, control) { widget = control; }, registerEventListener(event) { if (event.name === 'preSave') preSave = event.handler; }, registerLocale() {}, init() {} };
await vm.runInNewContext(await readFile(new URL('./app.js', import.meta.url), 'utf8'), {
  URL, window: { CMS, createClass: spec => spec, h: (tag, props, ...children) => ({ tag, props: props ?? {}, children: children.flat(Infinity) }), location: { hash: '#/collections/people' }, addEventListener() {} },
  document: { body: { dataset: {} }, querySelector() { return null; }, getElementById: node, createElement: node, createTextNode: text => text },
  MutationObserver: class { observe() {} }, setInterval() {},
  fetch: async url => ({ ok: true, json: async () => url === '/config.json' ? { collections: [] } : url === '/schema.json' ? { people: fields, filings: fields, offices: fields } : url === '/status.json' ? { counts: { people: 1, filings: 1, places: 1 }, siteUrl: 'http://localhost' } : {} })
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
const inheritedLinks = { ...instance, props: { ...instance.props, value: { ...instance.props.value, overrides: {} } } };
assert.equal(find(inheritedLinks.render(), n => n.tag === 'button' && n.children.includes('Add link'))[0].props.disabled, true, 'Add link is disabled until Override is selected');
assert.equal(button('links', 'Add link').props.disabled, false, 'Add link is enabled for overridden links');
assert.equal(all(n => n.tag === 'textarea').length, 2); // Resource and link descriptions, not JSON.
input('record-links-0-label').props.onChange({ target: { value: 'Official site' } });
assert.equal(instance.props.value.overrides.links[0].source, 'Published source');
assert.equal(instance.props.value.overrides.links[0].extraMetadata, 'preserved');
assert.equal(instance.props.value.overrides.links[0].verifiedOn, '2026-11-06');
assert.equal(input('record-links-0-verifiedOn').props.type, 'date', 'Link verification dates use the calendar selector');
input('record-links-0-verifiedOn').props.onChange({ target: { value: '2026-03-12' } });
assert.equal(instance.props.value.overrides.links[0].verifiedOn, '2026-03-12');
find(field('links'), n => n.props['aria-label'] === 'Set link 1 verification date to today')[0].props.onClick();
const verificationToday = new Date();
assert.equal(instance.props.value.overrides.links[0].verifiedOn, `${verificationToday.getFullYear()}-${String(verificationToday.getMonth() + 1).padStart(2, '0')}-${String(verificationToday.getDate()).padStart(2, '0')}`);
input('record-links-0-verifiedOn').props.onChange({ target: { value: '' } });
assert(!('verifiedOn' in instance.props.value.overrides.links[0]), 'Clearing a verification date removes the optional value');
assert.equal(instance.props.value.overrides.links[0].extraMetadata, 'preserved');
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
assert.equal(button('lastVerified', 'Today').props.disabled, true, 'Today respects imported-value mode');
const dateMode = find(field('lastVerified'), n => n.tag === 'select')[0];
dateMode.props.onChange({ target: { value: 'override' } });
assert.equal(button('lastVerified', 'Today').props.disabled, false);
input('record-lastVerified').props.onChange({ target: { value: '2000-01-01' } });
button('lastVerified', 'Today').props.onClick();
const selectedToday = new Date();
const selectedLocalDate = `${selectedToday.getFullYear()}-${String(selectedToday.getMonth() + 1).padStart(2, '0')}-${String(selectedToday.getDate()).padStart(2, '0')}`;
assert.equal(instance.props.value.overrides.lastVerified, selectedLocalDate);
assert.equal(input('record-lastVerified').props.value, selectedLocalDate, 'Today replaces the displayed draft and saved override together');
const immutable = value => ({
  toJS: () => structuredClone(value),
  set: (key, next) => immutable({ ...value, [key]: next }),
  setIn: ([parent, key], next) => immutable({ ...value, [parent]: { ...value[parent], [key]: next } })
});
const save = async (path, overrides) => (await preSave({ entry: { get: key => key === 'path' ? path : immutable({ title: '2018 · Original · General-election result record', record: { source: { name: 'Original' }, overrides } }) } })).toJS();
const savedFiling = await save('content/filings/test.json', { filingDate: '2026-03-12', lastUpdated: '2000-01-01' });
const today = new Date();
const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
assert.equal(savedFiling.record.overrides.lastUpdated, localDate, 'Decap saves the automatic timestamp with the edited value');
assert.equal(savedFiling.record.overrides.filingDate, '2026-03-12');
assert.equal(savedFiling.title, '2018 · Original · General-election result record', 'Saving retains the descriptive filing title');
assert.equal((await save('content/filings/test.json', { 'contact.email': '' })).record.overrides.lastUpdated, localDate, 'Explicit clears count as overrides');
assert.deepEqual((await save('content/filings/test.json', {})).record.overrides, {}, 'No automatic override when following imported values');
assert.equal((await save('content/people/test.json', { name: 'Updated' })).record.overrides.lastUpdated, undefined, 'Filing timestamps are not added to other collections');
console.log('PASS: canonical link group, structured rows, URL validation/recovery, draft retention, deletion, and metadata preservation');

const filingInstance = { ...instance, state: widget.getInitialState(), props: { ...instance.props,
  field: { get: () => 'filings' }, value: { source: { name: 'Ben McAdams', year: 2018, officeName: 'U.S. House District 4' }, overrides: {}, context: {
    identity: 'general', recordType: 'General-election result record', connectedPeople: [{ id: 'ben-mcadams', name: 'Ben McAdams', role: 'Candidate', editorUrl: '#/collections/people/entries/ben' }], relatedRecords: [
      { recordId: 'general', label: 'General-election result record', source: 'https://example.org/canvass.xlsx', editorUrl: '#/collections/filings/entries/general' },
      { recordId: 'declaration', label: 'Declaration of candidacy', source: 'https://example.org/declaration.pdf', editorUrl: '#/collections/filings/entries/declaration' }
    ]
  } }
} };
const filingTree = filingInstance.render();
const headingToolbar = find(filingTree, n => n.props.className === 'editor-record-toolbar')[0];
assert.equal(find(headingToolbar, n => n.props.role === 'search').length, 0, 'Heading uses its own full-width row');
const searchPosition = filingTree.children.findIndex(n => n?.props?.role === 'search');
const identityPosition = filingTree.children.findIndex(n => n?.props?.className === 'editor-identity-grid');
assert(searchPosition > 0 && searchPosition < identityPosition, 'Field filters appear above the entity details grid');
assert(find(filingTree, n => n.tag === 'a' && n.props.href === '#/collections/people/entries/ben' && n.children.includes('Ben McAdams')).length);
const personInstance = { ...instance, props: { ...instance.props, value: { ...instance.props.value, context: { connectedFilings: [{ recordId: 'general', label: '2018 · U.S. House District 4 · General-election result record', editorUrl: '#/collections/filings/entries/general' }] } } } };
assert(find(personInstance.render(), n => n.tag === 'a' && n.props.href === '#/collections/filings/entries/general').length);
assert(find(filingTree, n => n.tag === 'h1' && n.children.includes('2018 · Ben McAdams · U.S. House District 4 · General-election result record')).length);
assert(find(filingTree, n => n.tag === 'p' && n.props.className === 'editor-record-subtitle' && n.children.includes('General-election result record')).length);
const namedPerson = { ...personInstance, props: { ...personInstance.props, value: { ...personInstance.props.value, source: { name: 'Ben McAdams' } } } };
assert(find(namedPerson.render(), n => n.tag === 'h1' && n.children.includes('Ben McAdams')).length);
assert(find(namedPerson.render(), n => n.tag === 'p' && n.props.className === 'editor-record-subtitle' && n.children.includes('Person profile')).length);
namedPerson.props.value.overrides.name = 'Updated name';
assert(find(namedPerson.render(), n => n.tag === 'h1' && n.children.includes('Updated name')).length);
const namedOffice = { ...namedPerson, props: { ...namedPerson.props, field: { get: () => 'offices' }, value: { source: { name: 'Alpine City Council' }, overrides: {}, context: {} } } };
assert(find(namedOffice.render(), n => n.tag === 'h1' && n.children.includes('Alpine City Council')).length);
assert(find(filingTree, n => n.tag === 'a' && n.props.href === '#/collections/filings/entries/declaration' && n.children.includes('Declaration of candidacy')).length);
assert(find(filingTree, n => n.tag === 'a' && n.props.href === 'https://example.org/declaration.pdf').length);
assert(find(filingTree, n => n.tag === 'strong' && n.children.includes('General-election result record (current record)')).length);
console.log('PASS: filing headings, related declaration navigation, current-record marker, and source links');
