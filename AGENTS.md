# Project instructions

## Browser checks

Use Synaptic Code’s `preview_*` browser tools for browser checks. Do not launch Chrome or Playwright from sandboxed shell commands. If a test requires standalone Playwright, run it through a specifically authorized runner outside the agent’s shell sandbox, using a temporary browser profile.

## Sources and notes

Always prefer the existing evidence popover pattern (`evidence-popover` with `anchoredPopover`) over `<details>` for sources and notes anywhere on the site. Reuse its shared styles, anchored positioning, and close control.

## HTML reports

Always give generated HTML reports a `<body>` margin of `3rem`.

Generated reports must link relevant existing ELUT entities and place source links alongside the claims they support.
