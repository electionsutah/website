// Run the edge handler locally with mocked fetch/context; no Netlify or network needed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../netlify/edge-functions/labs-og.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const shell = `<title>Labs</title>
<meta name="description" content="Default" />
<meta property="og:title" content="Labs" />
<meta property="og:description" content="Default" />
<meta property="og:url" content="https://example.com/labs/" />
<meta property="og:image:alt" content="Labs" />`;
const originalFetch = globalThis.fetch;
let moduleId = 0;
async function run(map, race, { contentType = 'text/html', failFetch = false } = {}) {
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches++;
    if (failFetch) throw new Error('network unavailable');
    return Response.json(map);
  };
  const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}#${moduleId++}`);
  const original = new Response(shell, {
    status: 202, headers: { 'content-type': contentType, 'content-length': String(shell.length), 'x-test': 'preserved' },
  });
  const response = await handler(new Request(`https://example.com/labs/${race === undefined ? '' : `?race=${encodeURIComponent(race)}`}`), {
    next: async () => original,
  });
  return { response, original, body: await response.text(), fetches };
}

try {
  for (const race of ['__proto__', 'constructor', 'toString', 'unknown']) {
    const result = await run({ known: { title: 'Known', description: 'Valid' } }, race);
    assert.equal(result.response, result.original, `${race} must leave the page intact`);
    assert.equal(result.body, shell);
  }
  for (const map of [null, [], 'invalid', { known: null }, { known: {} },
    { known: { title: 1, description: 'Valid' } }, { known: { title: 'Valid' } },
    { known: { title: 'Valid', description: [] } }]) {
    const result = await run(map, 'known');
    assert.equal(result.response, result.original, 'Malformed data must leave the page intact');
  }

  const tricky = 'D $& $` $\' " < > &';
  const expected = 'D $&amp; $` $\' &quot; &lt; &gt; &amp;';
  const result = await run({ known: { title: tricky, description: tricky } }, 'KNOWN');
  assert(result.body.includes(`<title>${expected} — Elections Utah</title>`));
  assert(result.body.includes(`<meta name="description" content="${expected}" />`));
  assert(result.body.includes(`<meta property="og:title" content="${expected} — Elections Utah" />`));
  assert(result.body.includes('content="https://example.com/labs/?race=known"'));
  assert.equal((result.body.match(/<meta /g) ?? []).length, 5, 'Replacement tokens must not duplicate tags');
  assert.equal(result.response.status, 202);
  assert.equal(result.response.headers.get('x-test'), 'preserved');
  assert.equal(result.response.headers.get('content-length'), null);

  const noRace = await run({}, undefined);
  assert.equal(noRace.fetches, 0);
  assert.equal(noRace.response, noRace.original);
  const nonHtml = await run({ known: { title: 'Title', description: 'Description' } }, 'known', { contentType: 'application/json' });
  assert.equal(nonHtml.response, nonHtml.original);
  const failed = await run({}, 'known', { failFetch: true });
  assert.equal(failed.response, failed.original);
  console.log('Labs edge regressions passed: inherited keys, malformed previews, literal replacement tokens, escaping, headers, and fallbacks.');
} finally {
  globalThis.fetch = originalFetch;
}
