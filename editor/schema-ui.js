(async () => {
  const status = document.getElementById('status');
  const save = document.createElement('button');
  save.id = 'save'; save.type = 'button'; save.disabled = true; save.textContent = 'Save schema';
  const target = document.getElementById('collection');
  const navigation = document.getElementById('collections');
  let model, baseline, selected, dirty = false;
  const element = (tag, text, attrs = {}) => {
    const node = document.createElement(tag);
    if (text !== null) node.textContent = text;
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const icons = { people: 'account_circle', filings: 'archive', places: 'location_on', offices: 'workspace_premium', parties: 'flag' };
  const collectionIcon = kind => element('span', icons[kind], { class: 'schema-symbol', 'aria-hidden': 'true' });
  function markDirty() { dirty = true; save.disabled = false; status.textContent = 'Unsaved schema changes.'; status.className = ''; }
  function announce(message, error = false) { status.textContent = message; status.className = error ? 'error' : ''; }
  function renderNavigation() {
    navigation.replaceChildren();
    for (const collection of [...model.collections].sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))) {
      const button = element('button', `${collection.label} (${collection.count.toLocaleString()})`, { type: 'button', 'aria-current': collection.kind === selected ? 'true' : 'false' });
      button.prepend(collectionIcon(collection.kind));
      button.onclick = () => { selected = collection.kind; renderNavigation(); renderCollection(); };
      navigation.append(button);
    }
  }
  function renderCollection() {
    const collection = model.collections.find(item => item.kind === selected);
    target.replaceChildren();
    const title = element('h2', collection.label);
    title.prepend(collectionIcon(collection.kind));
    const paneHeading = element('div', null, { class: 'schema-pane-heading' });
    const paneIntro = element('div', null, { class: 'schema-pane-intro' });
    paneIntro.append(title, element('p', collection.editableScope, { class: 'muted' }));
    paneHeading.append(paneIntro, save);
    target.append(paneHeading);
    const label = element('label', 'Collection label');
    const input = element('input', null, { type: 'text', maxlength: '100', required: '', value: collection.label });
    input.oninput = () => { collection.label = input.value; markDirty(); };
    input.onchange = renderNavigation;
    label.append(input); target.append(label);
    const facts = element('div', null, { class: 'facts' });
    facts.append(element('p', `Collection key: ${collection.kind}`), element('p', `Storage: ${collection.storage}`), element('p', `Identity: ${collection.identity}`));
    for (const relationship of collection.relationships) facts.append(element('p', relationship));
    if (collection.readOnlyFields?.length) facts.append(element('p', `Read-only / computed fields: ${collection.readOnlyFields.join(', ')}`));
    target.append(facts);
    const tableWrap = element('div', null, { class: 'table-wrap', role: 'region', 'aria-label': 'Schema fields, scroll horizontally for more columns', tabindex: '0' });
    const table = element('table', null);
    const head = element('thead', null), heading = element('tr', null);
    for (const name of ['Order', 'Field / type', 'Label', 'Select options']) heading.append(element('th', name, { scope: 'col' }));
    head.append(heading); table.append(head);
    const body = element('tbody', null);
    collection.fields.forEach((field, index) => {
      const row = element('tr', null), controls = element('td', null);
      for (const [direction, delta] of [['up', -1], ['down', 1]]) {
        const button = element('button', null, { type: 'button', class: 'schema-order-button', 'aria-label': `Move ${field.label} ${direction}`, title: `Move ${direction}` });
        button.append(element('span', 'expand_more', { class: `schema-symbol${direction === 'up' ? ' schema-order-up' : ''}`, 'aria-hidden': 'true' }));
        button.disabled = index + delta < 0 || index + delta >= collection.fields.length;
        button.onclick = () => {
          const next = index + delta;
          [collection.fields[index], collection.fields[next]] = [collection.fields[next], collection.fields[index]];
          markDirty(); renderCollection();
          target.querySelectorAll('tbody tr')[next].querySelector(`button[aria-label$='${direction}']`)?.focus();
        };
        controls.append(button);
      }
      const identity = element('td', null);
      identity.append(element('code', field.path), element('span', field.type, { class: 'schema-type-badge' }));
      const labelCell = element('td', null);
      const fieldLabel = element('input', null, { type: 'text', maxlength: '160', value: field.label, 'aria-label': `${field.path} label` });
      fieldLabel.oninput = () => { field.label = fieldLabel.value; markDirty(); };
      labelCell.append(fieldLabel);
      const optionCell = element('td', null);
      if (field.options) {
        const options = element('textarea', null, { rows: Math.min(8, Math.max(3, field.options.length)), 'aria-label': `${field.path} options, one per line` });
        options.value = field.options.join('\n');
        options.oninput = () => { field.options = options.value.split('\n').map(value => value.trim()).filter(Boolean); markDirty(); };
        optionCell.append(options, element('small', 'One stored value per line. Values in use cannot be removed.'));
      } else optionCell.append(element('span', '—', { class: 'muted' }));
      row.append(controls, identity, labelCell, optionCell); body.append(row);
    });
    table.append(body); tableWrap.append(table); target.append(tableWrap);
    const reset = element('button', 'Restore this collection’s defaults', { type: 'button' });
    reset.onclick = () => {
      const original = baseline.collections.find(item => item.kind === selected);
      collection.label = original.defaultLabel;
      collection.fields = structuredClone(collection.defaults).map(field => ({ ...field, type: field.options ? 'select' : field.type ?? 'string' }));
      markDirty(); renderNavigation(); renderCollection();
    };
    target.append(reset);
  }
  async function load() {
    const response = await fetch('/schema-settings.json');
    if (!response.ok) throw new Error('Unable to load schema settings.');
    model = await response.json(); baseline = structuredClone(model);
    selected ??= model.collections[0].kind;
    renderNavigation(); renderCollection(); save.disabled = true; dirty = false;
    announce('Labels, field order, and select options are editable. Field paths and types are read only.');
  }
  save.onclick = async () => {
    save.disabled = true; announce('Saving schema…');
    const settings = { version: 1, collections: Object.fromEntries(model.collections.map(collection => [collection.kind, {
      label: collection.label, fields: collection.fields.map(field => ({ path: field.path, label: field.label, ...(field.options ? { options: field.options } : {}) }))
    }])) };
    try {
      const response = await fetch('/schema-settings.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: model.revision, settings }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Schema save failed.');
      model = result; baseline = structuredClone(model); dirty = false;
      renderNavigation(); renderCollection(); announce('Schema saved to the repository. Return to Contents to use the updated forms.');
    } catch (error) { announce(error.message, true); save.disabled = false; }
  };
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  try { await load(); } catch (error) { announce(error.message, true); }
})();
