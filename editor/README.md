# Local Decap editor proof of concept

Run from the repository root, on Node.js 20 or later:

```sh
npm install                 # site dependencies, if needed
npm run editor:install      # isolated editor dependencies; first setup only
npm run editor
```

Open **http://127.0.0.1:8080**. If Decap shows a login screen, choose the local
repository login; no GitHub account or credentials are needed. The companion
site is **http://127.0.0.1:5174**. Ctrl+C stops the editor, the Decap proxy,
and this companion site. An existing site on port 5173 is left running.

Choose **People** or **Filing records**, search for an entry, then select it.
For town or county social accounts, choose **Places** and search for its name.
Select **Override** beside a platform, paste its full account URL, and Publish.
Use **Clear** to suppress an imported account or **Use imported value** to restore
it. Only that platform changes; other social and reference links remain intact.
**Offices**, **Parties**, and **Places** also expose Email, Phone, and repeatable
Addresses fields under the shared `contact` object. Contacts start empty when
the entity's enrichment source has none; candidate filing contacts are not
inferred to be office, party, or town contacts. These values are stored in the
entity's shared data for downstream consumers; adding contact cards to those
public detail pages is separate from this schema/editor setup.
The **Open on the local site** link lets you check the saved result. Existing
towns and counties are included; creating new places is outside this editor's scope.
Each field shows its imported value and offers three modes:

- **Use imported value:** follow the repository's source data and future imports.
- **Override:** use the value you enter, preserving other fields.
- **Clear:** intentionally use an empty value, even when the source has one.

Click **Publish** at the top to save. In this local setup, Publish writes to the
local repository; it does not commit, push, or deploy. The footer confirms when
the canonical override file has been written. The companion site updates through
Vite; the public site changes only after the usual build and deployment.

## Data and persistence

### Schema screen

Open **Schema** in the menu bar or visit `http://127.0.0.1:8080/schema`.
Contents and Schema share ELUT’s theme. `elut-theme.mjs` reads design tokens
and font declarations directly from `src/app.css`; `elut.css` applies those
tokens to the editor. The dark menu uses the site’s white logo and salmon rule,
with Noto Sans controls, Source Serif headings, blue actions, and warm surfaces.
No separate font downloads or copied token definitions are maintained.
Inspect each collection's field paths, types, record counts, storage, and
relationships. Edit collection/field labels, use the arrow buttons to reorder
fields, and edit select options one per line. **Save schema** persists the changes
in `src/data/editor-schema.json`. Return to Contents (or reload an existing editor
tab) to load the new forms. Settings survive editor restarts and are also used by
the site's override validation. Option values used by source records or saved
overrides cannot be removed. Concurrent schema edits are rejected until reloaded.
Restore a collection's defaults with its reset button, then Save schema.

The screen describes fields exposed by the editor, plus key relationships. It is
not a complete replacement for the TypeScript entity model: field names, types,
entity relationships, and migrations remain code changes.

`src/data/editor-overrides.json` is the durable, Git-tracked source of manual
changes. Its `people` and `filings` maps contain only explicitly overridden
fields. Contact paths such as `contact.email` merge into the imported contact
object. Person website/social edits use the canonical `links` list; filing
records keep their historical contact website/social fields. Empty strings and arrays mean clear; removing a key restores inheritance.
The file starts empty; the proof of concept ships no sample changes to real data.

On startup, `workspace.mjs` reads the site's shared entity library and creates
Decap documents for every existing person and filing under ignored
`editor/.workspace/content/`. Profile baselines come from
`src/data/person-enrichment.json`, falling back to archived contact information.
Filing baselines include historical, current, and local candidates and resolved
source documents. Source snapshots and record identities are read only.

The official Decap filesystem proxy runs against **only that generated workspace**.
The editor validates saves, sends them through Decap, and atomically persists
the override map before acknowledging success. A rejected save leaves canonical
content unchanged. Source JSON/YAML files are never rewritten by the editor.
All three servers bind to `127.0.0.1`. The Decap browser bundle is served from the
installed package, so normal editing needs no CDN or external CMS service.

The site applies filing changes before constructing person, office, party, and
place indexes. Corrected city/county values rebuild place relationships. Profile
changes merge with enrichment data in the person view. Official results and vote
totals are outside this proof of concept. Dataset freshness continues to use the
imported timestamps rather than the date of a manual edit.

Stop and restart `npm run editor` after running an importer or updating source
files: this refreshes Decap's source snapshots and adds newly imported records
while retaining saved overrides. `npm run editor:prepare` can regenerate the
workspace while the editor is stopped. The workspace can be deleted and rebuilt
from source data and the tracked override file.

## Current scope

