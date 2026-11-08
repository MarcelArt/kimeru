---
name: Kimeru
description: 'Decision Workbench: compact, precise tools for evaluating models.'
colors:
  background: oklch(0.145 0 0)
  foreground: oklch(0.985 0 0)
  card: oklch(0.205 0 0)
  primary: oklch(0.459 0.187 3.815)
  primary-foreground: oklch(0.971 0.014 343.198)
  secondary: oklch(0.274 0.006 286.033)
  secondary-foreground: oklch(0.985 0 0)
  muted: oklch(0.269 0 0)
  muted-foreground: oklch(0.708 0 0)
  border: oklch(1 0 0 / 10%)
  input: oklch(1 0 0 / 15%)
  ring: oklch(0.556 0 0)
  sidebar-primary: oklch(0.656 0.241 354.308)
  destructive: oklch(0.704 0.191 22.216)
  light-background: oklch(1 0 0)
  light-foreground: oklch(0.145 0 0)
  light-card: oklch(1 0 0)
  light-primary: oklch(0.525 0.223 3.958)
  light-secondary: oklch(0.967 0.001 286.375)
  light-secondary-foreground: oklch(0.21 0.006 285.885)
  light-muted: oklch(0.97 0 0)
  light-muted-foreground: oklch(0.556 0 0)
  light-border: oklch(0.922 0 0)
  light-input: oklch(0.922 0 0)
  light-ring: oklch(0.708 0 0)
  light-sidebar-primary: oklch(0.592 0.249 0.584)
  light-destructive: oklch(0.577 0.245 27.325)
  light-sidebar: oklch(0.985 0 0)
  chart-1: oklch(0.81 0.117 11.638)
  chart-2: oklch(0.645 0.246 16.439)
  chart-3: oklch(0.586 0.253 17.585)
  chart-4: oklch(0.514 0.222 16.935)
  chart-5: oklch(0.455 0.188 13.697)
typography:
  headline:
    fontFamily: Inter Variable, sans-serif
    fontSize: 25px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.8px
  title:
    fontFamily: Inter Variable, sans-serif
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: Inter Variable, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-mobile:
    fontFamily: Inter Variable, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter Variable, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  badge:
    fontFamily: Inter Variable, sans-serif
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
  code:
    fontFamily: ui-monospace, "SFMono-Regular", Consolas, monospace
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
  code-small:
    fontFamily: ui-monospace, "SFMono-Regular", Consolas, monospace
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.8
  answer:
    fontFamily: Inter Variable, sans-serif
    fontSize: 23px
    fontWeight: 550
    lineHeight: 1.4
    letterSpacing: -0.5px
  answer-numeric:
    fontFamily: Inter Variable, sans-serif
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -1px
rounded:
  square: 0px
  nav: 3px
  container: 4px
  toast: 0.625rem
spacing:
  tight: 6px
  small: 8px
  group: 12px
  form: 14px
  medium: 16px
  pane: 18px
  gutter: 20px
  large: 24px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.square}'
    padding: 0px 10px
    height: 32px
  button-outline:
    backgroundColor: color-mix(in oklab, var(--input) 30%, transparent)
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.square}'
    padding: 0px 10px
    height: 32px
  button-ghost:
    backgroundColor: transparent
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.square}'
    padding: 0px 10px
    height: 32px
  button-destructive:
    backgroundColor: color-mix(in oklab, var(--destructive) 20%, transparent)
    textColor: '{colors.destructive}'
    typography: '{typography.body}'
    rounded: '{rounded.square}'
    padding: 0px 10px
    height: 32px
  input:
    backgroundColor: color-mix(in oklab, var(--input) 30%, transparent)
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.square}'
    padding: 4px 10px
    height: 32px
  nav-item:
    backgroundColor: transparent
    textColor: '{colors.muted-foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.nav}'
    padding: 6px 10px
  badge-outline:
    backgroundColor: transparent
    textColor: '{colors.foreground}'
    typography: '{typography.badge}'
    rounded: '{rounded.square}'
    padding: 2px 8px
    height: 20px
  connection-card:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.container}'
    padding: 14px 16px 6px
  state-format:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.square}'
    padding: 2px
    height: 32px
  question-disclosure:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.container}'
---

# Design System: Kimeru

## Overview

**Creative North Star: "Decision Workbench"**

Kimeru is compact, precise, and restrained. Neutral surfaces keep structured inputs and results prominent; selective Deep Rose accents identify primary actions, active navigation, and data. Inter provides a consistent working voice, with monospace reserved for code, identifiers, and machine-readable values.

The system feels like a set of precise tools: square controls, shallow container corners, thin separators, and flat tonal layers. Dark is the default, and the Paper light theme carries the same hierarchy and density. Use the existing 決 artwork with the lowercase wordmark; asset provenance and provider marks remain governed by [brand-spec.md](brand-spec.md).

**Key Characteristics:**

- Compact desktop controls with larger touch targets.
- Charcoal or Paper surfaces with selective Deep Rose accents.
- Flat, bordered containers and familiar form controls.
- Clear separation of prose, code, and quantitative results.
- Persistent navigation that can reduce to an accessible icon rail.

