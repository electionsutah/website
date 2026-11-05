<script lang="ts">
  export let title: string;
  export let intro: string;
  export let eyebrow = 'Election archive';
  export let photo: { src: string; position: string } | undefined = undefined;
</script>

<header class="index-header" class:has-photo={!!photo} style:--index-photo={photo ? `url("${photo.src}")` : undefined} style:--index-photo-position={photo?.position}>
  {#if photo}
    <!-- Blue duotone: luminance mapped from deep navy (shadows) to light site blue (highlights). -->
    <svg class="duotone-defs" aria-hidden="true" focusable="false">
      <filter id="index-photo-duotone" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.004 0.424" />
          <feFuncG type="table" tableValues="0.133 0.722" />
          <feFuncB type="table" tableValues="0.227 0.918" />
        </feComponentTransfer>
      </filter>
    </svg>
  {/if}
  <div><p class="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
  <p>{intro}</p>
</header>

<style>
  .index-header.has-photo{position:relative;isolation:isolate;min-height:300px;background:#01223a;color:#fff}
  .duotone-defs{position:absolute;width:0;height:0;overflow:hidden}
  .has-photo::before,.has-photo::after{content:'';position:absolute;inset:0;pointer-events:none}
  .has-photo::before{z-index:-2;background:var(--index-photo) var(--index-photo-position,center)/cover no-repeat;filter:url(#index-photo-duotone)}
  .has-photo::after{z-index:-1;background:linear-gradient(180deg,rgba(1,34,58,.3),rgba(1,34,58,.7))}
  .has-photo h1,.has-photo .eyebrow,.has-photo>p{color:#fff}
</style>
