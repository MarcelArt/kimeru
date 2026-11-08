# Visual direction selection

Status: approved combined direction.

The user confirmed the product scope with “yes continue.” That authorizes the design exploration, not selection of a visual direction.

Three standalone interactive HTML drafts are presented:

- A — Split workbench: `design-demos/dir-1.html`, desktop `dir-1.png`, full-page `dir-1-full.png`, mobile `dir-1-mobile.png`.
- B — Focused notebook: `design-demos/dir-2.html`, desktop `dir-2.png`, full-page `dir-2-full.png`, mobile `dir-2-mobile.png`.
- C — Visual inspector: `design-demos/dir-3.html`, desktop `dir-3.png`, full-page `dir-3-full.png`, mobile `dir-3-mobile.png`.

All paths above are relative to `design-demos/` except the explicitly prefixed HTML paths. Six early candidates are in `design-demos/thumbs.html` and `design-demos/thumbs.png`; the comparison gallery is `design-demos/index.html`.

User's exact selection: “I like the styling of C but the layout of A”.

Implement A's persistent library and split editor/results layout with C's dark neutral surfaces, compact typography, restrained borders, and pink accents. This selection authorizes application implementation in the existing TanStack Start project.
