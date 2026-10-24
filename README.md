# Reboot Earth Project

The primary development repository is [zeturn/reboot-earth-proj](https://github.com/zeturn/reboot-earth-proj).
This repository preserves the original commit history and author attribution from
[SrutiElan/reboot-the-earth](https://github.com/SrutiElan/reboot-the-earth).

## Local setup

Install Git and Docker Desktop, and make sure Docker is running.

```bash
git clone https://github.com/zeturn/reboot-earth-proj.git
cd reboot-earth-proj
docker compose run --build --rm ofo-import
cp backend/.env.example backend/.env
```

The importer loads the bundled GeoPackages into PostgreSQL/PostGIS and preserves
existing tables. In `backend/.env`, set your own `OPENAI_API_KEY`; the default model
is `gpt-4.1-mini`. Keep the remaining example settings unchanged. The file is ignored
by Git; never commit credentials.

```bash
docker compose up -d --build
```

- Website: <http://localhost:3000/data>
- SQL console: <http://localhost:3000/data/sql>
- Data contributions: <http://localhost:3000/data/upload>
- API documentation: <http://localhost:8000/docs>

Restart the backend after changing its environment: `docker compose restart backend`.
See [backend/README.md](backend/README.md) for API, contribution schema and testing details.

## Production deployment

Build the frontend with `frontend/Dockerfile.prod` and an empty
`NEXT_PUBLIC_API_URL` build argument. It runs the Next.js standalone server;
route `/api` to the FastAPI service and all other paths to the frontend.
Build the backend with `backend/Dockerfile` (no development reload or bind mounts).

Use a private PostgreSQL/PostGIS service with a persistent volume and a strong
database password. Set the backend `DATABASE_URL` through a Kubernetes Secret,
then run `python scripts/import_ofo.py` once using the backend image before
starting the API. The bundled source files are imported without replacing
existing tables. Keep database backups separately from the application image.

For an OpenAI-compatible relay such as APICred, configure these **server-only**
Secret values; never expose the relay token as a `NEXT_PUBLIC_*` variable:

```dotenv
OPENAI_API_KEY=<application-specific relay token>
OPENAI_BASE_URL=http://apicred-backend.apicred.svc.cluster.local:8103/v1
OPENAI_USE_RESPONSES_API=false
OPENAI_MODEL=gpt-4.1-mini
```

Direct OpenAI access can leave `OPENAI_BASE_URL` empty and use
`OPENAI_USE_RESPONSES_API=true`. Do not set `GEMINI_API_KEY` when selecting OpenAI:
the assistant gives Gemini precedence when that variable is present.
The production deployment is intentionally public, including AI usage and
contribution imports; enforce sensible ingress request limits and retain the
server's SQL read-only, timeout and upload-validation safeguards.

## Future contributions

Open new pull requests against this repository's `main` branch. Existing clones
can keep the original repository as `upstream` and use this repository as `origin`:

```bash
git remote rename origin upstream
git remote add origin https://github.com/zeturn/reboot-earth-proj.git
git fetch origin
git branch --set-upstream-to=origin/main main
git config remote.pushDefault origin
```

If `upstream` already exists, inspect `git remote -v` before changing remotes.
Retain original commit authors when merging contributions. Contributors are tracked
in the repository's [GitHub Contributors page](https://github.com/zeturn/reboot-earth-proj/graphs/contributors).
