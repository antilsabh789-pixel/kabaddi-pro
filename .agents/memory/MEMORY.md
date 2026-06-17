# Memory Index

- [Tailwind @theme inline dark mode](tailwind-theme-inline-dark-mode.md) — `@theme inline` bakes literal colors; `.dark` CSS-var overrides are dead code, must use paired `dark:` utilities.
- [API trust model](api-trust-model.md) — no server session layer; endpoints trust client-supplied ids; recover identity by exact unique-phone match, never endsWith/findFirst.
- [Git push workflow](git-push-workflow.md) — committing is blocked in main-agent bash; push needs a valid token in the URL.
