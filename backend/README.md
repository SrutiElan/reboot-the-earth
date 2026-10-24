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

Assistant replies default to English. A question clearly written in another language
receives a reply in that language; an explicit response-language request takes priority.
SQL-only, coordinate-only and otherwise ambiguous questions default to English.
This also applies to clarifications and follow-up suggestions, independently on each turn.

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

## Third-party JSON contributions

Open `http://localhost:3000/data/upload`. The versioned contract is defined in
`upload_schema.py` and served as JSON Schema at `GET /api/uploads/schema`;
`GET /api/uploads/template` downloads a complete example. The page accepts a
UTF-8 JSON file or pasted JSON, up to 1 MiB (200 plots / 5,000 trees / 200 missions).

A v1.0 package has this shape (replace the example metadata and measurements):

```json
{
  "schema_version": "1.0",
  "package_id": "your-survey-2026-01",
  "title": "Community forest survey",
  "project_name": "Community Survey 2026",
  "contributor": "Your organization",
  "license": "CC-BY-4.0",
  "rights_confirmed": true,
  "crs": "EPSG:4326",
  "units": { "height": "m", "dbh": "cm" },
  "plots": [{ "plot_id": "P01", "survey_date": "2026-01-15", "longitude": -120.1862, "latitude": 39.4064 }],
  "trees": [{ "tree_id": "T01", "plot_id": "P01", "longitude": -120.1862, "latitude": 39.4064, "height": 8.2, "dbh": 22.4, "species_code": "PIJE", "live_dead": "L" }],
  "missions": []
}
```

At least one record is required. Tree `plot_id` values reference plots in the same
package. All coordinates are WGS84; GeoJSON boundaries are Polygon/MultiPolygon
with `[longitude, latitude]` positions. A plot may supply just its measured center;
the application does not invent missing area or footprint geometry. Missions require
a footprint. Dates use `YYYY-MM-DD`. Heights normalize to meters, DBH to centimeters.
Unknown measurements stay null, but each tree needs at least one height or DBH.
Allowed declared height units: `m`, `cm`, `ft`; DBH units: `cm`, `mm`, `in`.
Source attribution includes contributor, optional source URL, and one of
`CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0` with explicit rights confirmation.

`POST /api/uploads/review` performs full server validation, proposes deterministic
safe transformations, and asks the real OpenAI/LangChain agent to accept/reject the
package and select the detected cleaning operations. Only allowlisted functions
execute; model-generated code and SQL cannot be run. The final cleaned package is
validated again. The model sees metadata, aggregate profiles and at most ten example
records per type; all records undergo schema, units, geometry and relation checks.
This is compatibility screening, not verification of scientific authenticity.

Supported cleaning: trim text; parse numeric/boolean strings; optional blanks to null;
uppercase provided species codes; normalize known live/dead labels; unambiguous
`YYYY/MM/DD` dates; declared unit conversions; close otherwise valid polygon rings.
Coordinates, measurements, unknown species, CRS and ambiguous units/dates are never
guessed. Unsupported issues are rejected. Missing API credentials/provider failures
produce a retryable review error and cannot authorize an import.

Reviews persist in `data_submissions` with original JSON, its SHA-256, normalized
JSON and audit. `GET /api/uploads` lists recent reports; `GET /api/uploads/{id}`
retrieves a report. The `/normalized` and `/audit` endpoints download the complete
approved package and complete before/after changes (the UI previews 200 changes).

`POST /api/uploads/{id}/import` imports only approved stored data, revalidates it,
and inserts all records in one transaction. Original OFO records are not overwritten.
Namespaced IDs, an import lock, package-ID uniqueness and idempotent repeat requests
prevent accidental duplicate imports. `submission_records` retains per-record
provenance; catalog, maps, exports and AI queries immediately include imported rows.
`catalog_datasets.source_name` / `submission_id` distinguish contributions from OFO.

These endpoints share the local-only development deployment. Authentication,
contributor ownership and moderation roles are required before public deployment.

```bash
docker compose exec -T backend python -m unittest tests.test_uploads -v
docker compose exec -T -e RUN_LIVE_AI_TEST=1 backend python -m unittest tests.test_uploads.UploadTests.test_live_ai_cleaning_review -v
```
