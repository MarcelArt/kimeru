# Kimeru design context

The product name comes from the existing repository. Kimeru uses the user-selected kanji **決** as its brand mark alongside the lowercase wordmark. The production logo is `public/brand/kimeru.svg`; the browser favicon (`public/favicon.ico`) and Apple touch icon (`public/apple-touch-icon.png`) use the same artwork. Earlier interface drafts retain their historical branding. The application colors come from the requested shadcn preset `b50cyVY3s`, captured in `design-demos/assets/preset.css`: neutral surfaces, pink primary, rose charts, Inter.

The mark outlines the 決 (U+6C7A) glyph from Noto Sans CJK JP Bold (SIL Open Font License 1.1) so it does not depend on installed Japanese fonts. Its silhouette occupies 74% of a square with 12% corner radii. The colors `#a3004c` and `#fdf2f8` are sRGB equivalents of the existing dark primary and primary-foreground tokens. PNG and ICO assets are rasterized from the SVG; no image generation model is used.

Provider identification uses the official TypeSafe favicon and Cloudflare cloud symbol, referenced in `design-demos/assets/sources.md`. These marks are not recolored or redrawn. The mug photograph is a real, licensed sample input for the Box workflow; it is not decorative background imagery. Its overlays and result values are explicitly illustrative.

Interface references were captured from Open WebUI's official interface redesign article and the live Hoppscotch application. Screenshots are under `design-demos/references/`; the observed rules informing each direction are in `design-demos/directions.md`. The Python reference-board helper was unavailable because Python Playwright is absent; the installed Node Playwright was used to capture the sources instead.

The exact preset is shared across directions. A and B use its light tokens, C uses its dark tokens. Contrast-sensitive highlights may use the existing sidebar-primary or chart token rather than inventing another color. Typography prioritizes working content and readable controls; image regions and distributions are the principal visual material.
