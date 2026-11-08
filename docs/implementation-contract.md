# Implementation boundaries

Shared domain types: `src/lib/domain.ts`. Keep this contract aligned across parallel implementation.

## Server functions (`src/server/api.ts`)

All methods accept the following data through the TanStack server-function `{ data: ... }` call convention. Reads without data are called without arguments. Every private method authenticates and checks ownership on the server. Errors are thrown with safe user-facing messages.

- `getBootstrap()` → `Bootstrap`
- `registerFirstAdmin({name,email,password})` → `User` (sets session)
- `login({email,password})` → `User` (sets session)
- `logout()` → `{ok:true}`
- `getWorkspace()` → `Workspace`
- `saveConnection(ConnectionInput)` → `Connection` (empty API key on edit preserves existing key)
- `deleteConnection({id})` → `{ok:true}`
- `getConnectionModels({id})` → `string[]`
- `savePlayground(DecisionInput & {id?:string})` → `Playground`
- `deletePlayground({id})` → `{ok:true}`
- `executeRun(DecisionInput)` → `Run` (provider failures are persisted as status:error)
- `getRun({id})` → `Run`
- `deleteRun({id})` → `{ok:true}`
- `listUsers()` → `User[]` (admin)
- `createUser({name,email,password,role:'admin'|'user'})` → `User` (admin)
- `updateUser({id,disabled:boolean,role:'admin'|'user'})` → `User` (admin; preserve an enabled admin)
- `changePassword({currentPassword,newPassword})` → `{ok:true}`

## Provider adapter (`src/server/providers.ts`)

- export `SecretConnection = Connection & {apiKey:string}`
- `runProvider(connection: SecretConnection, input: DecisionInput): Promise<ProviderResult>`
- `discoverModels(connection: SecretConnection): Promise<string[]>`
- Pure exported request-building/response-normalizing helpers for contract tests.
- Fetch is server-only. Follow official System One / Clef contracts, no OpenAI chat approximation. Reject incompatible question types, validate results, enforce timeout, avoid leaking credentials in errors. Redirects must not forward keys to another origin.

## File ownership

- Backend: `src/server/api.ts`, `src/server/store.ts`, `src/server/auth.ts`, backend validation helpers and tests.
- Provider adapter: `src/server/providers.ts`, provider helpers/tests.
- Interface: `src/components/playground/**`, `src/routes/index.tsx`, `src/styles.css` after shadcn initialization is complete.
- Root: shared types, shadcn-generated components, root route, packaging, documentation, integration verification and fixes.

Data storage uses Node's built-in SQLite on Node 24. The runtime data directory defaults to `.data`, configured by `KIMERU_DATA_DIR`. Keys are encrypted at rest with an instance secret persisted outside the database in that directory (or supplied with `KIMERU_ENCRYPTION_KEY`). Run snapshots retain their own immutable inputs/images. Static public assets must never contain user uploads.
