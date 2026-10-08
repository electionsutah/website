# Elections Utah — UX & accessibility audit

**Date:** 2026-10-07 · **Build:** `npm run build` (vite preview) · **Target:** WCAG 2.2 Level AA, per `UX_SKILL.md`

## Method

- **Automated:** axe-core 4.11 with the WCAG 2.0/2.1/2.2 A+AA and best-practice rule sets, run in headless Chrome.
  - 32 page states at 1280×900, and the same 32 again at 390×844.
  - Coverage: every index (list and tile views), one detail page per entity type, an election year, a locally administered year, the docs, both 404s, the filters panel open, an active filter, the search modal (empty and with results), and the mobile menu.
- **Manual (real keyboard events via Chrome DevTools Protocol):**
  - Tab order and focus visibility.
  - Search modal focus containment and Escape.
  - Route-change focus and page titles.
  - Mobile menu and the filter → result flow.
- **Measured:**
  - Reflow at 320 px (WCAG 1.4.10).
  - Text-spacing override (1.4.12).
  - Target sizes (2.5.8).
  - Text-size census.
  - Contrast ratios.
  - Load timing.
- **Content:** review of page copy and a scan of the candidate data.
- **Not available:** the bundled files `UX_SKILL.md` mentions (`check_prototype.py`, `accessibility-quality-gates.md`, etc.) are not in the repo, so axe-core stood in for the static checker. No screen reader (VoiceOver/NVDA) pass was done. Findings about announcements are inferred from the accessibility tree.

**ADA applicability:** the DOJ Title II web rule covers state and local government entities. Elections Utah is an independent civic project, so it is not directly covered. WCAG 2.2 AA is still the right quality bar for public election information.

## What already passes

- `lang="en"`, a meta description, alt text on content images, and decorative SVG/icons with `aria-hidden`.
- Reflow at 320 px has no horizontal scroll. The text-spacing override caused no clipping.
- `prefers-reduced-motion` is respected (smooth scroll and transitions are disabled).
- Every interactive target is at least 24×24 px (2.5.8). Mobile header buttons are 44 px.
- Sortable headers use `<th aria-sort>` with real buttons. The view toggle uses `aria-pressed`, and the Filters toggle uses `aria-expanded` with `aria-controls`.
- Mobile search inputs are 16 px, so iOS doesn't zoom (except the glossary input; see A13).
- The search modal has `role="dialog"`, `aria-modal`, a labelled heading, and Escape to close.
- No JS errors on any audited route. First contentful paint is about 180 ms locally.

---

## A. Accessibility findings (ranked)

### High — WCAG AA failures that block or mislead users

**A1. The search modal doesn't contain or return focus.** Fails 2.4.3 Focus Order, and the `aria-modal` claim is false.
- Tabbing through the results leaves the dialog and moves into the page behind it. After about 30 tabs, focus was on the index "List view" button while the modal was still open.
- Closing the modal leaves focus wherever it was, not on the Search button that opened it.
- The page behind still scrolls.
- **Fix:**
  - Trap Tab/Shift+Tab inside `.search-popout` (or use `<dialog>` with `showModal()`, which also makes the background inert).
  - Restore focus to the trigger on close.
  - Lock body scroll while the modal is open.
- Files: `src/SearchPalette.svelte`, `src/App.svelte`.

**A2. Search fields have no visible focus indicator.** Fails 2.4.7.
- `outline:0` is set on `.finder input`, `.index-tools input`, `.election-tools input`, `.global-search-input input` and `.glossary-search input`.
- Nothing replaces it: there is no `:focus-within` style on the wrapping label.
- Keyboard users can't see that they are in any of the site's five search boxes.
- **Fix:** add `label:focus-within{outline:3px solid …;outline-offset:2px}` for those wrappers.
- File: `src/app.css`.

**A3. Text contrast failures.** Fails 1.4.3.

