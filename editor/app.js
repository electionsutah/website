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
  const fieldGroup = field => {
    if (field.relation || field.path === 'name') return 'Identity & associations';
    if (field.path.startsWith('contact.') && !social[field.path] && field.path !== 'contact.website') return 'Contact details';
    if (social[field.path] || ['website', 'wikipedia', 'wikidata', 'links', 'contact.website'].includes(field.path)) return 'Websites & social links';
    if (field.path === 'resources') return 'Resources';
    return 'Profile & metadata';
  };
  const matchesField = (field, query, group) => {
    const text = `${field.label} ${field.path}`.toLowerCase().replace(/[._-]+/g, ' ');
    return (!group || fieldGroup(field) === group) && query.toLowerCase().replace(/[._-]+/g, ' ').trim().split(/\s+/).every(term => text.includes(term));
  };

  const Control = createClass({
    getInitialState() { return { drafts: {}, errors: {}, modes: {}, collapsedGroups: {}, fieldQuery: '', fieldGroup: '' }; },
    componentDidUpdate(previous) {
      const oldContext = asObject(previous.value)?.context;
      const newContext = asObject(this.props.value)?.context;
      if ((oldContext?.personPath ?? oldContext?.identity) !== (newContext?.personPath ?? newContext?.identity)) this.setState({ drafts: {}, errors: {}, modes: {}, collapsedGroups: {}, fieldQuery: '', fieldGroup: '' });
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
      const matchingFields = fields.filter(field => matchesField(field, this.state.fieldQuery, this.state.fieldGroup));
      const filterId = `${this.props.forID}-field-filter`;
      const clearFilters = () => this.setState({ fieldQuery: '', fieldGroup: '' });
      return h('main', { className: 'repository-record', id: 'editor-main', tabIndex: -1, 'aria-label': 'Edit repository record' },
        h('div', { className: 'editor-record-toolbar' },
          h('h1', { className: 'editor-record-heading' }, icon(kind), kind === 'people' ? 'Person profile' : kind === 'places' ? 'Place contacts and social accounts' : kind === 'offices' ? 'Office contacts' : kind === 'parties' ? 'Party contacts' : 'Election filing'),
          h('div', { className: 'editor-field-filters', role: 'search', 'aria-label': 'Find fields in this record' },
            h('label', { htmlFor: filterId }, 'Find fields'),
            h('div', { className: 'editor-filter-search' }, h('span', { className: 'editor-symbol', 'aria-hidden': true }, 'search'),
              h('input', { id: filterId, type: 'search', placeholder: 'Search field names…', value: this.state.fieldQuery, onChange: event => this.setState({ fieldQuery: event.target.value, collapsedGroups: {} }), onKeyDown: event => { if (event.key === 'Escape') { event.preventDefault(); clearFilters(); } } })),
            h('select', { 'aria-label': 'Filter field section', value: this.state.fieldGroup, onChange: event => this.setState({ fieldGroup: event.target.value, collapsedGroups: {} }) },
              h('option', { value: '' }, 'All sections'), ...[...new Set(fields.map(fieldGroup))].map(group => h('option', { key: group, value: group }, group))),
            h('button', { type: 'button', disabled: !this.state.fieldQuery && !this.state.fieldGroup, onClick: clearFilters }, 'Reset'))),
        h('p', { className: 'editor-filter-count', role: 'status', 'aria-live': 'polite' }, `${matchingFields.length} of ${fields.length} fields match`),
        kind === 'filings' ? h('dl', { className: 'editor-identity-grid' },
          ...[['people', 'Person', record.source.name], ['office', 'Office', record.source.officeName], ['election', 'Election', record.source.year], ['place', 'Place', [record.source.city, record.source.county, record.source.state].filter(Boolean).join(', ')]].map(([key, label, value]) =>
            h('div', { key }, h('dt', {}, icon(key), label), h('dd', {}, value || 'Not published')))) : null,
        h('p', { className: 'editor-note' }, 'Choose Override to edit a field, Clear to remove its value, or Use imported value to follow automated updates. Save with Publish at the top.'),
        (record.context.personPath || record.context.placePath || record.context.entityPath) ? h('a', { href: initialStatus.siteUrl + (record.context.personPath || record.context.placePath || record.context.entityPath), target: '_blank', rel: 'noopener' }, 'Open on the local site ↗') : null,
        h('details', { className: 'editor-context' }, h('summary', {}, 'All entity fields, imported values, and relationships'), h('pre', {}, JSON.stringify({ ...record.context, importedFields: record.source }, null, 2))),
        ...[...new Set(fields.map(fieldGroup))].map((group, index) => {
          const groupFields = fields.filter(field => fieldGroup(field) === group);
          const matchCount = groupFields.filter(field => matchesField(field, this.state.fieldQuery, this.state.fieldGroup)).length;
          const expanded = !this.state.collapsedGroups[group];
          const groupId = `${this.props.forID}-section-${index}`;
          const errorCount = groupFields.filter(field => this.state.errors[field.path]).length;
          return h('section', { key: group, className: 'editor-field-group', hidden: matchCount === 0 },
            h('h2', { className: 'editor-group-heading' },
              h('button', { type: 'button', 'aria-expanded': expanded, 'aria-controls': groupId,
                onClick: () => this.setState({ collapsedGroups: { ...this.state.collapsedGroups, [group]: expanded } }) },
                h('span', { className: 'editor-symbol', 'aria-hidden': true }, expanded ? 'expand_more' : 'chevron_right'),
                h('span', {}, group), h('span', { className: 'editor-group-count' }, `${matchCount} ${matchCount === 1 ? 'field' : 'fields'}`),
                errorCount ? h('span', { className: 'editor-error' }, `${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`) : null)),
            h('div', { id: groupId, hidden: !expanded, className: 'editor-group-fields' }, ...groupFields.map(field => {
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
          const fieldHelp = field.type === 'url' && (social[path] || ['website', 'contact.website', 'wikipedia', 'wikidata'].includes(path))
            ? path.startsWith('contact.') ? 'Shown in the campaign contact card.' : 'Shown among directory profile links. This value takes precedence over matching directory link records.'
            : '';
          const inputProps = {
            id, value: this.state.drafts[path] ?? format(value, field), disabled: mode !== 'override',
            'aria-invalid': !!this.state.errors[path], 'aria-describedby': `${id}-source${fieldHelp ? ` ${id}-field-help` : ''}${this.state.errors[path] ? ` ${id}-error` : ''}`,
            onChange: event => {
              const text = event.target.value;
              try {
                const next = field.type === 'boolean' ? text === 'true' : field.type === 'number' ? (text === '' ? null : Number(text))
                  : field.type === 'lines' ? text.split('\n').map(line => line.trim()).filter(Boolean) : text;
                const errors = { ...this.state.errors }; delete errors[path];
                this.setState({ drafts: { ...this.state.drafts, [path]: text }, errors });
                this.change(path, next);
              } catch (error) {
                this.setState({ drafts: { ...this.state.drafts, [path]: text }, errors: { ...this.state.errors, [path]: error.message } });
              }
            }
          };
          const isList = ['resources', 'links'].includes(field.type);
          const rows = isList ? (this.state.drafts[path] ?? value ?? []) : [];
          const updateRows = next => {
            const errors = { ...this.state.errors };
            const invalid = next.findIndex(row => {
              try { const url = new URL(row.url); return !['http:', 'https:'].includes(url.protocol) || !!url.username || !!url.password; }
              catch { return true; }
            });
            if (invalid >= 0) errors[path] = `Row ${invalid + 1}: enter a complete http:// or https:// URL without a username or password, or remove the row.`;
            else delete errors[path];
            this.setState({ drafts: { ...this.state.drafts, [path]: next }, errors });
            if (invalid < 0) this.change(path, next);
          };
          const rowFields = field.type === 'resources'
            ? [['label', 'Label'], ['description', 'Description'], ['url', 'URL']]
            : [['url', 'URL'], ['label', 'Label'], ['platform', 'Platform'], ['detail', 'Description'], ['source', 'Source'], ['verifiedOn', 'Verified on']];
          const input = isList ? h('div', { id, className: 'editor-list', role: 'group', 'aria-label': field.label, 'aria-describedby': `${id}-help` },
            h('p', { id: `${id}-help`, className: 'editor-list-help' }, field.type === 'resources'
              ? 'Add a label, description, and complete web address for each resource.'
              : `Add a complete web address for each link. Labels, platform, description, source, and verification date are optional.${path === 'links' && kind !== 'people' ? ' Directory platform fields take precedence over these records.' : ''}`),
            rows.length === 0 ? h('p', { className: 'editor-list-help' }, 'No items. Choose Override, then add an item.') : null,
            ...rows.map((row, index) => h('fieldset', { key: index, disabled: mode !== 'override' },
              h('legend', {}, `${field.type === 'resources' ? 'Resource' : 'Link'} ${index + 1}`),
              ...rowFields.map(([key, label]) => {
                const props = { id: `${id}-${index}-${key}`, value: row[key] ?? '',
                  'aria-invalid': key === 'url' && !!this.state.errors[path],
                  'aria-describedby': `${id}-help${this.state.errors[path] ? ` ${id}-error` : ''}`,
                  onChange: event => {
                    const updated = { ...row };
                    if (field.type === 'links' && !event.target.value && key !== 'url') delete updated[key];
                    else updated[key] = event.target.value;
                    updateRows(rows.map((item, i) => i === index ? updated : item));
                  } };
                return h('label', { key, htmlFor: props.id }, label + (key === 'url' ? ' (required)' : ''),
                  key === 'platform' ? h('select', props, h('option', { value: '' }, 'Detect from URL'), ...['website', 'wikipedia', 'wikidata', 'facebook', 'instagram', 'x', 'bluesky', 'youtube', 'linkedin', 'threads', 'tiktok', 'mastodon', 'truthsocial', 'rumble', 'substack'].map(platform => h('option', { key: platform, value: platform }, platform)))
                  : key === 'description' || key === 'detail' ? h('textarea', { ...props, rows: 2 })
                  : h('input', { ...props, type: key === 'url' ? 'url' : 'text', placeholder: key === 'url' ? 'https://example.org' : key === 'verifiedOn' ? 'YYYY-MM-DD' : undefined }));
              }),
              h('button', { type: 'button', 'aria-label': `Remove ${field.type === 'resources' ? 'resource' : 'link'} ${index + 1}`, onClick: () => updateRows(rows.filter((_, i) => i !== index)) }, 'Remove'))),
            h('button', { type: 'button', disabled: mode !== 'override', onClick: () => updateRows([...rows, field.type === 'resources' ? { label: '', description: '', url: '' } : { url: '' }]) }, field.type === 'resources' ? 'Add resource' : 'Add link'))
            : field.relation && field.type !== 'lines' ? h('div', {},
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
            : ['text', 'lines'].includes(field.type) ? h('textarea', { ...inputProps, rows: 4 })
            : h('input', { ...inputProps, type: field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text' });
          return h('section', { key: path, hidden: !matchesField(field, this.state.fieldQuery, this.state.fieldGroup), className: `editor-field ${explicit ? 'has-override' : ''}` },
            h('div', { className: 'editor-field-heading' }, h(isList || field.type === 'addresses' ? 'span' : 'label', { className: 'editor-field-title', ...(isList || field.type === 'addresses' ? {} : { htmlFor: id }) }, icon(path === 'name' ? kind : path), field.label),
              h('select', { 'aria-label': `${field.label} value source`, value: mode,
                onChange: event => {
                  resetDraft();
                  this.setState({ modes: { ...this.state.modes, [path]: event.target.value } });
                  this.change(path, event.target.value === 'inherit' ? undefined : event.target.value === 'clear' ? blank(field) : (empty ? source : value));
                }
              }, h('option', { value: 'inherit' }, 'Use imported value'), h('option', { value: 'override' }, 'Override'), !['name', 'personId', 'officeId', 'partyId', 'parentId', 'year'].includes(path) ? h('option', { value: 'clear' }, 'Clear') : null)),
            input,
            fieldHelp ? h('p', { id: `${id}-field-help`, className: 'editor-list-help' }, fieldHelp) : null,
            h('details', { id: `${id}-source`, className: 'editor-source' }, h('summary', {}, 'Imported value'), h('pre', {}, format(source, field) || '(not published)')),
            this.state.errors[path] ? h('p', { id: `${id}-error`, className: 'editor-error', role: 'alert' }, this.state.errors[path]) : null
          );
        })));
        }),
        matchingFields.length === 0 ? h('p', { className: 'editor-empty-filter' }, 'No fields match. Try another search or reset the filters.') : null,
        Object.keys(this.state.errors).length ? h('p', { className: 'editor-error', role: 'alert' }, 'Some fields have validation errors. Expand the marked sections and reset filters to review them before saving.') : null
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

  let statusSignature = '';
  async function updateStatus() {
    const connection = document.getElementById('connection');
    try {
      const status = await fetch('/status.json').then(response => response.json());
      const signature = JSON.stringify(status);
      if (signature === statusSignature && connection.className !== 'connection-error') return;
      statusSignature = signature;
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
