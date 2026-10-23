import argparse
import os
from pathlib import Path

import geopandas as gpd
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data" / "ofo"

DATASETS = (
    (
        "ofo_ground-reference_plots.gpkg",
        "ofo_ground-reference_plots",
        "ofo_plots",
        "idx_ofo_plots_geom",
    ),
    (
        "ofo_ground-reference_trees.gpkg",
        "ofo_ground-reference_trees",
        "ofo_trees",
        "idx_ofo_trees_geom",
    ),
    (
        "ofo_drone-missions.gpkg",
        "mission-metadata",
        "ofo_drone_missions",
        "idx_ofo_drone_missions_geom",
    ),
)


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def import_dataset(engine, filename: str, layer: str, table: str, index: str, if_exists: str) -> None:
    source = DATA_DIR / filename
    if not source.exists():
        raise FileNotFoundError(f"Missing OFO data file: {source}")

    if if_exists == "fail" and inspect(engine).has_table(table):
        print(f"Skipped {table}; table already exists")
        return

    data = gpd.read_file(source, layer=layer)
    if data.crs is None:
        raise ValueError(f"The source file has no CRS: {source}")
    data = data.to_crs(4326)
    if data.geometry.name != "geom":
        data = data.rename_geometry("geom")

    data.to_postgis(table, engine, if_exists=if_exists, index=False)
    with engine.begin() as connection:
        connection.execute(
            text(
                f"CREATE INDEX IF NOT EXISTS {quote_identifier(index)} "
                f"ON {quote_identifier(table)} USING GIST (geom)"
            )
        )
    print(f"Imported {len(data):,} rows into {table}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import the OFO GeoPackages into PostGIS.")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing OFO tables. Without this flag, existing tables are preserved.",
    )
    args = parser.parse_args()

    load_dotenv(BACKEND_DIR / ".env")
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/reboot_the_earth",
    )
    engine = create_engine(database_url, pool_pre_ping=True)

    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))

    if_exists = "replace" if args.replace else "fail"
    for dataset in DATASETS:
        import_dataset(engine, *dataset, if_exists=if_exists)


if __name__ == "__main__":
    main()