| Element | Where | Ratio | Needs |
|---|---|---|---|
| `.eyebrow.light` ("Election archive", "Utah's open election archive", "2017–2026 archive") | Home hero and **every index header** (light background) | **1.51:1** | 4.5:1 |
| Facet legend schema names (`{YYYY}_election`, `election_type`…) | Filters panel | 2.82:1 | 4.5:1 |
| "UT" logo mark (white on `#ff4c3c`, 10 px bold) | Header and footer, every page | 3.3:1 | 4.5:1 |
| `.source-link` on a party-tinted hero | e.g. `/parties/forward-party-utah/` | 4.2:1 | 4.5:1 |

- The `.light` eyebrow variant was designed for dark backgrounds but is used on light ones, so it is close to invisible.
- **Fix:** use `#5f5e59` there. For the schema names use `#5f5e59` or darker. For the UT mark use a darker red (`#d42f20` or darker) or larger text.

**A4. Focus ring color is too faint on light backgrounds.** Fails 1.4.11 Non-text Contrast.
- The global ring `#52a7e0` measures 2.64:1 on white and 2.33:1 on `#f2f1ed`. It passes only on the dark header (4.65:1).
- The `.search-start` links (the hover state added last session) replace the ring with a `#f2f1ed` background tint, which is 1.13:1 on white. That is effectively invisible.
- **Fix:**
  - Use `#006eb7` (5.3:1 on white) for rings on light surfaces, or a two-tone ring (dark outline plus white offset).
  - Keep an outline on `.search-start a:focus-visible`.

**A5. Client-side navigation doesn't move focus, announce the new page, or reliably update the title.** Fails 2.4.3, 2.4.2 and 4.1.3.
- After activating a nav link, focus stays on that link in the header. Screen reader users hear nothing and must find the new content themselves.
- **Title bug:** the home page and the 404 route have no `<svelte:head>` title. After visiting `/elections/` and then going Home or to an unknown URL, the tab still reads "Election years — Elections Utah".
- **Fix:**
  - In `navigate()`, after the route renders, focus the page `<h1>` (with `tabindex="-1"`) or `<main>`.
  - Set titles for home ("Elections Utah — Open civic data") and the 404 ("Page not found — Elections Utah").

### Medium

**A6. No skip link.** Fails 2.4.1 Bypass Blocks.
- Every page has 10 header tab stops before the content.
- `<main id="top">` already exists. Add a visually hidden-until-focused "Skip to content" link as the first element.

**A7. Result changes are not announced.** Fails 4.1.3 Status Messages.
- These counts update silently: "N of M records" on the indexes, "N matching records" in the modal and the election-year search, and the glossary term count.
- Applying a filter gives screen reader users no feedback.
- **Fix:** add `role="status"` (or `aria-live="polite"`) to the count elements.

**A8. Mobile menu focus order and dismissal.** Fails 2.4.3.
- The menu links come *before* the toggle in the DOM. After opening the menu, Tab moves into page content, not into the menu that just appeared below the button.
- Escape doesn't close the menu.
- **Fix:** put the `<nav>` after the toggle (or move focus to the first link on open), close on Escape and return focus to the toggle, and add `aria-controls`.

**A9. Confusing accessible names.**
- Facet chips read as one run-on number: "2026392", "General249". Add a hidden separator, e.g. `<span><span class="sr-only">, </span>392<span class="sr-only"> records</span></span>`.
- The initials avatars (`.mini-avatar`, `.initial`, `.detail-avatar`, search result badges such as "OF", "PL", "YR") are announced as part of every row link, e.g. "A U 'alama 'ulu'ave". Mark them `aria-hidden="true"`.
- Active-filter chips: the `aria-label` "Remove filter Party: Utah Democratic Party" doesn't contain the visible text "PartyUtah Democratic Party". Fails 2.5.3 Label in Name; axe flags it.
- The brand link `aria-label="Elections Utah home"` is flagged by axe for the same reason. Drop the aria-label; the visible text is enough.

**A10. Home finder tabs have no state semantics.** Fails 1.3.1 and 4.1.2.
- The "People / Offices" switcher shows which one is selected only through color and underline.
- **Fix:** add `aria-pressed` (simplest) or a full tabs pattern (`role="tablist"`, `aria-selected`, arrow keys).

