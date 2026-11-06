import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { people, peopleById, filings, identityKey, slug } = await server.ssrLoadModule('/src/lib/entities.ts');
  for (const [full, short] of [
    ['Aleta Andersen Taylor', 'Aleta Taylor'],
    ['John R. Westwood', 'John Westwood'],
    ['Justin L. Fawson', 'Justin Fawson'],
    ['Kathie Lynn Johnson', 'Kathie L. Johnson'],
    ['Mark T. Woolley', 'Mark Woolley'],
    ['Amy Steed Morgan', 'Amy Morgan'],
    ['Angela Nicole Walker', 'Angela Walker'],
    ['Brad R Wilson', 'Brad Wilson'],
    ['Bradley M. Daw', 'Bradley Daw'],
    ['Bradley M. Daw', 'Brad Daw'],
    ['Carl R. Albrecht', 'Carl Albrecht'],
    ['Christine Facer Watkins', 'Christine F Watkins'],
    ['Cody W. Stromberg', 'Cody Stromberg'],
    ['David A Else', 'David Else'],
    ['David B Fair', 'David Fair'],
    ['David Parley Hinkins', 'David P. Hinkins'],
    ['David Parley Hinkins', 'David Hinkins'],
    ['Derk Powell Timothy', 'Derk P. Timothy'],
    ['Dirk S. Burton', 'Dirk Burton'],
    ['Elise Deluna Morgan', 'Elise Morgan'],
    ['Elizabeth L. Weight', 'Elizabeth Weight'],
    ["James Rex Moss, Jr.", "James Moss Jr"],
    ["Jefferson R Moss", "Jefferson Moss"],
    ["John \"Frugal\" Dougall", "John Dougall"],
    ["John \"Frugal\" Dougall", "John 'frugal' Dougall"],
    ["Kay Jeffery Christofferson", "Kay J. Christofferson"],
    ["Kim V. Rolfe", "Kim Rolfe"],
    ["Kirk D Pearson", "Kirk Pearson"],
    ["Lynn N. Hemingway", "Lynn Hemingway"]
  ]) {
    assert.equal(identityKey(full), identityKey(short));
    const person = peopleById.get(slug(full));
    assert.equal(person?.name, full);
    assert(slug(short) === slug(full) || !people.some(p => p.id === slug(short)), `${short} must not remain a separate person`);
    for (const name of [full, short]) {
      const sources = filings.filter(f => identityKey(f.name) === identityKey(name) || (f.runningMate && identityKey(f.runningMate) === identityKey(name)));
      assert(sources.length > 0);
      assert(sources.every(f => (identityKey(f.name) === identityKey(name) ? f.personId : f.runningMateId) === person.id && person.filings.includes(f)));
    }
    assert(person.filings.some(f => f.name === short || f.runningMate === short), 'Source name must be preserved');
    console.log(`${full}: ${person.filings.length} source filings retained`);
  }
  assert.notEqual(identityKey('Margaret Bourke'), identityKey('Margaret Ellen Bourke'), 'Pending pairs must remain separate');
} finally { await server.close(); }
