# Kimeru

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are developers evaluating and integrating decision AI models. They need to configure provider access, experiment with structured inputs and questions, and inspect results before using a model in their own applications.

Kimeru supports individual self-hosters and organizations. Administrators provision accounts and shared provider connections; that role does not grant application-level access to other users' private work.

## Product Purpose

Kimeru is a self-hosted, bring-your-own-key playground for testing decision AI models. Users supply state and typed questions, execute them through a selected provider and model, and inspect the returned decisions.

Success means a developer can understand what inputs produced a result, inspect the answer using the semantics of its question type, and revisit or export the run without losing its original context.

## Positioning

The product applies the saved-provider and workspace model familiar from Open WebUI to structured decision evaluation. Its central objects are state, typed questions, and runs rather than chat conversations. Personal and administrator-shared provider access coexist with private saved work.

## Operating Context

- Configure a provider connection with its base URL and credentials, select a model, supply text or JSON state and optional images, compose named questions, run, and inspect results.
- Save unfinished playgrounds for continued editing. Revisit immutable run snapshots and export runs as JSON; subsequent playground edits must not rewrite a historical run's inputs or results.
- Bootstrap the first administrator during initial setup. After setup, administrators create additional accounts; public registration is closed.
- Deploy on one server using Docker, SQLite, and persistent image storage. Backups must retain the database, uploaded images, and the original encryption key together.
- Provider requests originate on the Kimeru server and may incur provider charges. The server operator controls the storage and secrets even though application accounts have separate access boundaries.

## Capabilities and Constraints

- Preserve the existing TanStack Start application. The implementation uses React, TypeScript, Tailwind CSS, shadcn components, and Node's built-in SQLite; current runtime and setup requirements live in `README.md`.
- Support Choice, Score, Noul, and Box questions. Display choice distributions, probability-weighted scores, truth probabilities, and image regions according to their distinct meanings. Model-reported confidence is not selected-answer probability; Noul has no separate confidence field.
- Each Box question targets a specific attached image. Preserve that association and render the returned rectangle aligned with the source image as it scales. A returned box does not establish that the target exists; a separate presence question can be used when absence matters.
- TypeSafe System One/Jev and Cloudflare Workers AI Clef are the initial integrations. Configurable base URLs must implement the corresponding decision API contract; a generic OpenAI-compatible chat endpoint is insufficient.
- Model capabilities govern supported question types and media. The current Clef integration does not support Box. Explain incompatibilities rather than silently dropping questions. Provider-specific limits belong in the adapters and current operational documentation, not permanent product promises.
- Personal connections are available only to their owner. Administrators manage shared connections, which enabled users can use without receiving the stored credentials. Credentials stay server-side and are encrypted at rest.
- Saved playgrounds, uploaded images, and run history remain private to their owner, including from other administrators through the application.
- Preserve at least one enabled administrator. The current scope excludes public signup, email-based password recovery, SSO, account invitations, multi-replica operation, and automatic encryption-key rotation.
- Use the terminology in `CONTEXT.md`: provider connection, personal connection, shared connection, playground, state, question, run, result, and Box. Do not recast the workflow as chat or label arbitrary rectangles as squares.

## Brand Commitments

Preserve the name Kimeru and the user-approved direction recorded in `direction-approved.md`: “the styling of C but the layout of A.” The binding implementation constraint is the official shadcn preset `b50cyVY3s`, with A's persistent library and split editor/results layout and C's dark styling. These are existing commitments, not a new visual direction established by this record.

No custom brand mark has been supplied; existing drafts use a typographic wordmark. Asset provenance and provider identification rules are recorded in `brand-spec.md` and `design-demos/assets/sources.md`.

## Evidence on Hand

- `docs/scope.md` records the confirmed product scope. The user reconfirmed that scope during Impeccable init and identified developers evaluating and integrating decision models as the primary audience.
- `README.md` records implemented behavior, setup, operational limits, privacy boundaries, and verification commands. `docs/adr/` records the storage and account-isolation decisions.
- `src/` contains the application; `src/server/*.test.ts` and `tests/browser/workspace.spec.ts` contain automated checks. Provider fixtures demonstrate expected contracts, not live provider availability, model accuracy, or token permissions.
- `design-demos/` contains earlier visual explorations, screenshots, and illustrative inputs/results. `direction-approved.md` records the selected direction; older exploration notes claiming that selection is pending are historical.
- `design-demos/assets/sources.md` records sample-image and asset provenance. Demo probabilities, scores, and coordinates are illustrative, not measured provider outcomes. Do not present fixtures as benchmarks or invent testimonials, customers, or performance claims.

## Product Principles

1. Preserve the semantics of each decision type so developers can interpret results accurately.
2. Keep every historical result attached to the inputs, model, and images that produced it.
3. Share provider access without exposing credentials or other users' saved work.
4. Make model incompatibilities explicit before execution rather than silently changing the experiment.
5. Keep self-hosting and persistence understandable within the confirmed single-server scope.

## Open Decisions

No product-specific accessibility standard, additional inclusion requirement, or distinct editorial voice was established during init. These remain unconfirmed rather than implied commitments.