**A11. Misused ARIA.**
- `aria-label` on plain `<div>`s is prohibited and ignored by assistive tech: `.party-list`, `.active-filters`, `.place-source-links`, `.office-resources` (41 instances).
- **Fix:** add `role="group"` (or `<ul>`/`<nav>` where it fits).
- The modal's `<header>` creates a second `banner` landmark (axe: landmark-no-duplicate-banner). Make it a `<div>`.

### Low

**A12. Current location isn't exposed to assistive tech.**
- The active nav item and the last breadcrumb are shown only visually. Add `aria-current="page"`.
- Breadcrumbs should be an `<ol>` so their position is announced.

**A13. Tiny text, site-wide.** Not a strict AA failure, but a major legibility problem.
- Text-size census: on `/places/salt-lake/`, about 1,100 text elements are 8–10 px (8 px: 445, 9 px: 332, 10 px: 329).
- Affected: all `.eyebrow` labels, stat labels ("FILINGS"), table headers, card meta, timeline dates, and the "N of M records" count.
- Most are uppercase and letter-spaced, which further reduces legibility.
- The glossary filter input is 11 px, so iOS zooms on focus.
- **Recommendation:** 12 px minimum for labels, 14 px for meta, and 16 px for inputs.

**A14. Data tables lack captions.** Add a `<caption class="sr-only">` (e.g. "People, sorted by Person A–Z") so the table is identified and the sort state is summarized.

**A15. Links that open new tabs give no warning** (advisory technique G201). The ↗ icon is `aria-hidden`. Add visually hidden "(opens in new tab)" text to `target="_blank"` links. The footer CC0 link also lacks `rel="noreferrer"`.

**A16. "Show more" leaves focus on the button.** The new rows appear above it. Move focus to the first newly revealed row so keyboard and screen reader users continue from there.

---

## B. UX findings

**B1. On mobile, the filter panel buries results.**
- At 390×844 the open panel is **1,477 px tall** (1.75 screens). Choosing a facet updates results that are off-screen, with no close or "Show N results" control at the bottom.
- **Recommendation:** on narrow screens use a full-height sheet with a sticky "Show 392 results" button, or collapse each facet group (an accordion with selected values summarized).

**B2. Sort order puts punctuation first.**
- A–Z on People starts with "'alama 'ulu'ave", "“CJ” Christina Hernandez" and "“One” Neil Hansen".
- **Fix:** `Intl.Collator(…, { ignorePunctuation: true })` in `sortRows`.

**B3. Election milestones are stale.** Today is Oct 7, 2026.
- Five of six milestones are past, but nothing marks them as past.
- The highlighted "featured" item is still the Aug 31 write-in deadline.
- **Recommendation:** compute status from the date, de-emphasize completed items, and feature the next upcoming milestone (Nov 3 general election).

**B4. Inconsistent number formatting.** "1928 filing records… 1488 people", "1532 normalized records" and "1488 OF 1488 RECORDS" lack separators, while place populations use them. Use `toLocaleString('en-US')` everywhere.

**B5. Hard-coded count.** The "Current Listings" card text says "396 … records" as a literal. Derive it from the data, like the historical card does.

**B6. Person contact card leaves an empty cell.** With one contact method (e.g. email only), the two-column grid shows an empty bordered box. Let a lone item span both columns.

**B7. Misleading icons.** Email (`mailto:`) and phone (`tel:`) links use the ↗ "external" arrow. Use `mail` / `call` icons, or none.

**B8. "Explore the data" opens a dialog without saying so.** Add `aria-haspopup="dialog"`. Consider making the button read "Search the data" so the result is predictable.

**B9. Missing favicon.** `/favicon.ico` 404s on every load, and the tab shows a blank icon.

**B10. Fragile external hero image.** The Capitol photo is hot-linked from the old site's CloudFront (`d33wubrfki0l68.cloudfront.net`). If that distribution goes away, the home hero breaks. Host it in `public/` as AVIF/WebP with `width`/`height` to prevent layout shift.

**B11. Bundle weight.**
- All data is inlined into one 1.3 MB JS chunk (about 170 KB gzipped), and Vite warns about it. That is fine on desktop, but parse cost on low-end phones is real.
- **Consider:** lazy-load the historical JSON, or code-split per route.
- Text fonts still load from Google Fonts. Self-hosting them, as with the icon font, removes a third-party request and a FOUT.

