<script lang="ts">
  export let title: string;
  export let intro: string;
  export let eyebrow = 'Election archive';
  export let photo: { src: string; position: string } | undefined = undefined;
</script>

<header class="index-header" class:has-photo={!!photo} style:--index-photo={photo ? `url("${photo.src}")` : undefined} style:--index-photo-position={photo?.position}>
  <div><p class="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
  <p>{intro}</p>
</header>

<style>
  .index-header.has-photo{position:relative;isolation:isolate;min-height:300px;background:#3b3a36;color:#fff}
  .has-photo::before,.has-photo::after{content:'';position:absolute;inset:0;pointer-events:none}
  .has-photo::before{z-index:-2;background:var(--index-photo) var(--index-photo-position,center)/cover no-repeat}
  .has-photo::after{z-index:-1;background:linear-gradient(180deg,rgba(17,17,16,.5),rgba(17,17,16,.78))}
  .has-photo h1,.has-photo .eyebrow,.has-photo>p{color:#fff}
</style>
