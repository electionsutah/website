/* Decap's documented browser globals keep this local editor independent of the site's framework. */
(async function () {
  const { CMS, createClass, h } = window;
  // Keep the companion screen accessible in Decap's header across route changes.
  const addSchemaLink = () => {
    const menu = document.querySelector('header nav ul');
    if (!menu || menu.querySelector('[data-schema-link]')) return;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = '/schema'; link.dataset.schemaLink = '';
    const icon = document.createElement('span'); icon.className = 'editor-symbol'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = 'schema';
    link.append(icon, document.createTextNode('Schema'));
    item.append(link); menu.append(item);
  };
  new MutationObserver(addSchemaLink).observe(document.body, { childList: true, subtree: true });
  const updateCollection = () => {
    const match = window.location.hash.match(/^#\/collections\/(people|filings|places|offices|parties)(?:\/|$)/);
    if (match) document.body.dataset.collection = match[1];
    else delete document.body.dataset.collection;
  };
  updateCollection();
  window.addEventListener('hashchange', updateCollection);
  const [config, schema, initialStatus, references] = await Promise.all(['/config.json', '/schema.json', '/status.json', '/references.json'].map(url => fetch(url).then(response => response.json())));
  const asObject = value => value?.toJS ? value.toJS() : value;
  const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const symbols = { people: 'account_circle', filings: 'archive', places: 'location_on', offices: 'workspace_premium', parties: 'flag', office: 'workspace_premium', place: 'location_on', election: 'ballot',
    biography: 'account_circle', priorities: 'view_list', resources: 'language', sourceUrl: 'language', lastVerified: 'search',
    status: 'check_circle', sourceStatus: 'check_circle', electionType: 'ballot', city: 'location_on', county: 'location_on', state: 'location_on', source: 'archive', lastUpdated: 'history',
    'contact.website': 'language', 'contact.phone': 'call', 'contact.email': 'send', 'contact.address': 'location_on' };
  const social = { 'contact.facebook': 'facebook', 'contact.instagram': 'instagram', 'contact.twitter': 'x', 'contact.bluesky': 'bluesky' };
  for (const platform of ['facebook', 'instagram', 'x', 'bluesky', 'youtube', 'linkedin', 'threads', 'tiktok', 'mastodon', 'truthsocial', 'rumble', 'substack']) social[platform] = platform;
  for (const platform of Object.keys(social).filter(key => !key.includes('.'))) social[`contact.${platform}`] = social[platform];
  symbols.website = 'language'; symbols.wikipedia = 'language'; symbols.wikidata = 'language'; symbols.links = 'language';
  Object.assign(symbols, { personId: 'account_circle', runningMateId: 'account_circle', officeId: 'workspace_premium', partyId: 'flag', placeId: 'location_on', placeIds: 'location_on', parentId: 'location_on', year: 'ballot' });
  const icon = key => social[key]
    ? h('img', { className: 'editor-label-icon', src: `/icons/external/${social[key]}.svg`, alt: '', 'aria-hidden': true })
    : h('span', { className: 'editor-symbol', 'aria-hidden': true }, symbols[key] ?? 'language');
  const addresses = value => Array.isArray(value) ? value : (value ?? '').split('\n').filter(line => line.trim()).map(line => {
    const match = line.match(/^(Campaign office|Mailing):\s*(.+)$/i);
    return { label: match?.[1] ?? 'Address', value: match?.[2] ?? line };
  });
  const blank = field => field.type === 'number' ? null : field.type === 'boolean' ? false : ['lines', 'resources', 'addresses', 'links'].includes(field.type) ? [] : '';
  const format = (value, field) => ['resources', 'links'].includes(field.type) ? JSON.stringify(value ?? [], null, 2)
    : field.type === 'addresses' ? addresses(value).map(item => `${item.label}: ${item.value}`).join('\n')
    : field.type === 'lines' ? (value ?? []).join('\n') : String(value ?? '');

  const Control = createClass({
    getInitialState() { return { drafts: {}, errors: {}, modes: {} }; },
    componentDidUpdate(previous) {
      const oldContext = asObject(previous.value)?.context;
      const newContext = asObject(this.props.value)?.context;
      if ((oldContext?.personPath ?? oldContext?.identity) !== (newContext?.personPath ?? newContext?.identity)) this.setState({ drafts: {}, errors: {}, modes: {} });
    },
    isValid() { return Object.keys(this.state.errors).length ? { error: 'Correct the highlighted fields before saving.' } : true; },
    change(path, value) {
      const record = asObject(this.props.value);
      const overrides = { ...record.overrides };
      if (value === undefined) delete overrides[path]; else overrides[path] = value;
      this.props.onChange({ ...record, overrides });
    },
    render() {
      const record = asObject(this.props.value);
      if (!record) return h('p', {}, 'No source record. Restart the editor to refresh repository data.');
      const fields = schema[this.props.field.get('kind')];
      const kind = this.props.field.get('kind');
      return h('div', { className: 'repository-record' },
        h('h2', { className: 'editor-record-heading' }, icon(kind), kind === 'people' ? 'Person profile' : kind === 'places' ? 'Place contacts and social accounts' : kind === 'offices' ? 'Office contacts' : kind === 'parties' ? 'Party contacts' : 'Election filing'),
        kind === 'filings' ? h('dl', { className: 'editor-identity-grid' },
          ...[['people', 'Person', record.source.name], ['office', 'Office', record.source.officeName], ['election', 'Election', record.source.year], ['place', 'Place', [record.source.city, record.source.county, record.source.state].filter(Boolean).join(', ')]].map(([key, label, value]) =>
            h('div', { key }, h('dt', {}, icon(key), label), h('dd', {}, value || 'Not published')))) : null,
        h('p', { className: 'editor-note' }, 'Choose Override to edit a field, Clear to remove its value, or Use imported value to follow automated updates. Save with Publish at the top.'),
        (record.context.personPath || record.context.placePath || record.context.entityPath) ? h('a', { href: initialStatus.siteUrl + (record.context.personPath || record.context.placePath || record.context.entityPath), target: '_blank', rel: 'noopener' }, 'Open on the local site ↗') : null,
        h('details', { className: 'editor-context' }, h('summary', {}, 'All entity fields, imported values, and relationships'), h('pre', {}, JSON.stringify({ ...record.context, importedFields: record.source }, null, 2))),
        ...fields.map(field => {
          const path = field.path;
          const source = get(record.source, path) ?? blank(field);
          const explicit = Object.prototype.hasOwnProperty.call(record.overrides, path);
          const value = explicit ? record.overrides[path] : source;
          const empty = Array.isArray(value) ? value.length === 0 : value === '' || value === null;
          const mode = this.state.modes[path] ?? (!explicit ? 'inherit' : empty ? 'clear' : 'override');
          const id = `${this.props.forID}-${path}`;
          const resetDraft = () => {
            const drafts = { ...this.state.drafts }, errors = { ...this.state.errors };
            delete drafts[path]; delete errors[path]; this.setState({ drafts, errors });
          };
          const inputProps = {
            id, value: this.state.drafts[path] ?? format(value, field), disabled: mode !== 'override',
            'aria-invalid': !!this.state.errors[path], 'aria-describedby': `${id}-source`,
            onChange: event => {
              const text = event.target.value;
              try {
                const next = field.type === 'boolean' ? text === 'true' : field.type === 'number' ? (text === '' ? null : Number(text)) : ['resources', 'links'].includes(field.type) ? JSON.parse(text || '[]')
                  : field.type === 'lines' ? text.split('\n').map(line => line.trim()).filter(Boolean) : text;
                if (field.type === 'resources' && (!Array.isArray(next) || next.some(item => !item || !['label', 'description', 'url'].every(key => typeof item[key] === 'string')))) throw new Error('Enter a JSON array of objects with label, description, and url.');
                if (field.type === 'links' && (!Array.isArray(next) || next.some(item => !item || typeof item.url !== 'string'))) throw new Error('Enter a JSON array of link objects with a url.');
                const errors = { ...this.state.errors }; delete errors[path];
                this.setState({ drafts: { ...this.state.drafts, [path]: text }, errors });
                this.change(path, next);
              } catch (error) {
                this.setState({ drafts: { ...this.state.drafts, [path]: text }, errors: { ...this.state.errors, [path]: error.message } });
              }
            }
          };
          const input = field.relation && field.type !== 'lines' ? h('div', {},
            h('input', { ...inputProps, list: `${id}-choices`, placeholder: 'Search by name or ID' }),
            h('datalist', { id: `${id}-choices` }, ...(references[field.relation] ?? []).map(row => h('option', { key: row.id, value: row.id }, row.label))),
            h('small', {}, 'Select an existing entity. Stable IDs preserve links when names change.'))
            : field.type === 'addresses' ? h('div', { id, className: 'editor-addresses' },
            ...addresses(value).map((address, index, list) => h('fieldset', { key: index, disabled: mode !== 'override' },
              h('legend', {}, `Address ${index + 1}`),
              ...['label', 'value'].map(key => h('label', { key }, key === 'label' ? 'Label' : 'Street or mailing address',
                h('input', { value: address[key], onChange: event => this.change(path, list.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item)) }))),
              h('button', { type: 'button', onClick: () => this.change(path, list.filter((_, i) => i !== index)) }, 'Remove address'))),
            h('button', { type: 'button', disabled: mode !== 'override', onClick: () => this.change(path, [...addresses(value), { label: 'Address', value: '' }]) }, 'Add address'))
            : field.type === 'boolean' ? h('select', inputProps, h('option', { value: 'true' }, 'Yes'), h('option', { value: 'false' }, 'No'))
            : field.options ? h('select', inputProps,
            ...[...new Set(['', ...field.options, value])].map(option => h('option', { key: option, value: option }, option || '(empty)')))
            : ['text', 'lines', 'resources', 'links'].includes(field.type) ? h('textarea', { ...inputProps, rows: ['resources', 'links'].includes(field.type) ? 7 : 4 })
            : h('input', { ...inputProps, type: field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text' });
          return h('section', { key: path, className: `editor-field ${explicit ? 'has-override' : ''}` },
            h('div', { className: 'editor-field-heading' }, h('label', { htmlFor: id }, icon(path === 'name' ? kind : path), field.label),
              h('select', { 'aria-label': `${field.label} value source`, value: mode,
                onChange: event => {
                  resetDraft();
                  this.setState({ modes: { ...this.state.modes, [path]: event.target.value } });
                  this.change(path, event.target.value === 'inherit' ? undefined : event.target.value === 'clear' ? blank(field) : (empty ? source : value));
                }
              }, h('option', { value: 'inherit' }, 'Use imported value'), h('option', { value: 'override' }, 'Override'), !['name', 'personId', 'officeId', 'partyId', 'parentId', 'year'].includes(path) ? h('option', { value: 'clear' }, 'Clear') : null)),
            input,
            h('details', { id: `${id}-source`, className: 'editor-source' }, h('summary', {}, 'Imported value'), h('pre', {}, format(source, field) || '(not published)')),
            this.state.errors[path] ? h('p', { className: 'editor-error', role: 'alert' }, this.state.errors[path]) : null
          );
        })
      );
    }
  });
  CMS.registerWidget('repository-record', Control);
  CMS.registerEventListener({ name: 'preSave', handler: async ({ entry }) => {
    const record = entry.get('data').toJS();
    const displayName = record.record.overrides.name ?? record.record.source.name;
    if (typeof displayName === 'string') record.title = displayName;
    const relative = entry.get('path');
    const response = await fetch('/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relative, record })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to validate this edit.');
    return typeof displayName === 'string' ? entry.get('data').set('title', displayName) : entry.get('data');
  } });
  CMS.registerLocale('editor-en', {
    editor: { editorToolbar: { backCollection: 'Editing in %{collectionLabel} collection' } }
  });
  CMS.init({ config: { ...config, locale: 'editor-en', load_config_file: false } });

  async function updateStatus() {
    const connection = document.getElementById('connection');
    try {
      const status = await fetch('/status.json').then(response => response.json());
      connection.replaceChildren();
      connection.className = status.error ? 'connection-error' : '';
      const message = status.error ? `Save failed: ${status.error}` : status.lastSaved
        ? `Saved to repository · ${status.record} · ${new Date(status.lastSaved).toLocaleTimeString()}`
        : `Local repository · ${status.counts.people.toLocaleString()} people · ${status.counts.filings.toLocaleString()} filings · ${status.counts.places.toLocaleString()} places`;
      connection.append(document.createTextNode(message));
      const link = document.createElement('a');
      link.href = status.siteUrl; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open local site ↗';
      connection.append(link);
    } catch { connection.textContent = 'Editor disconnected. Restart with npm run editor.'; connection.className = 'connection-error'; }
  }
  await updateStatus();
  setInterval(updateStatus, 2000);
})().catch(error => { document.getElementById('connection').textContent = `Editor failed to start: ${error.message}`; });
