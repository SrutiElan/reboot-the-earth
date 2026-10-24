"""Real OFO catalog, spatial relationships and downloadable database exports."""

import csv
import io
import json
import zipfile
from contextlib import asynccontextmanager

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sqlalchemy import text

try:
    from .db import engine
    from .sql_service import json_value
except ImportError:
    from db import engine
    from sql_service import json_value

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

CATALOG_VIEW = """
CREATE OR REPLACE VIEW catalog_datasets AS
SELECT d.*, COALESCE(s.title, 'OFO') AS source_name, s.id::text AS submission_id, r.external_id
FROM (
SELECT 'drone-' || m.mission_id AS dataset_id, m.mission_id AS source_id,
       'drone'::text AS kind,
       COALESCE(NULLIF(m.contributor_dataset_name, ''), m.mission_id) AS name,
       COALESCE(m.project_name, 'Unknown') AS project_name,
       to_char(m.earliest_date_derived, 'YYYY-MM-DD') AS date,
       extract(year FROM m.earliest_date_derived)::int AS year,
       COALESCE(m.centroid_lat_derived, ST_Y(ST_Centroid(m.geom))) AS latitude,
       COALESCE(m.centroid_lon_derived, ST_X(ST_Centroid(m.geom))) AS longitude,
       m.area_derived AS area_ha,
       CASE WHEN m.altitude_agl_nominal ~ '^[-+]?[0-9]+(\\.[0-9]+)?$'
            THEN m.altitude_agl_nominal::double precision ELSE NULL END AS altitude_m,
       m.camera_pitch_derived AS camera_pitch,
       m.image_count_derived::bigint AS image_count,
       m.aircraft_model_name AS aircraft,
       COALESCE(m.withhold_from_training, false) AS withheld,
       COALESCE(m.smart_oblique_derived, false) OR m.camera_pitch_derived >= 5 AS oblique,
       NULL::bigint AS tree_count, NULL::text AS species,
       false AS date_approximate,
       m.geom
FROM ofo_drone_missions m
UNION ALL
SELECT 'ground-' || p.plot_id, p.plot_id, 'ground',
       COALESCE(p.project_name, 'Ground') || ' / Plot ' || p.plot_id,
       COALESCE(p.project_name, 'Unknown'),
       CASE length(p.survey_date::bigint::text)
           WHEN 8 THEN substring(p.survey_date::bigint::text, 1, 4) || '-' || substring(p.survey_date::bigint::text, 5, 2) || '-' || substring(p.survey_date::bigint::text, 7, 2)
           WHEN 6 THEN substring(p.survey_date::bigint::text, 1, 4) || '-' || substring(p.survey_date::bigint::text, 5, 2)
           ELSE p.survey_date::bigint::text END,
       substring(p.survey_date::bigint::text, 1, 4)::int,
       COALESCE(p.plot_lat, ST_Y(ST_Centroid(p.geom))),
       COALESCE(p.plot_lon, ST_X(ST_Centroid(p.geom))), p.plot_area_ha,
       NULL::double precision, NULL::double precision, NULL::bigint, NULL::text,
       COALESCE(p.withhold_from_training, false), false,
       (SELECT count(*) FROM ofo_trees t WHERE t.plot_id = p.plot_id),
       p.top_species, COALESCE(p.survey_date_approx, true), p.geom
FROM ofo_plots p
) d
LEFT JOIN submission_records r ON r.source_id = d.source_id
    AND ((d.kind = 'ground' AND r.record_kind = 'plot') OR (d.kind = 'drone' AND r.record_kind = 'mission'))
LEFT JOIN data_submissions s ON s.id = r.submission_id AND s.status = 'imported'
"""


@asynccontextmanager
async def lifespan(app):
    try:
        from .uploads import initialize_upload_tables
    except ImportError:
        from uploads import initialize_upload_tables
    with engine.begin() as conn:
        initialize_upload_tables(conn)
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_ofo_trees_plot_id ON ofo_trees (plot_id)")
        conn.exec_driver_sql(CATALOG_VIEW)
        conn.exec_driver_sql("""DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ofo_reader') THEN
                CREATE ROLE ofo_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
            END IF;
        END $$""")
        conn.exec_driver_sql("GRANT USAGE ON SCHEMA public TO ofo_reader")
        conn.exec_driver_sql("GRANT SELECT ON ofo_trees, ofo_plots, ofo_drone_missions, catalog_datasets TO ofo_reader")
    yield


