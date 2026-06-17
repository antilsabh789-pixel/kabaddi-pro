---
name: Tailwind @theme inline dark mode
description: Why .dark CSS-variable palette overrides have no effect in this app, and the correct way to do dark mode.
---

# Tailwind `@theme inline` and dark mode

In `artifacts/kabaddi-pro/src/index.css`, the theme is declared with `@theme inline { ... }`.
With `inline`, Tailwind bakes the **literal** color value into each generated utility
(e.g. `.text-warm-800 { color: #1e293b }`) instead of emitting `color: var(--color-warm-800)`.

**Consequence:** a `.dark { --color-warm-800: ... }` palette-inversion block is **dead code** —
the utilities never reference the variable, so flipping the variable changes nothing. Any
base-only color utility (e.g. `text-warm-700`, `bg-warm-50` with no `dark:` sibling) keeps its
light-mode value in dark mode and can become invisible (dark text on dark bg, white card on dark bg).

**How to apply:** to fix dark-mode contrast, add explicit paired `dark:` utility variants
(`text-warm-800 dark:text-warm-100`, `bg-warm-50 dark:bg-warm-900`). Do NOT rely on CSS-variable
inversion. When sweeping classes programmatically, skip opacity classes (`bg-warm-50/90`) and
classes on fixed colored/brand backgrounds (gold/amber badges) so light text isn't placed on light bg.
