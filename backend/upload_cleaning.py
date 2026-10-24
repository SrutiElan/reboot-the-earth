"""Auditable, allowlisted transformations. No model-provided code is executed."""

import copy
import math
import re
from collections import Counter
from typing import Literal

from pydantic import ValidationError

try:
    from .upload_schema import ContributionPackage
except ImportError:
    from upload_schema import ContributionPackage

CleaningOperation = Literal["trim_text", "parse_numeric", "parse_boolean", "empty_optional_to_null", "normalize_species_code", "normalize_live_dead", "normalize_date", "convert_units", "close_polygon_ring"]
OPERATIONS = set(CleaningOperation.__args__)
NUMERIC_FIELDS = {"longitude", "latitude", "height", "dbh", "area_ha", "altitude_m", "camera_pitch", "image_count"}
NULLABLE_FIELDS = {"height", "dbh", "area_ha", "species_code", "live_dead", "source_url", "boundary", "aircraft", "altitude_m", "camera_pitch", "image_count"}
NULLS = {"", "null", "none", "n/a", "na"}
LIVE_STATUS = {"l": "L", "live": "L", "alive": "L", "d": "D", "dead": "D", "m": "M", "missing": "M"}


def clean_package(raw, allowed=None):
    data = copy.deepcopy(raw)
    selected = OPERATIONS if allowed is None else set(allowed) & OPERATIONS
    changes = []

    def record(operation, path, before, after):
        changes.append({"operation": operation, "path": path, "before": before, "after": after})
        return after

    def visit(value, path, key=None):
        if isinstance(value, dict):
            return {k: visit(v, f"{path}/{k}", k) for k, v in value.items()}
        if isinstance(value, list):
            return [visit(v, f"{path}/{i}", key) for i, v in enumerate(value)]
        if isinstance(value, str):
            if "trim_text" in selected and value != value.strip():
                value = record("trim_text", path, value, value.strip())
            if key in NULLABLE_FIELDS and value.lower() in NULLS and "empty_optional_to_null" in selected:
                return record("empty_optional_to_null", path, value, None)
            if (key in NUMERIC_FIELDS or "/coordinates/" in path) and "parse_numeric" in selected and re.fullmatch(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?", value):
                number = float(value)
                if math.isfinite(number):
                    return record("parse_numeric", path, value, int(number) if key == "image_count" and number.is_integer() else number)
            if key in {"rights_confirmed", "date_approximate", "withheld"} and "parse_boolean" in selected and value.lower() in {"true", "false"}:
                return record("parse_boolean", path, value, value.lower() == "true")
            if key == "species_code" and "normalize_species_code" in selected and value != value.upper():
                value = record("normalize_species_code", path, value, value.upper())
            if key == "live_dead" and "normalize_live_dead" in selected and value.lower() in LIVE_STATUS and value != LIVE_STATUS[value.lower()]:
                value = record("normalize_live_dead", path, value, LIVE_STATUS[value.lower()])
            if key in {"survey_date", "date"} and "normalize_date" in selected and re.fullmatch(r"\d{4}/\d{2}/\d{2}", value):
                value = record("normalize_date", path, value, value.replace("/", "-"))
        return value

    data = visit(data, "")
    if not isinstance(data, dict):
        return data, changes
    units = data.get("units")
    trees = data.get("trees", [])
    if isinstance(units, dict) and isinstance(trees, list) and "convert_units" in selected:
        for field, canonical, factors in [("height", "m", {"cm": 0.01, "ft": 0.3048}), ("dbh", "cm", {"mm": 0.1, "in": 2.54})]:
            if isinstance(units.get(field), str) and units[field] in factors:
                factor = factors[units[field]]
                for i, tree in enumerate(trees):
                    if isinstance(tree, dict) and isinstance(tree.get(field), (int, float)) and not isinstance(tree[field], bool):
                        tree[field] = record("convert_units", f"/trees/{i}/{field}", tree[field], round(tree[field] * factor, 8))
                units[field] = record("convert_units", f"/units/{field}", units[field], canonical)
    if "close_polygon_ring" in selected:
        for kind in ("plots", "missions"):
            rows = data.get(kind, [])
            for i, row in enumerate(rows if isinstance(rows, list) else []):
                boundary = row.get("boundary") if isinstance(row, dict) else None
                if not isinstance(boundary, dict) or not isinstance(boundary.get("coordinates"), list):
                    continue
                polygons = [boundary["coordinates"]] if boundary.get("type") == "Polygon" else boundary["coordinates"] if boundary.get("type") == "MultiPolygon" else []
                for p, polygon in enumerate(polygons):
                    if not isinstance(polygon, list):
                        continue
                    for r, ring in enumerate(polygon):
                        if isinstance(ring, list) and len(ring) >= 3 and ring[0] != ring[-1] and all(isinstance(pt, list) and len(pt) == 2 and all(type(n) in (int, float) and math.isfinite(n) for n in pt) for pt in ring):
                            path = f"/{kind}/{i}/boundary/coordinates/" + (f"{p}/" if boundary.get("type") == "MultiPolygon" else "") + str(r)
                            polygon[r] = record("close_polygon_ring", path, copy.deepcopy(ring), [*ring, copy.deepcopy(ring[0])])
    return data, changes


def validate_package(data):
    try:
        package = ContributionPackage.model_validate(data)
        if package.units.height != "m" or package.units.dbh != "cm":
            return None, [{"path": "/units", "message": "Import requires reviewed normalization to meters and centimeters."}]
        return package, []
    except ValidationError as exc:
        return None, [{"path": "/" + "/".join(str(p) for p in issue["loc"]), "message": issue["msg"]} for issue in exc.errors(include_url=False, include_input=False)][:100]
    except (ValueError, TypeError, KeyError) as exc:
        return None, [{"path": "/", "message": str(exc)[:300]}]


def change_summary(changes):
    counts = Counter(change["operation"] for change in changes)
    return [{"operation": name, "count": count} for name, count in sorted(counts.items())]