Every collection now exposes its complete source/entity snapshot for inspection.
Offices, Parties, Places, and People share website, Wikipedia, Wikidata, and all
supported social-platform inputs, plus an **All links and source metadata** JSON
list for multiple accounts/resources and per-link evidence. A platform override
takes precedence over that list for its platform; clearing suppresses it and
inheritance restores imported values. Filings expose the full contact-platform set.

Names can be edited without changing stable IDs or URLs. Filings can be reassigned
to existing people, running mates, offices, parties, places, and election years;
reference inputs offer existing names/IDs. Office place associations and a city's
parent county can also be changed. Saved structural edits rebuild the shared
relationship lists and counts. Unknown references, empty required associations,
self running mates, and invalid parent counties are rejected. IDs and derived
aggregate lists remain read only. Keep source facts and identity corrections
distinct when editing: original imported files remain unchanged.

Additional content controls include office resources and descriptions, party
description/display metadata, and place summary, population, dates, and references.

- People: biography, priorities, resource links, provenance, verification date,
  and contact fields.
- Filings: status, election type, location, source, update date, and contacts.
- Resources use a validated JSON array with `label`, `description`, and `url`.
- Addresses have repeatable label/address inputs and are saved under `contact.address`
  as a list of `{label, value}` objects. Existing single-address strings still work.
- Changing stable IDs, creating/deleting records, and media uploads remain outside
  this editor's scope. Entity names and the associations described above are editable.
- Existing IDs are derived from imported names and office/party labels. If an
  upstream import changes those identifiers, startup reports orphaned overrides
  and preserves them for manual review; it does not guess a new identity.
- This is a single-user local editor. Do not run two editor instances against
  the same checkout or edit the override JSON externally during a save.

Optional ports:

```sh
EDITOR_PORT=8090 EDITOR_PROXY_PORT=8091 EDITOR_SITE_PORT=5175 npm run editor
```

The editor's dependencies and lockfile are separate in this directory. Decap
currently emits upstream React peer dependency warnings during installation;
its dependencies are excluded from the public site's dependency manifest.

## Verification

```sh
npm run check:editor
npm run check
npm run build
```

`check:editor` uses the real Decap proxy and real repository records in an isolated
temporary workspace. It checks saves, regeneration, override precedence,
inheritance, explicit clears, contact merging, location relationships, and input
validation without editing repository source data or saved overrides.

References: [Decap local proxy](https://decapcms.org/docs/decap-proxy/),
[custom widgets](https://decapcms.org/docs/custom-widgets/),
[configuration](https://decapcms.org/docs/configuration-options/).

Editor icons use a local Material Symbols Outlined subset (Google, Apache 2.0),
including `ballot`, `archive`, `check_circle`, and `history`. Social fields reuse
the site's exact SVG assets in `public/icons/external/`, at the same 24px size
and original brand colors; see that directory's attribution and license files.

### Link and resource editing

People have one **Websites and social accounts** row list. It supplies both
profile contact cards and People directory cards. Imported profile contact links,
latest filing contact links when no profile exists, and verified enrichment links
are combined without repeating identical URLs. Distinct URLs are preserved.
Explicitly overriding or clearing the list replaces that imported set everywhere;
there is no hidden contact-link fallback.

Historical filing website/social values remain editable on Filings. Existing
person contact/platform overrides are converted into the canonical list when the
workspace is prepared, preserving other accounts and source metadata. The
conversion is persisted with the next save. Old directory platform overrides take
precedence if both legacy fields override the same platform.

Offices, parties, and places retain their directory platform shortcuts; those
shortcuts take precedence over matching directory link records.
Resources and directory/source link records use rows rather than JSON inputs.
Choose Override, then Add resource or Add link. Each row has named inputs and a
Remove button. Links include optional platform, label, description, source, and
verification date. Existing metadata is preserved when another value is changed.
A new or incomplete URL stays in the form draft and blocks saving until corrected
or removed. Filtering and collapsing sections preserve those drafts. Switching a
field back to Use imported value discards its draft, as with other fields.

Run `node editor/widget-check.mjs` to check structured row editing and recovery.

### Styling ownership

- `src/app.css` owns ELUT brand tokens and text fonts; `elut-theme.mjs` imports
  them and maps Decap's theme variables to those tokens.
- `editor/elut.css` owns shared editor appearance, the single Material Symbols
  font definition, and editor-specific icon/logo dimensions.
- `editor/editor.css` contains Decap layout and collection-icon adapters.
- `editor/schema.css` contains Schema layout and table/content formatting.

Use existing ELUT color, type, spacing, and touch-target tokens. Keep content-driven
breakpoints, table widths, reading widths, and other one-off layout constraints
local; introduce a named shared dimension when multiple components need it.
