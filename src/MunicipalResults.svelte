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
    <div class="record-heading"><p class="eyebrow compact">Official county returns</p><h2>Municipal election results</h2></div>
    <p>Candidate vote totals from published county returns. Council voters may select multiple candidates; these totals are votes, not ballots or turnout. Winner status is not assigned here.</p>
    {#each contests as contest}
      {@const popoverId = `municipal-result-${contest.id}`}
      <h3>{contest.year} · {contest.municipality} · {contest.office}</h3>
      <div class="entity-table-wrap"><table class="entity-table"><thead><tr><th scope="col">Candidate</th><th scope="col">Votes</th></tr></thead><tbody>
        {#each contest.options as option}<tr><th scope="row">{#if option.personId}<a href={`/people/${option.personId}/`}>{option.name}</a>{:else}{option.name}{/if}{#if option.writeIn}<small> · Write-in</small>{/if}</th><td>{option.votes.toLocaleString('en-US')}</td></tr>{/each}
      </tbody><tfoot><tr><th scope="row">Total candidate votes</th><td>{contest.totalCandidateVotes.toLocaleString('en-US')}</td></tr></tfoot></table></div>
      <button class="place-election-toggle" popovertarget={popoverId}>Result source &amp; notes</button>
      <div class="evidence-popover" id={popoverId} popover="auto" use:anchoredPopover={popoverId}>
        <header><strong>{contest.year} · {contest.municipality} results</strong><button popovertarget={popoverId} popovertargetaction="hide" aria-label="Close result source"><Icon name="close" /></button></header>
        <p>Election date: {contest.electionDate}. {contest.seats ? `${contest.seats} seat${contest.seats === 1 ? '' : 's'}.` : 'Seat count not verified.'}</p>
        {#each contest.notes as note}<p>{note}</p>{/each}
        <a href={contest.source} target="_blank" rel="noreferrer">Official county results <Icon name="arrow_outward" /><span class="sr-only"> (opens in new tab)</span></a>
      </div>
    {/each}
  </section>
{/if}
