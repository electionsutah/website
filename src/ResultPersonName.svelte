<script lang="ts">
  import { resultPerson, personHref } from './lib/result-people';
  import type { Contest } from './lib/results';
  export let name: string;
  export let contest: Contest;
  $: person = resultPerson(name, contest);
</script>

{#if person}<a class="result-person-link" href={personHref(person)} title={`View ${person.name}’s person record`}>{name}</a>{:else}{name}{/if}
