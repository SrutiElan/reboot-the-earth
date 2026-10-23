# Backend

FastAPI and PostGIS service for Reboot the Earth.

The repository root includes Docker Compose services for PostGIS, the OFO data importer, this backend, and the Next.js frontend. From the repository root, run:

```bash
docker compose up --build
```

The frontend is available at `http://localhost:3000`, the API at `http://localhost:8000`, and PostgreSQL/PostGIS at `localhost:5432`. The OFO importer runs after PostGIS is healthy and skips tables that already exist. To rebuild the imported tables, run the importer manually with `--replace`.

Compose publishes these development ports on `127.0.0.1` only. The local AI endpoint
uses the configured account; add application authentication before deploying it publicly.

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

## Real catalog and AI assistant

Configure `OPENAI_API_KEY` in the local `backend/.env` (ignored by Git and Docker builds).
The backend reads this file through python-dotenv; Docker's bind mount supplies it at runtime.
`OPENAI_MODEL` defaults to `gpt-4.1-mini` and `AI_MAX_ATTEMPTS` defaults to 3 (maximum 5).
These are server-only settings. No API key is sent to the browser. Account eligibility,
data-sharing credits and remaining quota are controlled in the OpenAI account, not in this app.

`POST /api/assistant/query` accepts `question`, up to 20 `history` messages, and previous
`context_ids`. It streams NDJSON events (`status`, `complete`, `error`). LangChain's
ChatOpenAI uses the official Responses API with structured query plans and result reviews.
Each turn reads the live database schema, generates SQL, runs it, and checks the returned
columns/sample rows. SQL errors and unusable/empty results feed back into bounded retries.
An empty result is verified once; explicit user constraints are never silently relaxed.
The answer contains actual rows, SQL, attempt history, and validated dataset IDs for the map.

Startup creates the normalized `catalog_datasets` view and a `NOLOGIN` role `ofo_reader`.
Both the SQL console and assistant use the same parsed SELECT-only executor, explicit
table allowlist, read-only transaction and restricted role, with a 1,000-row / 5-second cap.
The existing database owner bootstraps this role; the model cannot execute SQL as the owner.

`GET /api/catalog` returns actual missions and plots, source polygons and PostGIS
`ST_Intersects` relationships. IDs are namespaced (`drone-000001`, `ground-0014`).
Survey dates retain original precision and approximation markers; missing measurements
remain null. The frontend no longer generates coordinates, plot records or file sizes.

Actual database exports are available under `/api/catalog/datasets/{id}/files/`:
`metadata.json`, `geometry.geojson`, and for ground plots `trees.csv` / `trees.geojson`.
`/api/catalog/datasets/{id}/download` bundles the available files as ZIP. Source imagery,
orthomosaics and canopy-height raster assets are not part of the imported GeoPackages
and are not presented as local downloads.

Run database integration and retry checks in Docker:

```bash
docker compose exec -T backend python -m unittest discover -s tests -v
# Optional real OpenAI error-repair check (uses the configured account):
docker compose exec -T -e RUN_LIVE_AI_TEST=1 backend python -m unittest tests.test_query_pipeline.QueryPipelineTests.test_live_model_repairs_database_error -v
```
