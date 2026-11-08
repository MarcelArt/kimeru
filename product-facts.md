# Kimeru product facts

Verified on 2026-11-08. Provider research and user-confirmed scope are separated below. Accepted architecture decisions are recorded in `docs/adr/`.

## Existing project and user constraints

- The repository contains a minimal TanStack Start app with React 19, Tailwind CSS v4, TanStack Query/Form/Table, and Zod. Preserve TanStack Start.
- The requested visual color source is shadcn preset `b50cyVY3s`. The official CLI resolved it to Lyra style, neutral base, pink theme, rose charts, Lucide icons, Inter font, inherited heading font, default radius, subtle menu accent, and default menu color. Use the official preset tokens when implementing. [Preset](https://ui.shadcn.com/create?preset=b50cyVY3s).
- The user requested an Open WebUI-like playground for TypeSafe System One with other providers, including Cloudflare Workers AI Clef.
- Initial inspection found no shadcn `components.json`, domain glossary, or ADRs. The glossary is now being captured in `CONTEXT.md` as the interview proceeds.
- Intent is not in the project dependencies or local executable directory. The required `npm exec --no -- intent list` attempted registry access and failed with `EAI_AGAIN`. No replacement was downloaded.

## Verified provider contracts

- TypeSafe System One evaluates named typed questions against shared state. Jev is its model. The API accepts `model`, `state`, and `questions` at `POST https://api.typesafe.ai/v1/systemone`, authenticated with a Bearer key. State may be text, an object, or an array. [Introduction](https://docs.typesafe.ai/introduction), [API reference](https://docs.typesafe.ai/api/system-one).
- Cloudflare Clef and Clef-flash support the shared Noul, Choice, and Score question types. Cloudflare explicitly documents System One compatibility. [Official announcement](https://developers.cloudflare.com/changelog/post/2026-10-01-clef-workers-ai/).
- Choice returns a selected option and a probability distribution. Score returns a probability-weighted value across ordered levels, which can be fractional. Noul returns a probability of truth rather than a thresholded boolean. [Choice](https://docs.typesafe.ai/primitives/choice), [Score](https://docs.typesafe.ai/primitives/score), [Introduction](https://docs.typesafe.ai/introduction).
- Confidence measures probability-distribution concentration, not the probability of the chosen answer. Noul has no separate confidence field. [Confidence](https://docs.typesafe.ai/confidence).
- Cloudflare REST needs an account ID and API token, and wraps the model result in an envelope. The REST path is `/client/v4/accounts/{ACCOUNT_ID}/ai/run/{modelId}`. Worker bindings offer a different transport. [REST documentation](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).
- Model IDs include `@cf/cloudflare/clef` and `@cf/cloudflare/clef-flash`. Model-specific constraints differ; current model pages give 65,536 context tokens for Clef and 24,576 for Clef-flash. Clef supports up to 64 questions. Avoid assuming identical limits for all providers. [Clef](https://developers.cloudflare.com/workers-ai/models/clef/), [Clef-flash](https://developers.cloudflare.com/workers-ai/models/clef-flash/).
- TypeSafe's current documentation identifies Jev 1.14 with image and Box support. Media schemas and capabilities differ across providers. [Models](https://docs.typesafe.ai/models), [API reference](https://docs.typesafe.ai/api/system-one).
- Box returns one rectangle per question with normalized `top`, `bottom`, `left`, and `right` edges plus confidence. It has no not-found response: a missing target can still produce coordinates. A Noul presence question can accompany Box when absence matters. Image/Box requests require the experimental image header. [Box](https://docs.typesafe.ai/primitives/box).
- TypeSafe image references are carried in an `assets` map; instructions identify the target image through state paths. The Box answer does not identify its image, so associating each Box question with its selected source image is an implementation requirement for correct overlays. Normalize image orientation and render coordinates against the actual image content, including any letterboxing. [Images](https://docs.typesafe.ai/images), [API reference](https://docs.typesafe.ai/api/system-one).
- Clef and Clef-flash accept images but their documented question schemas do not include Box. Image support and Box support must be represented separately; a Box question cannot silently be omitted when switching providers. [Clef](https://developers.cloudflare.com/workers-ai/models/clef/), [Clef-flash](https://developers.cloudflare.com/workers-ai/models/clef-flash/).

## User-confirmed scope

- This is a BYOK interface for testing decision AI models.
- Like Open WebUI, it saves provider base URLs and API keys. Instead of chat, users supply state, questions, type, instructions, criteria, and other applicable decision inputs.
- It is self-hosted and may be used by organizations. The user proposed registering the first account as administrator during initial setup.
- Include every decision type, including Box. Display Box results over the source image. Use a bounding rectangle to preserve returned geometry rather than force every result into a square.
- Support both personal provider connections and administrator-shared connections. Shared credentials are not revealed to users.
- Following first-admin setup, administrators create subsequent accounts; public registration is closed.
- Persist saved playgrounds, inputs, uploaded images, and run history privately for their owner. Administrator status does not automatically permit viewing other users' work.
- Deploy on a single server with Docker, SQLite, and a persistent volume for uploads.

## Unsettled design decisions

- The consolidated scope in `docs/scope.md` was confirmed by the user with “yes continue.”
- Visual direction: three-direction exploration is in progress; user selection is pending.

The domain glossary lives in `CONTEXT.md`. Record additional ADRs only for substantive trade-offs.
