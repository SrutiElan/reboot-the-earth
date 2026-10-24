"""Versioned contract for small third-party forest data contributions."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from shapely.geometry import Point, shape
from shapely.validation import explain_validity

Identifier = Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")]
Coordinate = Annotated[list[float], Field(min_length=2, max_length=2)]
Ring = Annotated[list[Coordinate], Field(min_length=4)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class PolygonGeometry(StrictModel):
    type: Literal["Polygon"]
    coordinates: Annotated[list[Ring], Field(min_length=1)]


class MultiPolygonGeometry(StrictModel):
    type: Literal["MultiPolygon"]
    coordinates: Annotated[list[Annotated[list[Ring], Field(min_length=1)]], Field(min_length=1)]


Boundary = Annotated[PolygonGeometry | MultiPolygonGeometry, Field(discriminator="type")]


def valid_boundary(boundary):
    if boundary is None:
        return boundary
    geometry = shape(boundary.model_dump())
    if geometry.is_empty or not geometry.is_valid or geometry.area <= 0:
        raise ValueError(f"Invalid footprint: {explain_validity(geometry)}")
    for polygon in ([boundary.coordinates] if boundary.type == "Polygon" else boundary.coordinates):
        for ring in polygon:
            if ring[0] != ring[-1]:
                raise ValueError("GeoJSON rings must be closed")
            if any(not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90) for point in ring):
                raise ValueError("GeoJSON coordinates must be [longitude, latitude] in EPSG:4326")
    return boundary


def valid_date(value: str) -> str:
    if date.fromisoformat(value) > date.today():
        raise ValueError("Collection date cannot be in the future")
    return value


class Units(StrictModel):
    height: Literal["m", "cm", "ft"] = Field(description="Unit of tree height values; non-metric units require explicit conversion during review.")
    dbh: Literal["cm", "mm", "in"] = Field(description="Unit of diameter at breast height values.")


class PlotRecord(StrictModel):
    plot_id: Identifier
    survey_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    date_approximate: bool = False
    area_ha: float | None = Field(default=None, gt=0, le=1_000_000)
    boundary: Boundary | None = Field(default=None, description="Optional measured footprint. Without it, only the supplied center point is stored; no area or boundary is invented.")

    _date = field_validator("survey_date")(valid_date)
    _boundary = field_validator("boundary")(valid_boundary)

    @model_validator(mode="after")
    def center_inside_boundary(self):
        if self.boundary and not shape(self.boundary.model_dump()).covers(Point(self.longitude, self.latitude)):
            raise ValueError("Plot center must fall inside its supplied boundary")
        return self


class TreeRecord(StrictModel):
    tree_id: Identifier
    plot_id: Identifier = Field(description="Must match a plot_id included in this same package.")
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    species_code: str | None = Field(default=None, pattern=r"^[A-Z][A-Z0-9_-]{1,15}$", description="USDA PLANTS code when known; null if unknown, never inferred by the agent.")
    height: float | None = Field(default=None, gt=0, le=500, description="Measured height in units.height; imported values are normalized to meters and checked again.")
    dbh: float | None = Field(default=None, gt=0, le=3000, description="Measured diameter in units.dbh; imported values are normalized to centimeters and checked again.")
    live_dead: Literal["L", "D", "M"] | None = None

    @model_validator(mode="after")
    def has_measurement(self):
        if self.height is None and self.dbh is None:
            raise ValueError("Provide at least one measured height or dbh")
        return self


class MissionRecord(StrictModel):
    mission_id: Identifier
    name: str = Field(min_length=1, max_length=200)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    boundary: Boundary
    aircraft: str | None = Field(default=None, min_length=1, max_length=120)
    altitude_m: float | None = Field(default=None, gt=0, le=10000)
    camera_pitch: float | None = Field(default=None, ge=0, le=90)
    image_count: int | None = Field(default=None, ge=0, le=10_000_000)
    withheld: bool = False

    _date = field_validator("date")(valid_date)
    _boundary = field_validator("boundary")(valid_boundary)


class ContributionPackage(StrictModel):
    schema_version: Literal["1.0"]
    package_id: Identifier = Field(description="Your stable package identifier. Only one imported version of this identifier is allowed.")
    title: str = Field(min_length=1, max_length=200)
    project_name: str = Field(min_length=1, max_length=120)
    contributor: str = Field(min_length=1, max_length=160, description="Person or organization credited for the contribution.")
    source_url: str | None = Field(default=None, max_length=2000, pattern=r"^https?://[^\s]+$")
    license: Literal["CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0"]
    rights_confirmed: Literal[True] = Field(description="Confirm you have permission to contribute this data under the stated license.")
    crs: Literal["EPSG:4326"]
    units: Units
    plots: list[PlotRecord] = Field(default_factory=list, max_length=200)
    trees: list[TreeRecord] = Field(default_factory=list, max_length=5000)
    missions: list[MissionRecord] = Field(default_factory=list, max_length=200)

    @field_validator("rights_confirmed", mode="before")
    @classmethod
    def explicit_rights_confirmation(cls, value):
        if type(value) is not bool or value is not True:
            raise ValueError("rights_confirmed must explicitly be true")
        return value

    @model_validator(mode="after")
    def check_relationships(self):
        if not (self.plots or self.trees or self.missions):
            raise ValueError("Include at least one plot, tree or mission")
        for collection, key in [(self.plots, "plot_id"), (self.trees, "tree_id"), (self.missions, "mission_id")]:
            ids = [getattr(row, key) for row in collection]
            if len(ids) != len(set(ids)):
                raise ValueError(f"Duplicate {key} in this package")
        plots = {p.plot_id: p for p in self.plots}
        for tree in self.trees:
            if tree.plot_id not in plots:
                raise ValueError(f"Tree {tree.tree_id}: plot_id {tree.plot_id} is not included in this package")
            boundary = plots[tree.plot_id].boundary
            if boundary and not shape(boundary.model_dump()).covers(Point(tree.longitude, tree.latitude)):
                raise ValueError(f"Tree {tree.tree_id} is outside its plot boundary")
            if self.units.height == "m" and tree.height is not None and tree.height > 150:
                raise ValueError(f"Tree {tree.tree_id}: height exceeds 150 meters; verify the declared units")
            if self.units.dbh == "cm" and tree.dbh is not None and tree.dbh > 2000:
                raise ValueError(f"Tree {tree.tree_id}: dbh exceeds 2000 centimeters; verify the declared units")
        return self


EXAMPLE_PACKAGE = {
    "schema_version": "1.0", "package_id": "community-survey-2026-01",
    "title": "Community forest survey", "project_name": "Community Survey 2026",
    "contributor": "Your organization", "source_url": None, "license": "CC-BY-4.0",
    "rights_confirmed": True, "crs": "EPSG:4326", "units": {"height": "m", "dbh": "cm"},
    "plots": [{"plot_id": "P01", "survey_date": "2026-01-15", "date_approximate": False,
               "longitude": -120.1862, "latitude": 39.4064, "area_ha": None}],
    "trees": [{"tree_id": "T01", "plot_id": "P01", "longitude": -120.1862,
               "latitude": 39.4064, "species_code": "PIJE", "height": 8.2, "dbh": 22.4, "live_dead": "L"}],
    "missions": [],
}
