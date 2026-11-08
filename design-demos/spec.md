# Kimeru interface exploration

## Shared brief

Create a precise, useful application interface for a self-hosted decision AI playground. Users supply state and named typed questions, execute against a saved provider connection/model, and inspect structured results. Preserve the product distinctions in `../CONTEXT.md` and the confirmed scope in `../docs/scope.md`.

All directions show the same illustrative product-listing inspection: a product photograph and JSON listing state; category (Choice), listing quality (Score), product present (Noul), product region (Box). Results are explicitly sample fixtures, not provider output. State, question instructions, provider choice, tabs, and run-preview interactions should work locally. No live requests or stored secrets in these design prototypes.

Show TypeSafe Jev as the active supporting model and Cloudflare Clef as an alternative. A Box question with Clef selected produces a clear capability explanation. Personal and administrator-shared connections must be distinguishable. Historical work is private. Administrator navigation manages accounts/connections, not other users' work.

## Shared presentation

- Full HTML direction: 1440 × 900 desktop target, responsive to 375 × 812. No horizontal mobile overflow.
- Font: Inter. Body at least 14px desktop, 16px mobile; labels at least 12px. Actual controls have 44px targets.
- shadcn preset `b50cyVY3s`, official neutral/pink/rose tokens. Source tokens and assets are under `assets/`.
- Photographic image is functional input to a Box question, not decorative stock art. Box geometry must align with the image and remain rectangular.
- Text and chart labels must remain readable and have adequate contrast. Do not conflate confidence with probability.
- Each standalone HTML embeds its font, logos, and photograph as data URLs for portability.
- All sample results are fixtures. Editing controls makes the fixture stale; running the preview clearly replays sample data rather than pretending to call a provider.
- Keep the production TanStack Start files unchanged until visual selection.

## Form questions

The narrative is an input-to-answer workflow, the viewer works at desktop distance, the temperature is calm and technical, density is moderate-to-high, and the visual motif is the relationship between typed questions and measurable results. No marketing hero or decorative dashboard metrics.