This is a record of the implemented system. Color values come from [src/styles.css](src/styles.css); layout and application overrides come from [application.css](src/components/playground/application.css); component variants come from [src/components/ui](src/components/ui). Keep this record and those sources aligned when changing the system. The frontmatter uses the [DESIGN.md format](https://raw.githubusercontent.com/google-labs-code/design.md/main/docs/spec.md). Interaction examples and schema extensions live in [.impeccable/design.json](.impeccable/design.json).

## Colors

Deep Rose gives a neutral Charcoal / Paper palette its identity. The frontmatter preserves the preset's native OKLCH values; unprefixed colors describe the default dark theme, and `light-` tokens describe light-theme counterparts. Shared colors, including the rose chart series and primary foreground, have one entry.

The sidecar's generated tonal strips are preview aids, not additional runtime palette steps.

### Primary

- **Deep Rose** (`primary`, `light-primary`): filled primary actions such as Run questions and form submission. Use the shared pale primary foreground for their text.
- **Signal Rose** (`sidebar-primary`, `light-sidebar-primary`): active navigation icons, selected disclosure accents, and image-region outlines. Its brighter tone serves small marks.
- **Rose series** (`chart-1` through `chart-5`): ordered probability bars. Their labels and numeric values carry meaning alongside color.

### Neutral

| Role | Dark token | Light token | Runtime assignment |
| --- | --- | --- | --- |
| Canvas | `background` — Charcoal | `light-background` — Paper | `--background` |
| Main text | `foreground` | `light-foreground` | `--foreground` |
| Containers and menus | `card` | `light-card` | `--card`, `--popover` |
| Sidebar | `card` | `light-sidebar` | `--sidebar` |
| Muted surfaces and hover | `muted` | `light-muted` | `--muted`, `--accent` |
| Supporting text | `muted-foreground` | `light-muted-foreground` | `--muted-foreground` |
| Secondary badges | `secondary`, `secondary-foreground` | `light-secondary`, `light-secondary-foreground` | `--secondary`, `--secondary-foreground` |
| Dividers and fields | `border`, `input` | `light-border`, `light-input` | `--border`, `--input` |
| Focus indication | `ring` | `light-ring` | `--ring` |

Destructive red is a semantic exception for errors and destructive actions. Toast success/error colors belong to the existing theme-aware Sonner component; they are not additional brand accents.

**The Semantic Color Rule.** Apply runtime semantic variables so surfaces, controls, and overlays change together between themes. The paired frontmatter colors document their values; they are not a reason to hardcode a dark color into a component.

The theme toggle appears in the workspace and authentication header. It explicitly selects dark or light, preserves the browser preference, and changes themes without a crossfade; it does not follow the operating-system theme.

## Typography

Inter Variable is the shared heading and body family, with a sans-serif fallback. The code stack is `ui-monospace, "SFMono-Regular", Consolas, monospace`. Hierarchy comes from size, weight, and placement rather than a separate display face.

| Frontmatter role | Application |
| --- | --- |
| `headline` | Workspace and management headings; the mobile workspace title reduces to 21px. |
| `title` | Section headings; mobile editor sections use 16px. |
| `body` / `body-mobile` | General UI text and inherited form-control text. |
| `label` | Supporting explanations, field labels, and metadata that need sustained reading. |
| `badge` | The reusable badge primitive; local type and status badges use smaller overrides. |
| `code` | State editor; mobile editing increases to 16px. |
| `code-small` | Raw JSON; model identifiers also use compact monospace. |
| `answer` / `answer-numeric` | Selected answers and prominent quantitative results. |

Authentication headings have a local larger treatment (29px desktop, 26px mobile). The lowercase wordmark has its own weight and tracking; reuse its existing styling.

**The Code Boundary Rule.** Use monospace for JSON, question IDs, model IDs, URLs, and numeric machine values. Keep explanations and action labels in Inter.

The global form reset makes default buttons and fields inherit body typography. Primitive utility classes alone therefore do not describe the rendered type. Small status badges and incidental metadata still contain 10–11px exceptions; those are existing local treatments, not a general label size to copy into new forms or instructions.

## Layout

Use a full-height working canvas with a persistent library beside the main area. The current playground places the editor and results side by side, separated by a thin border. Management pages use a centered content area with a maximum width of 1320px; authentication uses a narrow form up to 420px wide.

| Viewport | Implemented layout |
| --- | --- |
| Above 1180px | Sidebar 220px; editor/results columns `minmax(390px, 1.05fr) minmax(340px, 1fr)`. |
| 951–1180px | Sidebar 190px; columns `minmax(320px, 1fr) minmax(300px, 1fr)`; connection cards stack. |
| 681–950px | Sidebar remains; editor and results stack; connection toolbar wraps. |
| 680px and below | Sidebar becomes a fully labeled drawer; page gutters are 16px and Run spans the toolbar width. |
| 1700px and above | Equal workspace columns with 500px / 440px minimums; pane gutters increase to 24px. |

At desktop widths, collapsing navigation reduces it to a 64px icon rail. The mobile drawer is `min(290px, 100vw - 36px)` wide and fills the viewport height, regardless of the saved desktop preference.

The spacing vocabulary is compact and pragmatic, not a strict eight-point grid. Default panes use 18px top, 20px horizontal, and 24px bottom padding; intermediate panes use 16px horizontal padding; mobile panes use 16px top/horizontal and 20px bottom padding. The top bar and connection toolbar are at least 48px tall on desktop.

**The Density Rule.** Keep ordinary desktop controls at a 32px minimum height. At 680px and below, or with a coarse pointer, raise those controls to 44px. Grow the containing tracks too: Text/JSON and result tabs use 50px tracks around 44px targets. Authentication fields use 36px on desktop and 44px for touch.

These measurements describe the implemented application layouts. They do not prescribe the composition of unrelated future surfaces.

## Elevation & Depth

The default surface is flat. One-pixel borders and tonal changes separate cards, toolbars, questions, and working panes. The results pane blends the card tone at 32% with the canvas. Avoid adding shadows to ordinary cards merely to separate content.

Floating select menus use the existing soft menu shadow and a foreground-tinted outline. Dialogs use an outline over a faint black overlay with a supported 4px backdrop blur. The Box result has a narrow contrast halo around its colored outline so it remains legible against source imagery. Exact shadow expressions are recorded in the sidecar.

State transitions use the existing short timings: ordinary primitive transitions are 150ms, and dialog/menu transitions are 100ms. The mobile navigation drawer has no entrance animation. Reduced-motion styling disables transitions and smooth scrolling; it currently does not disable all animations, so do not describe it as a complete animation-reduction implementation.

## Shapes

Primitives are square: buttons, select triggers, badges, tabs, and ordinary inputs use the `square` token. Custom navigation rows and question fields use `nav` corners; question wrappers, connection cards, the state editor, and the toolbar use `container` corners. Containers are outlined rather than padded into rounded tiles.

The preset's base radius is retained by toast notifications, recorded as `toast` in the frontmatter. Most workspace controls override it; do not apply it everywhere. The 決 mark has its own asset geometry and should be used as supplied.

## Components

### Buttons

Precise, square controls. Primary buttons carry Deep Rose; outline buttons carry secondary actions such as Save; ghost buttons carry tools and navigation utilities; tinted destructive buttons appear in removal confirmations. Standard desktop buttons use 10px horizontal padding and a 6px icon gap. Hover changes the surface, keyboard focus adds a border/ring, and ordinary button presses move down by one pixel. Disabled buttons reduce opacity and cannot be activated. Preserve accessible names on icon-only controls.

### Inputs and selectors

Thin outlines and restrained fills keep content prominent. Fields have a ring on keyboard focus, a destructive border/ring when invalid, and a muted disabled state. The state editor uses a shallow corner and monospace text. The title field is a local borderless exception with an underline while editing.

Use the existing shared dropdown for provider, model, question type, and role selections. Model names remain monospace; available options combine known, discovered, and selected values, with a separate dialog for entering a custom model name. Text/JSON is a single-selection control: one option stays selected, and both segments stay inside their track. Result Overview / Raw JSON uses tabs.

### Badges and containers

Badges are compact square labels, chiefly outlined. They identify question types, connection scope, and run state; they are not primary actions. Connection cards use a tonal surface, a thin border, shallow corners, and a separated action footer. Results use flat sections with separators instead of wrapping every answer in another card.

### Navigation

Muted labels become foreground text on hover or selection; active icons use Signal Rose. Desktop collapse hides labels while preserving icon names, titles, and current-page state. Saved items use file icons in the rail. Mobile navigation always displays labels. Sidebar and theme preferences survive reloads.

### Questions

Questions use native disclosure rows: a code identifier, type badge, and expansion indicator. Removal remains available while a question is collapsed, with its button outside the disclosure trigger. After removal, focus moves to an adjacent question or Add question. Rows are at least 40px on desktop and 48px for touch.

### Results

Keep each result's visual meaning intact: Choice shows labeled probability bars; Score emphasizes a weighted score and its distribution; Noul shows truth probability; Box overlays a rectangle on its associated image. Probability tracks are thin (5px), with numeric values alongside. Confidence is a separate annotated value where supported. Preserve the source image's aspect ratio and scale its Box overlay with it; Raw JSON remains available for inspection.

## Do's and Don'ts

### Do:

- **Do** reuse semantic colors and verify the same component in dark and light themes.
- **Do** preserve compact desktop spacing while keeping touch controls and their tracks large enough.
- **Do** retain names and visible focus states when navigation or tools become icon-only.
- **Do** use existing dropdowns, tabs, and single-selection controls for their established roles.
- **Do** keep question removal available in the collapsed row.
- **Do** preserve labels, numeric values, and image alignment in result visualizations.

### Don't:

- **Don't** replace square primitives with large rounded controls or shadowed cards.
- **Don't** enlarge global control minima without checking nested tabs and segmented tracks.
- **Don't** treat the preset's base radius or tiny metadata exceptions as universal defaults.
- **Don't** replace supplied brand/provider assets with decorative Unicode symbols.
- **Don't** use color alone to distinguish quantitative results or imply that confidence is answer probability.
