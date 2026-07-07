/* ── Shared embed runtime ────────────────────────────────────────────────
   Loaded by every animated embed before its own script.

   - The parent page (index.html) posts "pause"/"resume" as the embed's
     iframe scrolls out of / into view; loops check `embedPaused` each
     frame and skip work while true.
   - `REDUCED` is true when the user prefers reduced motion; embeds render
     a single static frame instead of looping.

   Top-level let/const in classic scripts share the global lexical scope,
   so the embed's own <script> sees both bindings directly.
──────────────────────────────────────────────────────────────────────── */
let embedPaused = false;
window.addEventListener('message', e => {
  if (e.data === 'pause') embedPaused = true;
  if (e.data === 'resume') embedPaused = false;
});

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
