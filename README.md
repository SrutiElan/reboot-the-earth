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