def catalog_records() -> list[dict]:
    with engine.connect() as conn:
        records = conn.execute(text("""
            SELECT dataset_id, source_id, kind, name, project_name, date, year,
                   latitude, longitude, area_ha, altitude_m, camera_pitch, image_count,
                   aircraft, withheld, oblique, tree_count, species, date_approximate,
                   source_name, submission_id, external_id,
                   ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.00001), 7)::json AS geometry
            FROM catalog_datasets ORDER BY date DESC NULLS LAST, dataset_id
        """)).mappings().all()
        pairs = conn.execute(text("""
            SELECT 'drone-' || m.mission_id AS mission, 'ground-' || p.plot_id AS plot
            FROM ofo_drone_missions m JOIN ofo_plots p
              ON m.geom && p.geom AND ST_Intersects(m.geom, p.geom)
        """)).all()
    overlaps: dict[str, list[str]] = {}
    for mission, plot in pairs:
        overlaps.setdefault(mission, []).append(plot)
        overlaps.setdefault(plot, []).append(mission)
    items = []
    for row in records:
        base = {
            "id": row["dataset_id"], "sourceId": row["source_id"], "kind": row["kind"],
            "name": row["name"], "site": row["project_name"], "date": row["date"] or "",
            "year": row["year"], "lat": row["latitude"], "lng": row["longitude"],
            "overlaps": overlaps.get(row["dataset_id"], []), "geometry": row["geometry"],
            "dateApproximate": row["date_approximate"],
            "sourceLabel": row["source_name"], "submissionId": row["submission_id"],
        }
        if row["submission_id"] and row["kind"] == "ground":
            base["name"] = f"{row['project_name']} / Plot {row['external_id']}"
        if row["kind"] == "drone":
            base.update(areaHa=row["area_ha"], altitudeM=row["altitude_m"],
                        cameraPitch=row["camera_pitch"], imageCount=row["image_count"],
                        aircraft=row["aircraft"], withheld=row["withheld"], oblique=row["oblique"])
        else:
            base.update(trees=row["tree_count"], plotHa=row["area_ha"], species=row["species"])
        items.append(json_value(base))
    return items


@router.get("")
def get_catalog():
    items = catalog_records()
    with engine.connect() as conn:
        trees = conn.execute(text("SELECT count(*) FROM ofo_trees")).scalar_one()
    return {"datasets": items, "tree_count": trees, "source": "Forest catalog / PostgreSQL + PostGIS"}


def dataset_rows(dataset_id: str):
    kind, sep, source_id = dataset_id.partition("-")
    if not sep or kind not in {"drone", "ground"}:
        raise HTTPException(404, "Dataset not found")
    table, key = ("ofo_drone_missions", "mission_id") if kind == "drone" else ("ofo_plots", "plot_id")
    with engine.connect() as conn:
        row = conn.execute(text(f"SELECT to_jsonb(d) - 'geom' AS metadata, ST_AsGeoJSON(geom)::json AS geometry FROM {table} d WHERE {key} = :id"), {"id": source_id}).mappings().first()
        if row is None:
            raise HTTPException(404, "Dataset not found")
        origin = conn.execute(text("""SELECT s.id::text AS submission_id, s.title, s.imported_at,
            s.normalized_payload->>'contributor' AS contributor, s.normalized_payload->>'source_url' AS source_url,
            s.normalized_payload->>'license' AS license, r.external_id
            FROM submission_records r JOIN data_submissions s ON s.id=r.submission_id
            WHERE r.record_kind=:kind AND r.source_id=:id AND s.status='imported'"""),
            {"kind": "mission" if kind == "drone" else "plot", "id": source_id}).mappings().first()
        row = {**row, "metadata": {**row["metadata"], "contribution_source": dict(origin) if origin else None}}
        trees = []
        if kind == "ground":
            trees = conn.execute(text("SELECT to_jsonb(t) - 'geom' AS properties, ST_AsGeoJSON(geom)::json AS geometry FROM ofo_trees t WHERE plot_id = :id"), {"id": source_id}).mappings().all()
    return json_value(dict(row)), [json_value(dict(t)) for t in trees]


def export_files(dataset_id: str) -> dict[str, bytes]:
    row, trees = dataset_rows(dataset_id)
    encode = lambda value: json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
    files = {"metadata.json": encode(row["metadata"]), "geometry.geojson": encode({"type": "Feature", "geometry": row["geometry"], "properties": row["metadata"]})}
    if dataset_id.startswith("ground-"):
        files["trees.geojson"] = encode({"type": "FeatureCollection", "features": [{"type": "Feature", **t} for t in trees]})
        output = io.StringIO(newline="")
        fields = list(trees[0]["properties"]) if trees else ["plot_id"]
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        writer.writerows(t["properties"] for t in trees)
        files["trees.csv"] = output.getvalue().encode("utf-8-sig")
    return files


@router.get("/datasets/{dataset_id}/files/{filename}")
def download_file(dataset_id: str, filename: str):
    files = export_files(dataset_id)
    if filename not in files:
        raise HTTPException(404, "File not available for this dataset")
    mime = "text/csv" if filename.endswith(".csv") else "application/geo+json" if filename.endswith(".geojson") else "application/json"
    return Response(files[filename], media_type=mime, headers={"Content-Disposition": f'attachment; filename="{dataset_id}-{filename}"'})


@router.get("/datasets/{dataset_id}/download")
def download_dataset(dataset_id: str):
    files = export_files(dataset_id)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as bundle:
        for filename, data in files.items():
            bundle.writestr(filename, data)
    return Response(output.getvalue(), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{dataset_id}.zip"'})