## C. Content and data findings

**C1. Inconsistent source-status vocabulary.**
- It surfaces directly in UI badges and filters: "Write In" vs "Write-In", "Primary" vs "Primary Election Candidate", plus a bare "Election Candidate".
- **Fix:** normalize these in the generator scripts, keeping the raw value in the data.

**C2. Name casing anomalies.**
- All caps: "DENYSE  HOUSLEY COX" (also a double space), "MERLE TRAVIS WALL", "WARREN ROGERS".
- All lowercase: "'alama 'ulu'ave", which also produces lowercase "au" initials.
- These come from the source data. A display-only title-case fix (preserving the ʻokina) would remove the inconsistency.

**C3. Plain language** (Digital.gov guidance).
- "Schema status" next to "Status" on person filing cards is jargon for most visitors. Consider "Status (normalized)" with a link to the glossary, or show it only in the docs.
- The facet labels' schema field names (`{YYYY}_election`) are useful for developers but noisy for everyone else. Consider showing them only on hover or in docs.

**C4. Unlinked sources.** About 31 records from 2017 (Provo, Park City, Marriott-Slaterville) still point at dead pages that were never archived. These are known from the document-linking work. A short "Source no longer available" note would set expectations better than a link that 404s.

---

## Suggested fix order

1. **Quick, high-impact CSS:** A2, A3, A4, the A13 minimums, B6.
2. **Shell behavior in `App.svelte` and `SearchPalette.svelte`:** A1, A5, A6, A8, B8.
3. **Semantics pass:** A7, A9–A12, A14–A16.
4. **UX and content:** B1–B5, B7, B9–B11, C1–C4.

---

## Fix status (2026-10-07)

Everything above is addressed except where noted. After the fixes, axe reports no violations on all 30 states at 1280×900. At 390×844 the only report is `target-size` on filter chips partly covered by the sticky "Show N results" button while the panel scrolls. Focused chips get `scroll-margin-bottom` so they scroll clear of it.

- **A1:** fixed. The page behind the modal is `inert` and doesn't scroll, Tab wraps inside the dialog, and focus returns to the trigger on close. Choosing a result moves focus to the new page instead.
- **A2–A4:** fixed.
  - Search wrappers show a `:focus-within` ring.
  - Ring colors: `#006eb7` on light surfaces, `#52a7e0` on dark ones.
  - `.eyebrow.light` is removed from light backgrounds. The UT mark is `#d42f20`.
- **A5:** fixed. Route changes focus the page `<h1>`, and home and the 404 page set their own titles.
- **A6–A12:** fixed.
  - Skip link, `role="status"` counts, and a reordered mobile menu that closes on Escape.
  - Chip names, `aria-hidden` avatars, `aria-pressed` finder tabs, `role="group"`, and the modal header changed to a `<div>`.
  - `aria-current` on the nav and an `<ol>` in breadcrumbs (new `Breadcrumbs.svelte`).
- **A13:** 8–11 px text is raised to 11–12 px, meta text to 12–14 px, and the glossary input to 16 px.
- **A14–A16:** fixed (table captions, "(opens in new tab)" text, and "Show more" focus).
- **B1:** fixed. A sticky "Show N results" button closes the mobile filter panel.
- **B2–B10:** fixed.
  - Milestone status is computed from dates.
  - `formatCount()` adds thousands separators.
  - Mail and phone icons; the hero image is self-hosted as WebP with a JPEG fallback; `favicon.svg`.
- **B11:**
  - Done: text fonts are self-hosted.
  - **Not done:** lazy-loading the data. All records are still in one JS chunk.
- **C1, C2:** normalized at display time in `src/lib/entities.ts` (`displayStatus`, `displayName`). The raw data and generator scripts are unchanged.
- **C3:**
  - "Schema status" is now "Normalized status".
  - Facet schema field names are kept for developers, now at passing contrast.
- **C4:** the 33 filings whose 2017 source pages are gone (Provo, Park City, Saratoga Springs, Marriott-Slaterville) now say "Original source no longer online" instead of linking to a 404.
