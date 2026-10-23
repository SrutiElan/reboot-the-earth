# OFO ground reference trees (`ofo_ground-reference_trees.gpkg`)

## Overview

This file contains the tree-level stem-map data for the Open Forest Observatory (OFO) field (ground reference) plots. Each row is one **tree stem**, located at the base of the stem and attributed with field measurements: species, diameter, height, live/dead status, crown position, damage, and so on. Plot-level metadata, including the tally rules that determine which trees each plot is complete for, are in the companion file `ofo_ground-reference_plots.gpkg`, linked by `plot_id`.

This is a geospatial data file in which each row is a point representing the tree location, and each column is a metadata attribute describing the tree. It can be read by GIS software such as QGIS, the `sf` package in R, or the `geopandas` library in Python.

Multi-stemmed trees that fork **below** breast height are recorded as separate stems at the same location. Trees that fork **above** breast height are one record.

---

## Attributes

### Identifiers and location

| Column | Type | Units / format | Description |
|---|---|---|---|
| `plot_id` | text | 4-digit zero-padded string | OFO plot ID; links to the plots file. |
| `subplot_id` | real | integer | For plots surveyed as several contiguous subplots (`subplots = true` in the plots file), the ID of the subplot whose center the tree was measured from. |
| `contributor_tree_id` | text | – | The data contributor's own ID for the tree, if provided. Not unique across plots or projects. |

### Size

| Column | Type | Units / format | Description |
|---|---|---|---|
| `dbh` | real | cm | Diameter at breast height (1.37 m above ground). Empty if not measured (e.g. trees shorter than breast height, or height-only surveys). |
| `height` | real | m | Measured height of the current top of the tree above the ground, including dead tops. Empty if not measured. Maximum value 132 m (presumed error). |
| `height_allometric` | real | m | Height predicted from DBH with allometric equations by the data contributor, for trees without a measured height. Only populated where `height` is empty. |
| `height_above_plot_center` | boolean | m (intended) | Height of the treetop above the plot center. |

### Species and status

| Column | Type | Units / format | Description |
|---|---|---|---|
| `species_code` | text | code | Species, as a USDA PLANTS symbol (e.g. `ABCO` = white fir, `PSME` = Douglas-fir, `CADE27` = incense cedar) or an OFO supplementary code for taxa identified only to genus or group (see table below). |
| `growth_form` | text | `tree`, `shrub`, `intermediate` | Growth form. `intermediate` = could be classified as either a small tree or a large shrub. |
| `live_dead` | text | `L`, `D`, `M` | `L` = live, `D` = dead, `M` = marginal (likely to die soon). Empty if not recorded. |
| `decay_class` | real | 1–5 | FIA snag decay class for standing dead trees: 1 = least decayed (recently dead, most branches and bark present) to 5 = most decayed. |

### Crown

| Column | Type | Units / format | Description |
|---|---|---|---|
| `crown_position` | real | code 1–5 | Crown class. 1 = open-grown, 2 = dominant, 3 = codominant, 4 = intermediate, 5 = overtopped. For some contributions, the definitions follow the FIA Handbook; for others, "dominant" is used for trees taller than all neighboring trees (those with crowns that touch the focal tree, or overlap it from a top-down view), "co-dominant" is used for trees with their tallest point is beyond the dripline of any taller trees (even if parts of its crown are under other trees), "intermediate" refers to trees on which the tallest point is under the dripline of a taller tree, but parts of tree crown are still visible from overhead, and "suppressed" refers to trees for which all or nearly all of the tree crown is not visible from above. |
| `ohvis` | real | 0 / 1 | Whether the tree is "overhead visible": its top is visible from above the canopy, i.e. it is open-grown, dominant, or codominant. Small trees in a canopy gap can qualify. Usually derived from crown position during standardization (1–3 = visible, 4–5 = not visible). The plot fields `min_ht_ohvis` and `num_ohvis_trees_excluded` refer to these trees. Important for matching field trees to trees detected in drone imagery. |
| `crown_ratio` | real | percent | Percent of the tree's height that has live branches. |
| `crown_ratio_compacted` | real | percent | Percent of the tree's height that would have live branches if the crown were compacted into a uniform mass without large gaps. |
| `height_to_crown` | real | m | Height to the base of the live crown. |
| `height_to_needle` | real | m | Height to the lowest green or brown needle. |
| `crown_width_1` | real | m | Crown width along one axis. |
| `crown_width_2` | real | m | Crown width along a second axis (typically perpendicular). |
| `crown_width_allometric` | real | m | Crown width predicted from allometric equations. |

### Fire effects

| Column | Type | Units / format | Description |
|---|---|---|---|
| `scorch_height` | real | m | Highest point above the ground where the crown was scorched by fire. |
| `percent_prefire_crown_green` | real | percent | Estimated percent of the **pre-fire** foliage volume that is currently green. |
| `precent_postfire_crown_green` | real | percent | Percent of the **current** foliage volume that is green. The column name contains a typo ("precent") inherited from the source data. |

### Damage

| Column | Type | Units / format | Description |
|---|---|---|---|
| `damage_1` | real | FIA damage code | Primary damage agent recorded for the tree. Codes follow the USFS FIA damage agent codes (FIA Database User Guide, Appendix H). The plot's `damage_codes_inspected` lists the codes that were looked for systematically; other codes are opportunistic. |
| `damage_2` | real | FIA damage code | Secondary damage agent. |
| `damage_3` | real | FIA damage code | Third damage agent. |
| `damage_4` | real | FIA damage code | Fourth damage agent. |
| `damage_5` | real | FIA damage code | Fifth damage agent. |

Damage codes defined in the OFO `damage-codes` table. These are the codes most relevant to height–diameter relationships; other codes in the data follow FIA:

| Code | OFO definition |
|---|---|
| 90001 | broken top |
| 90002 | dead top |
| 90004 | forked top |
| 90005 | forked below merchantable top, or simply "forked" |
| 90006 | crook or sweep, or excessive/major lean |
| 90011 | open wound |
| 70008 | mechanical (used for the DS2024 project's experimental damage treatments) |

Other codes present (FIA general categories) include: 10000 (insects), 11000 (bark beetles), 19000 (general insects), 2xxxx (disease), 30000 (fire), 41000 (animal damage), 5xxxx (weather), 60001 (vegetation, e.g. suppression or vines), 90000 (other physical damage), and 99000 (unknown).

### Notes

| Column | Type | Units / format | Description |
|---|---|---|---|
| `notes` | text | free text | Field or standardization notes about the tree that do not fit a standard attribute. |

---

## Supplementary species codes

Codes used where a tree was identified only to genus or group, or where no USDA PLANTS symbol applied:

| Code | Meaning |
|---|---|
| `UNK or UNCL` | Unknown species |
| `UNKNCONIFER or UNCLS` | Unknown softwood (conifer) |
| `AB` | Fir (*Abies*), species unknown |
| `PI` | Pine (*Pinus*), species unknown |
| `PIPJ` | Yellow pine: either ponderosa (*P. ponderosa*) or Jeffrey (*P. jeffreyi*) |
| `QUDE` | Deciduous oak, species unknown |
| `QUEV` | Evergreen oak, species unknown |
| `SALIX` | Willow, species unknown |
| `JUN` | Juniper, species unknown |
| `ACACIA` | Acacia, species unknown |

`QUEXMO` = *Quercus* × *morehus* (hybrid of *Q. kelloggii* × *Q. wislizeni*).
