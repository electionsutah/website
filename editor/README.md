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
Each field shows its imported value and offers three modes:

- **Use imported value:** follow the repository's source data and future imports.
- **Override:** use the value you enter, preserving other fields.
- **Clear:** intentionally use an empty value, even when the source has one.

Click **Publish** at the top to save. In this local setup, Publish writes to the
local repository; it does not commit, push, or deploy. The footer confirms when
the canonical override file has been written. The companion site updates through
Vite; the public site changes only after the usual build and deployment.

## Data and persistence

`src/data/editor-overrides.json` is the durable, Git-tracked source of manual
changes. Its `people` and `filings` maps contain only explicitly overridden
fields. Contact paths such as `contact.website` merge into the imported contact
object. Empty strings and arrays mean clear; removing a key restores inheritance.
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

- People: biography, priorities, resource links, provenance, verification date,
  and contact fields.
- Filings: status, election type, location, source, update date, and contacts.
- Resources use a validated JSON array with `label`, `description`, and `url`.
- Addresses have repeatable label/address inputs and are saved under `contact.address`
  as a list of `{label, value}` objects. Existing single-address strings still work.
- Names, IDs, office/party relationships, new records, deletion, uploads, and
  other entity collections are reserved for a later iteration.
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
