from fastapi import FastAPI
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel
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
