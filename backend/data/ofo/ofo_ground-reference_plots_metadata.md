# OFO ground reference plots (`ofo_ground-reference_plots.gpkg`)

## Overview

This file contains plot-level metadata and boundaries for the ground-reference (traditional manual) forest inventory plots in the Open Forest Observatory (OFO) collection. Each row is one **plot**: an area within which trees meeting the plot's tally rules were stem-mapped (located and measured). Tree-level data for these plots are in the companion file `ofo_ground-reference_trees.gpkg`, linked by `plot_id`. The plots were contributed by many research groups and agencies, each with its own field protocol. OFO standardized the contributed data to a common schema.

This is a geospatial data file in which each row is a polygon representing the ground plot footprint, and each column is a metadata attribute describing the polygon. It can be read by GIS software such as QGIS, the `sf` package in R, or the `geopandas` library in Python.

**Missing values** are empty (NULL). Booleans are stored as GeoPackage BOOLEAN (0 = false, 1 = true).

**Plot tally rules.** Plots differ in which trees were measured. Together, `min_dbh`, `min_dbh_live`, `min_ht`, `min_ht_ohvis`, `includes_snags`, and the hyperplot fields define which trees a plot is complete for. OFO sets these thresholds so that **all trees above them can be assumed to have been measured** throughout the plot. The aim is confidence in completeness, not capturing as many trees as possible. During standardization:
- Contributed trees below the thresholds were removed, because trees of that size were not exhaustively surveyed. For example, seedlings measured only in regeneration subplots were dropped.
- If a survey changed its minimum size partway through, the largest minimum was applied to the whole plot.
- Down dead trees are not included.

When a plot has both `min_dbh` and `min_ht`, a tree is tallied if it meets **either** one (DBH ≥ `min_dbh` OR height ≥ `min_ht`). Check these fields before comparing plots or using them as complete reference data for tree detection.

---

## Attributes

### Identifiers and project

| Column | Type | Units / format | Description |
|---|---|---|---|
| `plot_id` | text | 4-digit zero-padded string, e.g. `0070` | Unique OFO plot identifier. Links to `plot_id` in the trees file. |
| `project_id` | real | integer | OFO ground reference project ID. ***Note:*** stored as a real number (e.g. `6.0`). |
| `project_name` | text | – | Short project name, e.g. `STEF2007`, `NEON2023`. |
| `investigator_names` | text | – | Investigators who collected the data. |
| `investigator_contacts` | text | email(s) | Contact information for the investigators. |
| `license_short` | text | e.g. `CC BY 4.0` | Short license identifier. |
| `license` | text | free text | Full license statement, including any required citation. Some projects require a specific citation, and `CC BY NC SA 4.0` data cannot be used commercially. |
| `contributor_plot_id` | text | – | The data contributor's own ID for the plot. For hyperplots (plots in which different tree sizes were measured in different circular plot radii), carries a `_large` / `_small` suffix. |
| `hyperplot_id` | text | 4-digit string | ID of the hyperplot this plot belongs to (see below). Empty for ordinary plots. A **hyperplot** is a set of concentric (nested) plots at one location where different tree size classes were tallied in different-sized areas, for example large trees out to a large radius and small trees out to a small radius. Each concentric plot is a separate row in this file; rows sharing a `hyperplot_id` belong together. 28 plots (14 hyperplots) are in this file. |

### Survey

| Column | Type | Units / format | Description |
|---|---|---|---|
| `survey_date` | real | `YYYYMMDD`, `YYYYMM`, or `YYYY` (stored as a number) | Date the plot survey was completed. When only the month or year is known, the value is truncated to `YYYYMM` or `YYYY`. Convert to text before parsing. |
| `survey_date_approx` | boolean | – | True when the contributor did not provide the exact survey date, so `survey_date` is an approximation. This applies to most plots (286 of 287), including 248 that have a full `YYYYMMDD` value. |
| `plot_shape` | text | `circle`, `square`, `rectangular`, `irregular` | Shape of the plot boundary. |
| `plot_area_ha` | real | ha | Plot area computed during dataset curation. |
| `subplots` | boolean | – | Whether the plot was surveyed as several contiguous subplots, each measured from its own center. The tree table's `subplot_id` says which subplot each tree belongs to. |
| `subplot_shape` | text | `square`, `irregular` | Shape of each subplot. Empty if `subplots` is false. |
| `subplot_area` | real | m² | Area of each subplot. Empty if `subplots` is false. |
| `plot_lon` | real | decimal degrees, WGS 84 | Longitude of the plot center (circular plots) or centroid (others).
| `plot_lat` | real | decimal degrees, WGS 84 | Latitude of the plot center or centroid. |

