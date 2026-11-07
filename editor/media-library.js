/* Decap media-library adapter: one folder-aware picker for menu and image fields. */
window.CMS.registerMediaLibrary({
  name: 'local-images',
  async init({ handleInsert }) {
    const element = (tag, text, attrs = {}) => {
      const node = document.createElement(tag);
      if (text) node.textContent = text;
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      return node;
    };
    const dialog = element('dialog', null, { class: 'editor-media-dialog', 'aria-labelledby': 'editor-media-title' });
    const heading = element('header', null, { class: 'editor-media-heading' });
    const title = element('h2', 'Image library', { id: 'editor-media-title' });
    const close = element('button', 'Close', { type: 'button' });
    heading.append(title, close);
    const controls = element('div', null, { class: 'editor-media-controls' });
    const label = element('label', 'Destination folder', { for: 'editor-media-folder' });
    const folders = element('select', null, { id: 'editor-media-folder' });
    label.append(folders);
    const upload = element('button', 'Upload image', { type: 'button' });
    const fileInput = element('input', null, { type: 'file', accept: '.png,.jpg,.jpeg,.webp,.gif,.avif', hidden: '' });
    controls.append(label, upload, fileInput);
    const status = element('p', '', { role: 'status', 'aria-live': 'polite' });
    const help = element('p', 'Choose a folder, then upload an image (PNG, JPEG, WebP, GIF, or AVIF; up to 10 MB). Existing filenames cannot be overwritten.');
    const grid = element('div', null, { class: 'editor-media-grid', 'aria-label': 'Images in selected folder' });
    const footer = element('footer', null, { class: 'editor-media-actions' });
    const choose = element('button', 'Use image', { type: 'button' });
    footer.append(choose);
    dialog.append(heading, controls, help, status, grid, footer);
    document.body.append(dialog);
    let selected, context, returnFocus, listing = 0, busy = false;
    const announce = (message, error = false) => { status.textContent = message; status.className = error ? 'editor-error' : ''; };
    const api = async (action, params) => {
      const response = await fetch('/api/v1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, params }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update the image library.');
      return data;
    };
    const resetSelection = () => { selected = null; choose.disabled = true; };
    async function loadImages(selectedUrl) {
      const revision = ++listing;
      grid.replaceChildren(); resetSelection(); announce('Loading images…');
      try {
        const files = await api('listImages', { mediaFolder: folders.value });
        if (revision !== listing) return;
        for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
          const button = element('button', null, { type: 'button', class: 'editor-media-tile', 'aria-pressed': 'false' });
          const image = element('img', null, { src: file.url, alt: '', loading: 'lazy' });
          button.append(image, element('span', file.name));
          button.onclick = () => {
            if (busy && !selectedUrl) return;
            for (const tile of grid.children) tile.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-pressed', 'true'); selected = file; choose.disabled = false;
          };
          grid.append(button);
          if (file.url === selectedUrl) button.onclick();
        }
        announce(files.length ? `${files.length} images in ${folders.selectedOptions[0].textContent}.` : 'This folder has no images yet.');
      } catch (error) { if (revision === listing) announce(error.message, true); }
    }
    const hide = () => { if (dialog.open) dialog.close(); };
    close.onclick = hide;
    dialog.addEventListener('close', () => { listing++; returnFocus?.focus(); });
    folders.onchange = () => loadImages();
    upload.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0]; if (!file || busy) return;
      if (file.size > 10 * 1024 * 1024) { announce('Choose an image no larger than 10 MB.', true); fileInput.value = ''; return; }
      const destination = folders.value;
      resetSelection();
      busy = true; upload.disabled = folders.disabled = true; announce(`Uploading ${file.name}…`);
      try {
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file);
        });
        const path = `${destination}/${file.name}`;
        await api('persistMedia', { asset: { path, content, encoding: 'base64' } });
        if (dialog.open) { await loadImages('/' + path.slice('public/'.length)); announce(`${file.name} uploaded to ${destination.slice('public/'.length)}.`); }
      } catch (error) { announce(error.message || 'Upload failed. Try again.', true); }
      finally { busy = false; upload.disabled = folders.disabled = false; fileInput.value = ''; }
    };
    choose.onclick = async () => {
      if (!selected) return;
      if (context?.id) { handleInsert(selected.url); hide(); }
      else {
        try { await navigator.clipboard.writeText(selected.url); announce('Image URL copied.'); }
        catch { announce(`Image URL: ${selected.url}`); }
      }
    };
    return {
      enableStandalone: () => true,
      hide,
      async show(options = {}) {
        context = options; returnFocus = document.activeElement;
        choose.textContent = options.id ? 'Use image' : 'Copy image URL';
        if (!dialog.open) dialog.showModal();
        resetSelection(); announce('Loading folders…');
        try {
          const response = await fetch('/media-folders.json');
          if (!response.ok) throw new Error('Unable to load image folders. Close and try again.');
          const paths = await response.json();
          if (!dialog.open) return;
          const previous = folders.value;
          folders.replaceChildren(...paths.map(path => element('option', path.slice('public/'.length), { value: path })));
          const value = Array.isArray(options.value) ? options.value[0] : options.value;
          const current = value?.startsWith('/images/') ? `public${value.slice(0, value.lastIndexOf('/'))}` : null;
          folders.value = paths.includes(current) ? current : paths.includes(previous) ? previous : 'public/images/uploads';
          await loadImages(value);
        } catch (error) { announce(error.message, true); }
      }
    };
  }
});
