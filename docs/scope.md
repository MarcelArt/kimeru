# Kimeru confirmed scope

Kimeru is a self-hosted BYOK playground for testing decision AI models. Its core flow is: configure a provider connection, select a model, supply state and typed questions, run the model, and inspect the returned decisions.

## Agreed product behavior

### Accounts and connections

- First-time setup registers the initial administrator. After setup, administrators create accounts.
- Users can save personal provider connections with base URLs and API keys.
- Administrators can create shared connections that users can execute against without seeing the keys.
- Provider setup includes additional required fields, such as Cloudflare account ID.
- Credentials and outbound provider requests are handled server-side.

### Playground

- Enter text or JSON state and attach images as supported by the selected model.
- Add named questions with a type, instructions, and the criteria applicable to that type.
- Support Choice, Score, Noul (truth probability), and Box.
- Save playgrounds and revisit run history. Inputs, uploaded images, and results belong to the user; the administrator role does not automatically expose them.
- Keep execution inputs associated with their historical result so later edits cannot change what a previous run appears to have evaluated.

### Results and compatibility

- Show choice distributions, weighted scores, and truth probabilities using labels appropriate to each type. Confidence and selected-answer probability are distinct values.
- Display Box rectangles on the corresponding source image, maintaining alignment when the image scales.
- Each Box question identifies its target image. Model output does not reliably provide an image identifier, so the application retains that association.
- TypeSafe Jev and Cloudflare Workers AI Clef are initial provider integrations. Base URLs are configurable within their supported API contracts.
- A model's capabilities determine which questions and media it can execute. Clef's documented schema does not support Box; switching to it must explain incompatibility rather than silently omit questions.
- A Box result is not proof that the target exists. The UI must make the provider's lack of a not-found result understandable; a separate presence question can be used when needed.

## Deployment and visual constraints

- Keep the existing TanStack Start application.
- Single-server Docker deployment with SQLite and persistent uploaded files.
- Use the official color tokens from shadcn preset `b50cyVY3s`: neutral base, pink theme, rose charts. The preset also resolves to Lyra, Inter, and Lucide.
- Use Open WebUI's saved connections and workspace navigation as a reference while centering the screen on structured decision inputs and results.
- Explore three distinct interface layouts before implementing the chosen application design. Drafts must use clearly identified sample results rather than imply a live provider call.

## Proposed screen coverage

1. Initial administrator setup and sign-in.
2. Main playground with state, image inputs, typed questions, model selection, and results.
3. Saved playgrounds and private run history with a run detail view.
4. Personal connections and administrator-managed shared connections.
5. Administrator account management.

The user confirmed this scope with “yes continue,” then selected “the styling of C but the layout of A.” The implementation uses A's persistent library and split editor/results layout with C's dark neutral surfaces and pink accents. See [direction-approved.md](../direction-approved.md).
