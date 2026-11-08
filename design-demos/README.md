# Kimeru design exploration

Open `index.html` for the comparison gallery, or serve this directory locally:

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory design-demos
```

Then visit http://127.0.0.1:4174/. Each `dir-N.html` is also standalone: the Inter font, provider logos, and photograph are embedded. These are interactive design prototypes with fixed illustrative results, not the production application.

## Verification

- Captured and visually inspected three desktop layouts and their full-page views at 1440 × 900, and mobile views at 375 × 812.
- All three mobile pages had document width 375px, with no horizontal overflow or broken images.
- Exercised provider switching, the Clef/Box incompatibility warning, logo loading, question/input edits, JSON display, overlay toggles, sample replay, and the notebook history dialog. No browser JavaScript errors occurred. Machine-readable results: `verification.json`.
- Used installed Node Playwright and Chromium. Huashu's Python lint/compare scripts skipped because Python Playwright is unavailable; no Python packages were installed. Structural differences and visual rendering were checked directly instead.
- The initial required Intent command found no locally installed Intent executable. No replacement was installed.
- The application's `src/`, package dependencies, and TanStack Start configuration have not been changed by this design exploration.

## Next gate

Wait for the user to select a direction or combination. Record their exact selection in `../direction-approved.md`, then implement the chosen application in TanStack Start according to `../docs/scope.md`.

Sources, exact theme tokens, and design rationale are in `assets/sources.md`, `assets/preset.css`, `directions.md`, and `../brand-spec.md`.
