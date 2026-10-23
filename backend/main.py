import re
from datetime import date, datetime, time
from decimal import Decimal
from time import perf_counter
from typing import Any
from uuid import UUID

from fastapi import FastAPI
from fastapi import Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

try:
    from .db import get_db
except ImportError:  # Supports running `uvicorn main:app` from this directory.
    from db import get_db


app = FastAPI(
    title="Reboot the Earth API",
    version="0.1.0",
)

MAX_SQL_ROWS = 1_000

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    service: str


class NearbyTree(BaseModel):
    plot_id: str
    species_code: str | None = None
    dbh: float | None = None
    height: float | None = None
    live_dead: str | None = None
    longitude: float
    latitude: float
    distance_m: float


class SQLQueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=20_000)


class SQLQueryResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    truncated: bool
    elapsed_ms: float


@app.get("/", tags=["default"])
async def root() -> dict[str, str]:
    return {"message": "Reboot the Earth API"}


@app.get("/health", response_model=HealthResponse, tags=["default"])
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="reboot-the-earth-backend")


@app.get("/health/db", tags=["database"])
def database_health(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        version = db.execute(text("SELECT PostGIS_Version()")).scalar_one()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="PostGIS is unavailable") from exc

    return {"status": "ok", "postgis_version": str(version)}


@app.get("/api/trees/nearby", response_model=list[NearbyTree], tags=["trees"])
def nearby_trees(
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_m: float = Query(100, gt=0, le=50_000),
    max_height_m: float = Query(10, ge=0),
    limit: int = Query(500, gt=0, le=5_000),
    db: Session = Depends(get_db),
) -> list[NearbyTree]:
    query = text(
        """
        WITH origin AS (
            SELECT ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography AS geog
        )
        SELECT
            t.plot_id,
            t.species_code,
            t.dbh,
            t.height,
            t.live_dead,
            ST_X(t.geom) AS longitude,
            ST_Y(t.geom) AS latitude,
            ST_Distance(t.geom::geography, origin.geog) AS distance_m
        FROM ofo_trees AS t
        CROSS JOIN origin
        WHERE t.geom IS NOT NULL
          AND t.height IS NOT NULL
          AND t.height <= :max_height_m
          AND ST_DWithin(t.geom::geography, origin.geog, :radius_m)
        ORDER BY distance_m
        LIMIT :limit
        """
    )

    try:
        rows = db.execute(
            query,
            {
                "longitude": longitude,
                "latitude": latitude,
                "radius_m": radius_m,
                "max_height_m": max_height_m,
                "limit": limit,
            },
        ).mappings()
        return [NearbyTree(**row) for row in rows]
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="OFO tables are unavailable; run the import script first",
        ) from exc


def _json_value(value: Any) -> Any:
    """Convert common PostgreSQL values into JSON-safe values for the UI."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (Decimal, UUID)):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()
    return str(value)


def _read_only_sql(sql: str) -> str:
    """Validate a single read-only query and wrap it with a hard row limit."""
    normalized = sql.strip()
    if normalized.endswith(";"):
        normalized = normalized[:-1].rstrip()

    if not normalized:
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")
    if ";" in normalized:
        raise HTTPException(status_code=400, detail="Only one SQL statement is allowed")
    if not re.match(r"^(SELECT|WITH)\b", normalized, flags=re.IGNORECASE):
        raise HTTPException(
            status_code=400,
            detail="Only read-only SELECT or WITH queries are allowed",
        )

    blocked = (
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "ALTER",
        "TRUNCATE",
        "CREATE",
        "GRANT",
        "REVOKE",
        "COPY",
        "CALL",
        "DO",
        "VACUUM",
        "SET",
        "SHOW",
        "BEGIN",
        "COMMIT",
        "ROLLBACK",
    )
    blocked_pattern = r"\b(?:" + "|".join(blocked) + r")\b"
    if re.search(blocked_pattern, normalized, flags=re.IGNORECASE):
        raise HTTPException(status_code=400, detail="The query contains a blocked SQL operation")

    # The outer LIMIT bounds the response even when the submitted query has no LIMIT.
    return f"SELECT * FROM ({normalized}) AS user_query LIMIT {MAX_SQL_ROWS + 1}"


@app.post("/api/sql/query", response_model=SQLQueryResponse, tags=["sql"])
def run_sql_query(payload: SQLQueryRequest, db: Session = Depends(get_db)) -> SQLQueryResponse:
    query = _read_only_sql(payload.sql)
    started = perf_counter()

    try:
        with db.begin():
            db.execute(text("SET TRANSACTION READ ONLY"))
            db.execute(text("SET LOCAL statement_timeout = '5000ms'"))
            result = db.execute(text(query))
            columns = list(result.keys())
            raw_rows = result.mappings().fetchmany(MAX_SQL_ROWS + 1)
    except SQLAlchemyError as exc:
        detail = str(exc.orig or exc).splitlines()[0]
        raise HTTPException(status_code=400, detail=f"Query failed: {detail}") from exc

    truncated = len(raw_rows) > MAX_SQL_ROWS
    rows = [
        {column: _json_value(row.get(column)) for column in columns}
        for row in raw_rows[:MAX_SQL_ROWS]
    ]

    return SQLQueryResponse(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        truncated=truncated,
        elapsed_ms=round((perf_counter() - started) * 1000, 2),
    )
