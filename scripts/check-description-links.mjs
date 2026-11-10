import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { descriptionLinks } = await server.ssrLoadModule('/src/lib/description-links.ts');
  const text = '1405 candidate filings across 2026, 2024, 2023, 2022, 2020, 2018, 2016, 2014.';
  const parts = descriptionLinks(text);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(parts.filter(part => part.href).map(part => part.href), [2026, 2024, 2023, 2022, 2020, 2018, 2016, 2014].map(year => `/elections/${year}/`));
  const county = descriptionLinks('Located in Salt Lake County.');
  assert.equal(county.find(part => part.href)?.href, '/places/salt-lake/');
  assert(!descriptionLinks('Salt Lake County', '/places/salt-lake/').some(part => part.href));
  assert(!descriptionLinks('120260 or x2024 or 20240').some(part => part.href));
  const markup = '<script>alert("2026")</script>';
  assert.equal(descriptionLinks(markup).map(part => part.text).join(''), markup);
  const { peopleById, filings, importedFilings } = await server.ssrLoadModule('/src/lib/entities.ts');
  const shields = peopleById.get('shields');
  assert.equal(shields.name, 'William Scott Shields', 'Use the sourced full name without changing the established person route');
  assert.deepEqual(descriptionLinks('William Scott Shields'), [{ text: 'William Scott Shields', href: '/people/shields/' }], 'Link the entire reviewed name instead of just the surname');
  const ticketId = '1996-lesh-governor-lieutenant-governor-natural-law';
  const ticket = filings.find(f => f.recordId === ticketId);
  assert.equal(ticket.runningMateId, shields.id);
  assert.equal(ticket.runningMate, shields.name);
  assert.equal(ticket.year, 1996);
  assert.equal(ticket.partyId, 'natural-law');
  assert.equal(ticket.officeName, 'Governor & Lieutenant Governor');
  assert.equal(importedFilings.find(f => f.recordId === ticketId).runningMate, 'Shields', 'Keep the imported source abbreviation intact');
  assert(!shields.filings.some(f => f.personId === 'marilyn-shields' || f.personId === 'valaree-allen-shields'), 'Do not merge unrelated Shields candidates');
  console.log('Description links: election years, entity routes, self links, word boundaries, and preserved text passed');
} finally {
  await server.close();
}
