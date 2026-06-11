# Portfolio — static site

This is a plain HTML/CSS/JS version of the portfolio. No build step, no npm.
It runs anywhere that serves static files, including **GitHub Pages**.

## Files

- `index.html` — the whole site (all styling + scripts are inside it)
- `images/` — project images
- `animations/ripple-surface.html` — the live 3D ripple embed (project 01)
- `favicon.svg`, `robots.txt`
- `.nojekyll` — tells GitHub Pages to serve every file as-is

## Put it on GitHub Pages

1. Make a new **public** repo on GitHub.
2. On the repo page: **Add file → Upload files**, then drag in *everything inside
   this folder* (the `index.html`, plus the `images` and `animations` folders).
   Keep the folder structure. `index.html` must sit at the top level.
3. **Commit changes.**
4. Go to **Settings → Pages**. Under **Branch** pick `main` and `/ (root)`, then **Save**.
5. Wait ~1 minute, refresh, and your link appears:
   `https://YOURUSERNAME.github.io/REPO-NAME/`

Tip: to use it as your *main* profile site at `https://YOURUSERNAME.github.io/`,
name the repo exactly `YOURUSERNAME.github.io`.

## Editing your content

Open `index.html` and look near the bottom for the `DATA` section. The
`projects`, `capabilities`, `languages`, and `socials` arrays hold all the text,
links, and image paths — change those and your site updates. No rebuild needed.

## Note on the language switcher

The EN/DE/HR switcher changes the displayed label only; the page copy stays in
English. Wiring up real translations would mean adding translated text for each
language — happy to do that if you want it.
