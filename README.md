# Kimeru

A self-hosted, bring-your-own-key playground for structured decision AI. Built with TanStack Start, React, and SQLite, using shadcn preset `b50cyVY3s`.

Provide text or JSON state, attach images, and compose **Choice**, **Score**, **Noul**, and **Box** questions. Results include probability distributions, model-reported confidence, raw JSON, and image overlays for Box answers. Save unfinished playgrounds, revisit immutable run snapshots, and export runs as JSON.

## Run locally

Use **Node.js 24 or newer**; persistence uses Node's built-in SQLite module.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open [localhost:3000](http://localhost:3000). The first visitor creates the administrator account. Passwords require at least 12 characters. After setup, only an administrator can create additional accounts in **Administration**; public registration is closed.

Create a provider connection, select a model, and run your questions. Example playgrounds supply editable inputs; results come from real provider requests, which may incur provider charges.

For a production build:

```bash
npm run build
npm start
```

Both `dev` and `start` load an optional `.env` file. The production server listens on `0.0.0.0:3000` by default. `/healthz` reports server availability; it does not test provider credentials or connectivity.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build -d
```

Open [localhost:3000](http://localhost:3000) and create the first administrator. Compose stores the database, uploaded images, and generated encryption key in the persistent `kimeru-data` volume mounted at `/app/data`.

For an HTTPS deployment, terminate TLS at your reverse proxy and configure the exact public origin in `.env` before starting:

```dotenv
KIMERU_APP_ORIGIN=https://decisions.example.com
KIMERU_SECURE_COOKIES=true
```

The origin includes the scheme, hostname, and any nonstandard port. For access over a LAN, replace `localhost` with the address users actually open. Mutations enforce same-origin requests. When only the reverse proxy should reach the container, change the Compose port mapping to `127.0.0.1:3000:3000`.

## Provider connections

| Provider | Base URL | Credentials | Models and question types |
| --- | --- | --- | --- |
| TypeSafe SystemOne | `https://api.typesafe.ai/v1` | TypeSafe API key | Discover available Jev models; Choice, Score, Noul, and Box where supported by the selected model |
| Cloudflare Workers AI | `https://api.cloudflare.com/client/v4` | Cloudflare account ID and API token with Workers AI access | `@cf/cloudflare/clef` and `@cf/cloudflare/clef-flash`; Choice, Score, and Noul |

Host-only URLs automatically receive `/v1` for TypeSafe or `/client/v4` for Cloudflare. Custom base URLs are supported for compatible services and gateways. They must implement the corresponding decision API contract; an OpenAI-compatible chat endpoint alone is insufficient. Provider requests originate from the Kimeru server. Redirects are rejected to avoid forwarding credentials to another endpoint.

**Clef does not support Box.** Its adapter accepts at most 64 questions and four images per run, with limits of 4 MiB per decoded image and 8 MiB combined. For named Jev versions, image inputs require Jev 1.13 or newer and Box requires Jev 1.14 or newer. Kimeru sends TypeSafe's experimental image header for image and Box requests; availability still depends on the provider and model.

The image picker accepts PNG, JPEG, and WebP files up to 16 MiB. It corrects orientation, converts to JPEG on a white background, and resizes to provider-compatible dimensions between 280 and 1568 pixels per side. Very panoramic images must be cropped first. Box questions explicitly target one attachment, and the result overlays the returned region on that run's saved image.

## Accounts and privacy

- **Personal connections** are visible and editable only by their owner. **Shared connections** are created and managed by administrators and usable by all enabled accounts.
- API keys are encrypted at rest and used only on the server. The browser receives whether a key is configured, never the stored key. Leaving the key field empty while editing preserves the existing key.
- Playground inputs, uploaded images, and run history are private to their owner, including from other administrators. Administrators manage accounts and shared connections; they do not get an application-level view of other users' work.
- Passwords use scrypt hashes; sessions use opaque tokens stored as hashes. Cookies are HttpOnly and SameSite=Lax. HTTPS uses secure cookies. Password changes, role changes, and account disabling invalidate existing sessions.
- The last enabled administrator cannot be disabled or demoted. There is no email-based password recovery or public signup.

These boundaries apply to application accounts. The server operator controls the database, storage, and encryption key and must secure and back up the host accordingly.

## Configuration and backups

| Variable | Default | Purpose |
| --- | --- | --- |
| `KIMERU_DATA_DIR` | `.data`; `/app/data` in Docker | SQLite database, private image files, and generated encryption key |
| `KIMERU_APP_ORIGIN` | Request origin; Compose defaults to `http://localhost:3000` | Exact public origin used for mutation checks; set explicitly behind a reverse proxy |
| `KIMERU_SECURE_COOKIES` | `false` | Set `true` for HTTPS; an HTTPS request or configured HTTPS origin also enables secure cookies |
| `KIMERU_ENCRYPTION_KEY` | Generated `instance.key` in the data directory | Optional 32-byte key encoded as 64 hexadecimal characters; Compose forwards this from `.env` |
| `HOST` | `0.0.0.0` | Production listener address |
| `PORT` | `3000` | Production listener port; update Docker port mappings if overridden |

Back up the **entire data directory or Docker volume**, preferably with the server stopped for a consistent snapshot. SQLite uses WAL, so copying only the main database while it is running is insufficient. Include uploaded images and `instance.key`. If supplying `KIMERU_ENCRYPTION_KEY`, securely back up that exact value separately. Restoring the database without its original encryption key makes stored provider credentials unreadable. Changing the key does not migrate existing credentials.

Deleting a playground or run removes image files only when no remaining saved playground or run references them. `docker compose down` retains the named volume; `docker compose down -v` deletes persisted application data.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Browser tests require Playwright Chromium:

```bash
npx playwright install chromium
npm run test:browser
```

The browser suite builds and starts an isolated production server on port 4176, uses a temporary database and a local provider fixture, and checks setup, connection management, decision results including Box overlays, persistence, provider errors, account isolation, and responsive layouts. Failure screenshots and traces are written to `.verification/browser`.

Unit tests exercise authentication, bootstrap races, authorization, encryption, image retention, validation, origin checks, and provider request/response contracts. Tests use provider fixtures; they do not establish live provider availability or token permissions. Run a request with your own provider credentials to verify those.

This implementation targets a single server with SQLite. Multi-replica operation, SSO, account invitations, password recovery, and automatic encryption-key rotation are not implemented. Scope and storage decisions are recorded in [docs/scope.md](docs/scope.md) and [docs/adr](docs/adr).
