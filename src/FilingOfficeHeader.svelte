<script lang="ts">
  import { officesById, partiesById, placesById, sectionLabel, runningMateRole, type Filing } from './lib/entities';
  import { officeProfile } from './lib/entity-profiles';
  import { officeMap, utahOutline, type BoundaryMap } from './lib/boundary-maps';

  export let filing: Filing;
  export let personId = filing.personId;
  export let navigate: (href: string) => void;
  $: office = officesById.get(filing.officeId);
  $: profile = office ? officeProfile(office, placesById) : undefined;
  const statewideBoundary: BoundaryMap = { ...utahOutline, title: 'Utah', note: 'Statewide jurisdiction.', locator: false };
  $: boundary = office ? officeMap(office, placesById) ?? (profile?.scope === 'Statewide — Utah' ? statewideBoundary : null) : null;
  $: period = profile?.boundaryPeriod?.match(/(\d{4})\D+(\d{4})/);
  $: outsidePeriod = !!period && (filing.year < Number(period[1]) || filing.year > Number(period[2]));
  $: party = partiesById.get(filing.partyId);

  function open(event: MouseEvent, href: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(href);
  }
</script>

<div class="filing-heading" class:with-minimap={!!boundary}>
  <div class="filing-heading-copy">
    <div class="filing-cycle"><a class="filing-year" href={`/elections/${filing.year}/`} onclick={(event) => open(event, `/elections/${filing.year}/`)} aria-label={`${filing.year} election`}><time datetime={String(filing.year)}>{filing.year}</time></a><small>{sectionLabel(filing.section)}{#if filing.runningMateId === personId}{' · '}{runningMateRole(filing)} candidate{/if}</small></div>
    <h3><a href={`/offices/${filing.officeId}/`} onclick={(event) => open(event, `/offices/${filing.officeId}/`)}>{filing.officeName}</a></h3>
    <p class="filing-party"><a class="filing-party-link" href={`/parties/${filing.partyId}/`} onclick={(event) => open(event, `/parties/${filing.partyId}/`)}>{#if party?.logo}<span class="filing-party-logo" class:inverse-logo={filing.partyId === 'utah-republican-party'} style:--party-color={party.color}><img src={party.logo} alt="" loading="lazy" decoding="async" /></span>{/if}<span>{filing.partyName}</span></a></p>
  </div>
  {#if boundary}
    <a class="filing-minimap" href={`/offices/${filing.officeId}/`} onclick={(event) => open(event, `/offices/${filing.officeId}/`)} aria-label={`${boundary.title}: view office boundary and jurisdiction`}>
      <img src={boundary.src} width={boundary.width} height={boundary.height} alt={`Boundary of ${boundary.title}`} loading="lazy" decoding="async" />
      <span>{profile?.boundaryPeriod ?? 'Current office boundary'}{#if outsidePeriod}<br />Current reference map{/if}</span>
    </a>
  {/if}

    {#if filing.runningMate}<dl><div><dt>Running mate</dt><dd><a href={`/people/${filing.runningMateId === personId ? filing.personId : filing.runningMateId}/`} onclick={(event) => open(event, `/people/${filing.runningMateId === personId ? filing.personId : filing.runningMateId}/`)}>{filing.runningMateId === personId ? filing.name : filing.runningMate}</a></dd></div></dl>{/if}
</div>

<style>
  .filing-heading{min-width:0}
  .with-minimap{display:grid;grid-template-columns:minmax(0,1fr) 160px;column-gap:var(--space-5);row-gap:0;align-items:start}
  .filing-heading-copy{min-width:0}
  .filing-heading h3{margin:var(--space-3-5) 0 var(--space-2);font:700 var(--text-3xl)/1.15 var(--font-serif);letter-spacing:-.025em;overflow-wrap:anywhere}
  .filing-party{min-width:0;margin:var(--space-3) 0 0}
  .filing-party :global(.filing-party-link){max-width:100%;overflow-wrap:anywhere}
  .filing-heading>dl{grid-column:1/-1}
  .filing-minimap{display:flex;flex-direction:column;align-items:center;gap:var(--space-1);min-width:0;color:var(--color-muted);text-align:center}
  .filing-minimap img{display:block;width:100%;height:130px;object-fit:contain;background:var(--color-warm-white);border:1px solid var(--color-rule-soft)}
  .filing-minimap>span{font-size:var(--text-2xs);line-height:1.4}
  .filing-minimap:hover img{border-color:var(--color-blue)}
  @container (max-width:430px){
    .with-minimap{grid-template-columns:minmax(0,1fr) 96px;column-gap:var(--space-3)}
    .filing-minimap img{height:104px}
    .filing-cycle{gap:var(--space-2)}
    .filing-year{font-size:var(--text-3xl);padding:var(--space-2)}
    .filing-cycle small{flex-basis:100%;overflow-wrap:anywhere}
    .filing-heading h3{font-size:var(--text-2xl)}
  }
  @media(max-width:400px){.with-minimap{grid-template-columns:minmax(0,1fr) 88px;column-gap:var(--space-3)}.filing-minimap img{height:96px}}
</style>
