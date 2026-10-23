# Backend

FastAPI and PostGIS service for Reboot the Earth.

The repository root includes Docker Compose services for PostGIS, the OFO data importer, this backend, and the Next.js frontend. From the repository root, run:

```bash
docker compose up --build
```

The frontend is available at `http://localhost:3000`, the API at `http://localhost:8000`, and PostgreSQL/PostGIS at `localhost:5432`. The OFO importer runs after PostGIS is healthy and skips tables that already exist. To rebuild the imported tables, run the importer manually with `--replace`.

## Run locally

From this directory, create and activate a virtual environment, then install the dependencies:

```bash
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
Copy-Item .env.example .env
```

Start PostGIS from the repository root:

```bash
docker compose up -d postgis
```

Import the bundled Open Forest Observatory GeoPackages:

```bash
python scripts/import_ofo.py
```

Use `python scripts/import_ofo.py --replace` when intentionally rebuilding the imported tables.

Start the development server:

```bash
uvicorn main:app --reload
```

The API is available at `http://localhost:8000`. Interactive documentation is available at `/docs`. The database health check is `/health/db`, and nearby-tree queries use:

```text
GET /api/trees/nearby?longitude=-121.5&latitude=38.5&radius_m=100&max_height_m=10
```

The read-only SQL console is available at `http://localhost:3000/data/sql`. It sends
`POST /api/sql/query` with `{ "sql": "SELECT ..." }` and returns dynamic columns and rows.
Only one `SELECT` or `WITH` statement is accepted; the API rejects writes, applies a five-second
statement timeout, and caps the response at 1,000 rows.
