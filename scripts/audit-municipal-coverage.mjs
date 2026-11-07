import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { coverageReportHtml } from './coverage-report-html.mjs';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const reference = await read('reports/municipality-coverage-reference.json');
const investigation = await read('reports/municipal-gap-investigation.json').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { filings, placesById, peopleById, officesById, slug } = await server.ssrLoadModule('/src/lib/entities.ts');
  const siteUrl = 'https://www.electionsutah.org';
  const entityUrl = (kind, id) => `${siteUrl}/${kind}/${id}/`;
  const siteEntities = new Map();
  for (const place of placesById.values()) siteEntities.set(place.name, entityUrl('places', place.id));
  for (const entry of investigation?.municipalities ?? []) {
    const municipality = [...placesById.values()].find(place => place.name === entry.name && place.county === entry.county);
    entry.siteUrl = municipality ? entityUrl('places', municipality.id) : null;
    entry.countySiteUrl = entityUrl('places', slug(entry.county));
    for (const candidate of entry.candidates ?? []) {
      const filing = filings.find(row => row.name === candidate.name && row.officeName === candidate.office && row.year === candidate.year && row.city === entry.name && row.county === entry.county);
      candidate.siteUrl = filing && peopleById.has(filing.personId) ? entityUrl('people', filing.personId) : null;
      candidate.officeSiteUrl = filing && officesById.has(filing.officeId) ? entityUrl('offices', filing.officeId) : null;
      if (candidate.siteUrl) siteEntities.set(candidate.name, candidate.siteUrl);
      if (candidate.officeSiteUrl) siteEntities.set(candidate.office, candidate.officeSiteUrl);
    }
  }
  const fireOffice = [...officesById.values()].find(office => office.name === 'New Harmony Valley Fire SSD Board Member');
  if (fireOffice) siteEntities.set('New Harmony Valley Fire SSD', entityUrl('offices', fireOffice.id));
  const aliases = { 'Magna City': 'Magna', 'Ogden Valley': 'Ogden Valley City' };
  const years = [1989, 1991, 1993, 1995, 2013, 2015, 2017, 2019, 2021, 2023, 2025];
  const municipalities = new Map();
  for (const entry of reference.municipalities) {
    const name = aliases[entry.name] ?? entry.name;
    const item = municipalities.get(name) ?? { name, counties: [] };
    item.counties.push(entry.county);
    municipalities.set(name, item);
  }
  const rows = [...municipalities.values()].map(({ name, counties }) => {
    const ids = counties.map(county => `${slug(county)}/${slug(name)}`);
    const id = ids.find(id => placesById.has(id)) ?? ids[0];
    const records = filings.filter(row => counties.includes(row.county) && slug(row.city) === slug(name) && row.section === 'Municipal Offices');
    return { id, name, county: counties.join(' / '), counties, siteUrl: placesById.has(id) ? entityUrl('places', id) : null,
      countyLinks: counties.map(county => ({ name: county, url: entityUrl('places', slug(county)) })),
      hasPlacePage: ids.some(id => placesById.has(id)), filings: records.length,
      years: Object.fromEntries(years.map(year => [year, records.filter(row => row.year === year).length])) };
  });
  const summary = { municipalities: rows.length, missingPlacePages: rows.filter(row => !row.hasPlacePage).length,
    withoutMunicipalFilings: rows.filter(row => !row.filings).length,
    byYear: Object.fromEntries(years.map(year => [year, { municipalitiesWithRecords: rows.filter(row => row.years[year]).length,
      municipalitiesWithoutRecords: rows.filter(row => !row.years[year]).length }])) };
  const special = filings.filter(row => /New Harmony Valley Fire/.test(row.officeName));
  const recordInventory = [...new Set(filings.map(row => row.year))].sort().map(year => {
    const records = filings.filter(row => row.year === year);
    return { year, filings: records.length, sections: Object.fromEntries([...new Set(records.map(row => row.section))].sort().map(section => [section, records.filter(row => row.section === section).length])) };
  });
  const report = { generatedOn: new Date().toISOString().slice(0, 10), scope: 'Municipal candidate coverage, plus the researched New Harmony fire district records',
    siteUrl, siteEntities: [...siteEntities].map(([name, url]) => ({ name, url })),
    referenceSource: reference.source, caveat: reference.description, summary,
    newHarmony: { municipality: rows.find(row => row.id === 'washington/new-harmony'), fireDistrictFilings: special.length },
    investigationSummary: investigation ? {
      cohort: investigation.municipalities.length,
      withImportedRecords: investigation.municipalities.filter(row => row.importedRecords > 0).length,
      importedRecords: investigation.municipalities.reduce((n, row) => n + row.importedRecords, 0),
      unresolved: investigation.municipalities.filter(row => !row.importedRecords).length
    } : null,
    recordInventory, municipalities: rows };
  await writeFile(new URL('reports/municipal-coverage-audit.json', root), JSON.stringify(report, null, 2) + '\n');
  const missing = rows.filter(row => !row.filings);
  const md = [
    '# Municipal coverage audit', '',
    `Reference: [UGRC municipality boundaries](${reference.source}). ${reference.description}`, '',
    `Audited ${rows.length} distinct municipalities across ${reference.municipalities.length} municipality/county boundary entries. Multi-county municipalities are counted once. ${summary.missingPlacePages} have no place page; ${missing.length} have no municipal candidate records.`, '',
    'These are coverage flags, not proof that elections were held or that no candidates filed. Incorporation dates, uncontested cancellations, and missing source rosters need individual review.', '',
    '| Election year | Municipalities with records | No records |', '| --- | ---: | ---: |',
    ...years.map(year => `| ${year} | ${summary.byYear[year].municipalitiesWithRecords} | ${summary.byYear[year].municipalitiesWithoutRecords} |`), '',
    '## Municipalities without candidate records', '',
    ...missing.map(row => `- ${row.siteUrl ? `[${row.name}](${row.siteUrl})` : row.name}, ${row.countyLinks.map(county => `[${county.name} County](${county.url})`).join(' / ')}${row.hasPlacePage ? ' (place page exists)' : ' (place page missing)'}`), '',
    '## Investigation of the original 33 gaps', '',
    'Each municipality received a source review. Imports add the supported records only; they do not establish a complete roster across all years. Named cancellations, filing lists, and signed canvasses are importable. Incumbent lists, prospective filing notices, vacancy appointments, and proposed cancellation agendas are not candidate rosters.', '',
    ...(investigation ? investigation.municipalities.flatMap(row => [
      `### ${row.siteUrl ? `[${row.name}](${row.siteUrl})` : `${row.name} (site page unavailable)`}, [${row.county} County](${row.countySiteUrl})`, '',
      `Status: ${row.status}. Imported records: ${row.importedRecords}.`, '',
      ...row.notes.map(note => `- ${note}`),
      ...(row.candidates ?? []).map(candidate => `- ${candidate.siteUrl ? `[${candidate.name}](${candidate.siteUrl})` : candidate.name} · ${candidate.year} · ${candidate.officeSiteUrl ? `[${candidate.office}](${candidate.officeSiteUrl})` : candidate.office} · ${candidate.sourceStatus}`),
      ...row.sources.map((source, index) => `- [Source ${index + 1}](${source})`), ''
    ]) : []),
    '## Confirmed source and workflow gaps', '',
    '- New Harmony: imported named municipal candidates for 2017 and 2019. The 2025 cancellation resolution does not name its candidates, so that roster remains unresolved.',
    '- New Harmony: the 2024 vacancy appointment is retained as an official-source note, not counted as an election filing.',
    '- New Harmony Valley Fire SSD: seven 2021 primary candidates corroborated against the county primary PDF; six also appear in the county general summary. Those six records use the later general-election stage. No winner status or vote totals are inferred.',
    '- The state results importer starts in 2023. It cannot supply the missing pre-2023 municipal or special-district history.',
    '- Results-only imports miss unopposed candidates when an election is cancelled. Filing lists and cancellation notices require separate research.',
    '- The 2013 and 2015 municipal imports cover Salt Lake County only; zero records elsewhere are a known geographic limitation.',
    '- Washington County’s previous-results index provides 2019 CSV and 2021 primary/general summaries and CSV exports. These are concrete sources for a broader county backfill.', '',
    '[Washington County previous election results](https://www.washco.utah.gov/departments/clerk/elections/previous-election-results/)', '',
    '## Database inventory', '',
    '| Year | Candidate records across all sections |', '| --- | ---: |',
    ...recordInventory.map(row => `| ${row.year} | ${row.filings} |`), '',
    'Full per-place and per-year counts and section inventory are in municipal-coverage-audit.json. This audit measures municipal coverage, not completeness within a recorded race or statewide filing-list completeness.', ''
  ].join('\n');
  await writeFile(new URL('reports/municipal-coverage-audit.md', root), md);
  await writeFile(new URL('reports/municipal-coverage-audit.html', root), coverageReportHtml(report, investigation, md));
  console.log(JSON.stringify(summary, null, 2));
} finally { await server.close(); }
