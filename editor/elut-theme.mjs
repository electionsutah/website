import { readFile } from 'node:fs/promises';

/** Read the site's source of truth so editor tokens and font files cannot drift. */
export async function elutThemeCss() {
  const source = await readFile(new URL('../src/app.css', import.meta.url), 'utf8');
  const tokens = source.match(/@theme static\s*\{([\s\S]*?)\n\}/)?.[1];
  if (!tokens?.includes('--color-blue:') || !tokens.includes('--font-sans:')) throw new Error('ELUT design tokens not found');
  const fonts = source.match(/@font-face\{[^}]+\}/g)?.filter(rule => !rule.includes('Material Symbols')) ?? [];
  return `${fonts.join('\n')}\n:root {${tokens}
    --decap-text:var(--color-muted);--decap-textLead:var(--color-text);
    --decap-background:var(--color-page);--decap-foreground:var(--color-paper);
    --decap-active:var(--color-blue);--decap-activeBackground:var(--color-blue-tint);
    --decap-buttonText:var(--color-paper);--decap-inputBackground:var(--color-paper);
    --decap-textFieldBorder:var(--color-rule-strong);--decap-controlLabel:var(--color-muted);
    --decap-infoBackground:var(--color-blue-tint);--decap-infoText:var(--color-blue-dark);
    --decap-errorBackground:var(--color-red-tint);--decap-errorText:var(--color-salmon-dark);
    --decap-font-primary:var(--font-sans);--decap-font-mono:var(--font-mono);--decap-radius:0px;
    font:400 var(--text-base)/1.5 var(--font-sans);color:var(--color-text);background:var(--color-page);
  }`;
}
