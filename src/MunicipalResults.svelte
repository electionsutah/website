<script lang="ts">
  import { municipalResults } from './lib/municipal-results';
  import { anchoredPopover } from './lib/anchored-popover';
  import Icon from './Icon.svelte';
  export let placeId = '';
  export let personId = '';
  $: contests = municipalResults.filter(c => placeId ? c.placeId === placeId : personId ? c.options.some(o => o.personId === personId) : false);
</script>

{#if contests.length}
  <section class="record-section municipal-results" aria-label="Historical municipal election results">
    <div class="record-heading">
      <p class="eyebrow compact">Published returns</p>
      <h2>Municipal election results</h2>
      <p class="results-intro">Reported votes by contest, including ballot questions. Council voters may select multiple candidates, so totals represent votes rather than turnout. Winner status is unverified.</p>
    </div>
    <div class="municipal-contests">
      {#each contests as contest}
        {@const popoverId = `municipal-result-${contest.id}`}
        <article class="municipal-contest" aria-labelledby={`${popoverId}-heading`}>
          <header class="contest-heading">
            <div>
              <p class="eyebrow compact">{contest.year} · {contest.municipality}</p>
              <h3 id={`${popoverId}-heading`}>{contest.office}</h3>
            </div>
            <button class="place-election-toggle contest-source" popovertarget={popoverId} aria-label={`Sources and notes for ${contest.year} ${contest.municipality} ${contest.office}`}><Icon name="info" /><span>Sources &amp; notes</span></button>
          </header>
          <p class="contest-provenance">{contest.official ? 'Official county returns' : 'Unofficial newspaper returns'}</p>
          <table class="municipal-vote-table">
            <caption class="sr-only">{contest.year} {contest.municipality} {contest.office} reported votes</caption>
            <thead><tr><th scope="col">{contest.kind === 'measure' ? 'Response' : 'Candidate'}</th><th scope="col" class="numeric">Votes</th></tr></thead>
            <tbody>
              {#each contest.options as option}
                <tr>
                  <th scope="row">{#if option.personId}<a href={`/people/${option.personId}/`}>{option.name}</a>{:else}{option.name}{/if}{#if option.writeIn}<small class="write-in">Write-in</small>{/if}</th>
                  <td class="numeric">{option.votes?.toLocaleString('en-US') ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot><tr><th scope="row">{contest.kind === 'measure' ? 'Reported response votes' : 'Known candidate votes'}</th><td class="numeric">{contest.options.every(o => o.votes === null) ? '—' : contest.totalCandidateVotes.toLocaleString('en-US')}</td></tr></tfoot>
          </table>
          <div class="evidence-popover" id={popoverId} popover="auto" use:anchoredPopover={popoverId} aria-labelledby={`${popoverId}-title`}>
            <header><strong id={`${popoverId}-title`}>{contest.year} · {contest.municipality} · {contest.office}</strong><button popovertarget={popoverId} popovertargetaction="hide" aria-label="Close result source"><Icon name="close" /></button></header>
            <p>Election date: {contest.electionDate}. {contest.seats ? `${contest.seats} seat${contest.seats === 1 ? '' : 's'}.` : 'Seat count not verified.'}</p>
            {#each contest.notes as note}<p>{note}</p>{/each}
            <a href={contest.source} target="_blank" rel="noreferrer">{contest.official ? 'Official county results' : 'Unofficial newspaper returns'} <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>
          </div>
        </article>
      {/each}
    </div>
  </section>
{/if}

<style>
  .municipal-results{border-top:1px solid var(--color-rule)}
  .results-intro{max-width:80ch;margin:var(--space-5) 0 0;color:var(--color-muted);font:400 var(--text-lg)/1.6 var(--font-serif)}
  .municipal-contests{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-8);align-items:start}
  .municipal-contest{min-width:0;border:1px solid var(--color-rule-strong);background:var(--color-paper)}
  .contest-heading{display:flex;align-items:start;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3);padding:var(--space-5) var(--space-5) 0}
  .contest-heading>div{min-width:0}
  .contest-heading .eyebrow{margin:0 0 var(--space-2)}
  h3{margin:0;color:var(--color-ink);font:600 var(--text-3xl)/1.2 var(--font-serif);letter-spacing:-.025em;overflow-wrap:anywhere}
  .contest-source{display:inline-flex;align-items:center;gap:var(--space-2);padding:0;font-size:var(--text-xs)}
  .contest-provenance{margin:var(--space-3) var(--space-5) var(--space-5);color:var(--color-muted);font:400 var(--text-xs)/1.5 var(--font-sans)}
  .municipal-vote-table{width:100%;border-collapse:collapse;font:400 var(--text-sm)/1.5 var(--font-sans)}
  .municipal-vote-table th,.municipal-vote-table td{padding:var(--space-3) var(--space-5);text-align:left;border-bottom:1px solid var(--color-rule)}
  thead th{background:var(--color-warm-white);color:var(--color-muted);font-size:var(--text-2xs);font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-top:1px solid var(--color-rule-strong)}
  tbody th{font:600 var(--text-md)/1.5 var(--font-serif);overflow-wrap:anywhere}
  tbody a{display:inline-block;padding-block:var(--space-1);color:var(--color-blue);text-decoration:underline;text-underline-offset:3px}
  tbody a:hover{color:var(--color-blue-dark)}
  tbody tr:hover{background:var(--color-blue-tint)}
  .municipal-vote-table .numeric{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .write-in{display:block;color:var(--color-muted);font:400 var(--text-xs)/1.5 var(--font-sans)}
  .municipal-vote-table tfoot th,.municipal-vote-table tfoot td{border-top:1px solid var(--color-rule-strong);border-bottom:0;background:var(--color-warm-white);font-weight:700}
  @media(max-width:700px){.municipal-contests{grid-template-columns:1fr;gap:var(--space-6)}}
</style>