### Tally rules and measured attributes

| Column | Type | Units / format | Description |
|---|---|---|---|
| `min_dbh` | real | cm | Minimum diameter at breast height (DBH, 1.37 m) of trees tallied in the plot; all trees at or above it were measured. Empty if there was no DBH threshold. |
| `min_dbh_live` | real | cm | Minimum DBH for **live** trees, used when live and dead trees had different thresholds. In that case `min_dbh` applies to dead trees (snags). Empty if not applicable. |
| `max_dbh_of_primary_trees` | real | cm | Only relevant for plots that are a part of a hyperplot. The largest DBH of trees tallied in this plot. Larger trees at this location are recorded only under the companion plot with the same `hyperplot_id`, even if they stand inside this plot. Empty for the plot that holds the largest trees. |
| `min_ht` | real | m | Minimum height of tallied trees. Empty if there was no height threshold. |
| `min_dbh_ohvis` | real | cm | Minimum DBH for trees whose tops are visible from above the canopy ("overhead visible"), when such trees had a separate, lower threshold. |
| `min_ht_ohvis` | real | m | Minimum height for overhead-visible trees, when such trees had a separate threshold. **Filled with `min_ht` when no separate threshold was recorded**, so it is the effective height threshold for overhead-visible trees. For example, most TNC2023 plots tally trees with DBH > 25.4 cm (10 in) or height > 6.1 m (20 ft). They also tally any overhead-visible tree taller than 4.57 m (15 ft), so `min_ht_ohvis` = 4.57. |
| `num_ohvis_trees_excluded` | real | count | Estimated number of overhead-visible tally trees that were **not** measured. These are small overhead-visible trees that met the overhead-visible tally rule (see `min_ht_ohvis`) and were skipped. Two North Yuba protocols (used for TNC2023 and VP2022 plots) allowed this when tallying them would push the plot past ~200 trees. The field crew then recorded an estimated count instead of measuring them. A non-empty value (populated for 11 plots in TNC2023 and VP2022) means the plot is **incomplete for small overhead-visible trees**: about this many such trees are missing from the trees file. (However, all plots are still complete for trees meeting `min_dbh` and/or `min_ht`.) Empty means none were excluded or the concept does not apply. |
| `exhaustive_survey` | boolean | – | Whether all trees meeting the plot's tally rules (`min_dbh`, `min_dbh_live`, `min_ht`, `min_ht_ohvis`, `includes_snags`) were mapped throughout the plot. False means only a subset of qualifying trees was mapped (for example, a walk-through survey that recorded selected trees by GPS, or that exaustively surveyed only trees of certain focal species), so the plot cannot be used as complete reference data. This is independent of `num_ohvis_trees_excluded`: a plot that is complete apart from the skipped overhead-visible trees would still be `true` here, so check both fields when completeness matters. |
| `includes_snags` | boolean | – | Whether standing dead trees (snags) meeting the tally thresholds were recorded. |
| `includes_damage` | boolean | – | Whether tree damage that may affect the height–diameter relationship (e.g. broken or dead tops) was recorded in the tree table's `damage_*` fields. |
| `damage_codes_inspected` | text | `; `-separated FIA damage codes | The damage codes the survey specifically looked for. If a tree does not have one of these codes, it can be assumed not to have that damage. Code definitions are in the trees description. |
| `height_measured` | boolean | – | **Computed from the tree data:** true if more than 90% of the plot's trees have a measured height. Trees with DBH ≥ 500 cm or height ≥ 100 m (assumed errors) are excluded first. |
| `top_species` | text | e.g. `ABCO (49%), CADE27 (29%), PILA (13%)` | **Computed from the tree data:** the three most dominant species (USDA PLANTS codes, see the trees description) and their percent of the plot total. The percentage is by basal area (from DBH). If no tree has DBH, it is by summed height. If neither was measured, it is by tree count. Outlier trees (DBH ≥ 500 cm or height ≥ 100 m) are excluded. |

### Notes

| Column | Type | Units / format | Description |
|---|---|---|---|
| `notes` | text | free text | Plot-level caveats from OFO or the data contributor, for example where a plot may be incomplete relative to its stated tally thresholds (SSMT2024, DS2024). Empty for most plots. |

### Usage restriction

| Column | Type | Units / format | Description |
|---|---|---|---|
| `withhold_from_training` | boolean | – | **Important usage restriction.** OFO has designated a stratified subset of approximately 20% of plots to be excluded from training machine-learning models intended for broad use by the forest-mapping community. These plots are reserved as test data for model evaluation and intercomparison. True (1) = withheld. |
