# Kimeru

A self-hosted, bring-your-own-key playground for structured decision AI. Built with TanStack Start, React, and SQLite, using shadcn preset `b50cyVY3s`.

Provide text or JSON state, attach images, and compose **Choice**, **Score**, **Noul**, and **Box** questions. Results include probability distributions, model-reported confidence, raw JSON, and image overlays for Box answers. Save unfinished playgrounds, revisit immutable run snapshots, and export runs as JSON.

## Self-host with Docker

Install [Docker Desktop](https://docs.docker.com/desktop/) or [Docker Engine](https://docs.docker.com/engine/install/). For the Compose option, also make sure `docker compose version` works. You do not need to clone this repository, install Node.js, or set up a separate database to use the published image.

Choose **one** of the following methods. Both use `marcelaritonang/kimeru:latest`, run Kimeru at **http://localhost:3000**, and store the database, uploaded images, and encryption key in the Docker volume `kimeru-data`.

The release workflow currently builds `linux/amd64` images, which the examples select explicitly. ARM machines need Docker's amd64 emulation, or you can [build from source](#build-from-source) for your machine. The shell examples use Bash syntax, suitable for Linux, macOS, or WSL.

### Option 1: Docker command

Create the persistent volume and start Kimeru:

```bash
docker volume create kimeru-data

docker run -d \
  --name kimeru \
  --platform linux/amd64 \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --mount type=volume,source=kimeru-data,target=/app/data \
  -e KIMERU_DATA_DIR=/app/data \
  -e KIMERU_APP_ORIGIN=http://localhost:3000 \
  -e KIMERU_SECURE_COOKIES=false \
  marcelaritonang/kimeru:latest
```

Docker downloads the image if it is not already present. Open [localhost:3000](http://localhost:3000) and follow [first-time setup](#first-time-setup).

To view logs:

```bash
docker logs -f kimeru
```

Use `docker stop kimeru` to stop it and `docker start kimeru` to start the same container again. The named volume retains your data when the container is replaced.

### Option 2: Docker Compose

Create a directory for your deployment:

```bash
mkdir kimeru
cd kimeru
```

Save the following as `compose.yaml` in that directory. This standalone file pulls the published image; the Compose file in this repository instead builds from source.

```yaml
services:
  kimeru:
    image: marcelaritonang/kimeru:latest
    platform: linux/amd64
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      KIMERU_DATA_DIR: /app/data
      KIMERU_APP_ORIGIN: http://localhost:3000
      KIMERU_SECURE_COOKIES: "false"
    volumes:
      - kimeru-data:/app/data

volumes:
  kimeru-data:
    name: kimeru-data
```

Start it from the directory containing `compose.yaml`:

```bash
docker compose pull
docker compose up -d
```

Open [localhost:3000](http://localhost:3000) and follow [first-time setup](#first-time-setup). Use `docker compose logs -f kimeru` to view logs, `docker compose down` to stop and remove the container, and `docker compose up -d` to start it again. `down` retains the named volume; adding `-v` deletes it and your saved data.

### First-time setup

1. Open your configured URL (default: **http://localhost:3000**). There are no default credentials: create the first administrator account with a password of at least 12 characters.
2. Open **Connections** and add your TypeSafe, Cloudflare, or OpenAI provider URL and API key. Cloudflare also needs your account ID. Provider credentials are entered in the application, not in the Docker command.
3. Open **Playground**, select your connection and model, enter state and questions, and run them. **Load example inputs** provides an editable starting point; results require a real provider request and may incur provider charges.
4. To give other people access, create their accounts under **Administration**. Public registration closes after the first administrator is created.

### Change the port or access URL

The examples bind to `127.0.0.1`, so Kimeru is accessible only from the machine running Docker. `KIMERU_APP_ORIGIN` must match the exact browser URL, including scheme, hostname, and external port; `localhost` and `127.0.0.1` are different origins.

- **Another local port:** if port 3000 is already in use, change the mapping to `127.0.0.1:3001:3000` and set `KIMERU_APP_ORIGIN=http://localhost:3001`. Then open that URL. Keep the container port at 3000.
- **Access over your LAN:** change the mapping to `3000:3000` and set `KIMERU_APP_ORIGIN` to your machine's reachable address, for example `http://192.168.1.50:3000`. Use that same URL in every browser and allow the port through your host firewall.
- **HTTPS through a reverse proxy:** route your domain to Kimeru's container port 3000, set `KIMERU_APP_ORIGIN=https://decisions.example.com`, and set `KIMERU_SECURE_COOKIES=true`. A proxy on the Docker host can use the localhost port mapping above; a containerized proxy must connect over a shared Docker network. Complete first-admin setup before exposing the instance publicly.

For `docker run`, change the corresponding `-p` and `-e` arguments and recreate the container. For Compose, edit `ports` and `environment`, then run `docker compose up -d`. Keep the existing volume mounted at `/app/data`. If you supply an environment file, keep `KIMERU_DATA_DIR=/app/data`; the repository's `.env.example` uses `.data` for development outside Docker.

### Update Kimeru

Back up your data volume before updating. You can replace `:latest` with a published release tag such as `:v0.1.0` in either example to pin a version. When using a pinned version, change that tag when you want to upgrade.

For the **Docker command** installation:

```bash
docker pull --platform linux/amd64 marcelaritonang/kimeru:latest
docker stop kimeru
docker rm kimeru
```

Then run the same `docker run` command from Option 1 again, retaining your port, environment settings, and `kimeru-data` volume. If pinning a version, use that same tag in both `docker pull` and `docker run`. Removing the container does not remove the named volume.

For **Docker Compose**, run these in your deployment directory:

```bash
docker compose pull
docker compose up -d
```

Compose replaces the container when the image changes and reuses the named volume. `/healthz` reports server availability; it does not test provider credentials or connectivity.

## Provider connections

| Provider | Base URL | Credentials | Models and question types |
| --- | --- | --- | --- |
| TypeSafe SystemOne | `https://api.typesafe.ai/v1` | TypeSafe API key | Discover available Jev models; Choice, Score, Noul, and Box where supported by the selected model |
| Cloudflare Workers AI | `https://api.cloudflare.com/client/v4` | Cloudflare account ID and API token with Workers AI access | `@cf/cloudflare/clef` and `@cf/cloudflare/clef-flash`; Choice, Score, and Noul |
| OpenAI Decisions | `https://api.openai.com/v1` | OpenAI API key | `gpt-6-luna`; Choice, Score, and Noul (sent as OpenAI `predicate`) |

Host-only URLs automatically receive `/v1` for TypeSafe and OpenAI, or `/client/v4` for Cloudflare. Custom base URLs are supported for compatible services and gateways. They must implement the corresponding decision API contract; an OpenAI-compatible chat endpoint alone is insufficient. Provider requests originate from the Kimeru server. Redirects are rejected to avoid forwarding credentials to another endpoint.

**Clef does not support Box.** Its adapter accepts at most 64 questions and four images per run, with limits of 4 MiB per decoded image and 8 MiB combined. For named Jev versions, image inputs require Jev 1.13 or newer and Box requires Jev 1.14 or newer. Kimeru sends TypeSafe's experimental image header for image and Box requests; availability still depends on the provider and model.

**OpenAI Decisions does not support Box.** Kimeru sends JSON state as structured `input_json` (at most 32 levels, 10,000 values, and 256 KiB; switch the state format to Text for larger state) and attaches images as `input_image` data URLs. Noul true/false criteria are appended to the question instructions. OpenAI may decline individual questions; those answers are marked **Declined** while the rest of the run still succeeds. Model discovery returns `gpt-6-luna` without calling OpenAI, because its model catalog does not indicate Decisions support; enter another model name manually if needed.

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
| `KIMERU_ENCRYPTION_KEY` | Generated `instance.key` in the data directory | Optional 32-byte key encoded as 64 hexadecimal characters; set with `-e` or under Compose `environment` when overriding it |
| `HOST` | `0.0.0.0` | Production listener address |
| `PORT` | `3000` | Production listener port; update Docker port mappings if overridden |

Back up the **entire data directory or Docker volume**, preferably with the server stopped for a consistent snapshot. SQLite uses WAL, so copying only the main database while it is running is insufficient. Include uploaded images and `instance.key`. If supplying `KIMERU_ENCRYPTION_KEY`, securely back up that exact value separately. Restoring the database without its original encryption key makes stored provider credentials unreadable. Changing the key does not migrate existing credentials.

Deleting a playground or run removes image files only when no remaining saved playground or run references them. `docker compose down` retains the named volume; `docker compose down -v` deletes persisted application data.

## Build from source

For development or a local image build, clone the repository:

```bash
git clone https://github.com/MarcelArt/kimeru.git
cd kimeru
```

The repository's `compose.yaml` builds the application locally:

```bash
cp .env.example .env
docker compose up --build -d
```

Configure your origin in `.env` and change the port mapping in `compose.yaml` if needed. This source-build Compose file creates its own project-scoped data volume. To build an image for use with `docker run`, run `docker build -t kimeru:local .`, then use `kimeru:local` in Option 1 and omit `--platform linux/amd64` when building for your host's native architecture.

To run without Docker, use **Node.js 24 or newer**; persistence uses Node's built-in SQLite module:

```bash
npm ci
cp .env.example .env
npm run dev
```

For a production build:

```bash
npm run build
npm start
```

Both `dev` and `start` load an optional `.env` file. Outside Docker, data is stored in `.data` by default. The production server listens on `0.0.0.0:3000` by default.

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