# OFO drone missions metadata (`ofo_drone-missions.gpkg`)

## Overview

This file is the mission-level catalog of the Open Forest Observatory (OFO) drone imagery collection. Each row (feature) is one drone imagery **mission**: a set of images collected over one site with one set of flight parameters (altitude, overlap, camera pitch, aircraft, sensor). A mission may span multiple days, base station locations, or flights (battery swaps). A mission is composed of one or more **sub-missions**, which are the finest-grained units of collection that OFO could separate (e.g. the N–S and E–W passes of a grid mission, or two halves of a site flown on different days).

This is a geospatial data file in which each row is a polygon representing the drone mission footrpint, and each column is a metadata attribute describing the polygon. It can be read by GIS software such as QGIS, the `sf` package in R, or the `geopandas` library in Python.

Each mission's metadata combines three sources:

1. **Contributor-provided ("nominal") metadata**, derived from information provided by OFO contributors. Attributes ending in `_nominal`, and most attributes without a suffix, come from here.
2. **Attributes derived programmatically** from the image EXIF metadata. These end in `_derived`.
3. **Curation notes** recorded by OFO staff during visual review of each sub-mission (`anomal*` columns), plus a few post-processing attributes (photogrammetry-derived altitude, ML-training withholding flag).

### Multiple comma-separated values in one attribute

Contributor-provided attributes are recorded per contributed dataset, and a mission can combine several of them. For example:
- a grid mission whose N–S and E–W passes were entered separately;
- a site flown over two days from two base station locations;
- a mission whose imagery came from two related records that could not be separated.

When these sub-mission records disagree on an attribute, the mission-level value lists each **distinct** value once, separated by `, `. Examples:
- `overlap_front_nominal = "90, 80"`: some sub-missions were programmed with 90% front overlap and others with 80%.
- `base_lat = "39.199095, 39.196221"`: two base station locations were used.

Things to know when working with these values:
- **No order is guaranteed.** The values are not in the same order as `sub_mission_ids`, and they cannot be paired value-by-value across columns. To see which sub-mission had which value, use the sub-mission-level metadata (`{sub_mission_id}_sub-mission-metadata.gpkg` in each mission's folder in the OFO data repository).
- **Missing values are skipped.** If one sub-mission has a value and another is missing, only the non-missing value appears.
- **`n_images` is the exception.** It lists one count per sub-mission, in sub-mission order, and repeats equal counts.

Anomaly columns from the curation notes use `; ` as the separator instead, with one entry per sub-mission that had an anomaly (see that section).

Derived (`_derived`) attributes are computed once from all images of the whole mission, so they never contain multiple values.

Because any contributed column can hold such a list, **all attribute columns except `withhold_from_training` are stored as text**, even ones that are conceptually numeric or boolean. Convert them as needed after deciding how to handle multi-value entries.

---

## Attributes

### Identifiers and structure

| Column | Type | Units / format | Description |
|---|---|---|---|
| `mission_id` | text | 6-digit zero-padded string, e.g. `000123` | Unique OFO mission identifier. Used in published data paths (`ofo-public/drone/missions_03/{mission_id}/`). |
| `sub_mission_ids` | text | comma-separated list of `{mission_id}-{NN}` | IDs of the sub-missions making up this mission. |
| `project_name` | text | – | Short name of the contributed batch of imagery (the folder under which it was ingested), e.g. `2023-ny-ofo`, `2024-ucnrs`. |
| `submission_id` | text | integer(s) | A delivery of data from a contributor. |
| `project_id` | text | `{YYYYMMDD}-{NNNN}` | The funded project or campaign under which the mission was flown. The date is the earliest known collection date in the project when the project record was created. |
| `contributor_dataset_name` | text | – | The contributor's own name for the dataset (e.g. the original folder name). Comma-separated when the sub-missions had different names. May contain stray line breaks. |
| `dataset_id_old` | text | `{YYYYMMDD}-{NNNN}` | Legacy dataset ID from an earlier ID scheme. Deprecated; populated for some missions only. |

### Contributor and license (project-level)

| Column | Type | Units / format | Description |
|---|---|---|---|
| `contributor_names` | text | – | People or organizations who collected and contributed the data. May be overridden for individual datasets. |
| `contact_info` | text | email | Contact for the contributor. |
| `license` | text | – | License under which the imagery is shared. |
| `objectives` | text | – | Why the data were collected. |
| `forest_focused` | text (boolean) | `TRUE` / `FALSE` | Whether the project's imagery targets forest. |

### Equipment

| Column | Type | Units / format | Description |
|---|---|---|---|
| `aircraft_model_id` | text | integer | ID of the `aircraft-models` record. |
| `aircraft_model_name` | text | – | Aircraft model name, e.g. `Phantom 4 RTK`, `Mavic 3 Multispectral`. |
| `sensor_id` | text | integer | ID of the `sensors` record. |
| `sensor_name` | text | – | Camera/sensor name, e.g. `P4RTK integrated camera`, `Zenmuse P1`. |
| `modality` | text | – | Imaging modality. |
| `flight_planner_id` | text | integer | ID of the `flight-planners` record. |
| `flight_planner_name` | text | – | Flight planning/control app, e.g. `DJI Pilot 2 (integrated remote)`, `Map Pilot`, `manual free flight`. |

### Nominal (contributor-reported) flight parameters

| Column | Type | Units / format | Description |
|---|---|---|---|
| `date` | text | `YYYY-MM-DD` | First date of data collection as reported by the contributor. If not populated, use `earliest_date_derived` instead. |
| `flight_pattern` | text | `parallel`, `grid`, `unstructured` | Flight pattern. `parallel` = a single set of parallel transects. `grid` = two perpendicular sets of transects. `unstructured` = no regular transects. |
| `smart_oblique` | text (boolean) | `TRUE` / `FALSE` | Whether the contributor reports flying in DJI "smart oblique" mode (camera cycles through several oblique angles). Compare with `smart_oblique_derived`. |
| `overlap_front_nominal` | text | percent | Programmed forward (along-track) image overlap. For grid missions, the overlap of one orientation. |
| `overlap_side_nominal` | text | percent | Programmed side (across-track) image overlap. For grid missions, the overlap of one orientation. |
| `camera_pitch_nominal` | text | degrees up from nadir (0 = nadir) | Programmed camera pitch. |
| `altitude_agl_nominal` | text | m | Programmed flight altitude above ground level. If `terrain_follow = no`, it is relative to the takeoff point. Note that some missions note that altitude was entered in feet (see `dataset_notes`), while all others are in meters. |
| `altitude_ahp_obs` | text | m | Altitude above the home point observed during flight, recorded only when it differed from the programmed altitude. |
| `terrain_follow` | text | `no`, `dsm_auto`, `dsm_manual`, `realtime` | Terrain-following method. `dsm_auto` = DSM downloaded automatically by the flight app. `dsm_manual` = DSM manually loaded into the app. `realtime` = onboard sensor-based terrain following. `no` = constant altitude relative to takeoff. |
| `exposure_compensation` | text | EV (stops) | Camera exposure compensation setting. 0 if none. |
| `rtk_nominal` | text | `TRUE`, `FALSE`, `unknown` | Whether the contributor reports that the flight used RTK GNSS positioning. |
| `base_lat` | text | decimal degrees, WGS 84 | RTK base station latitude. Multiple values are comma-separated. |
| `base_lon` | text | decimal degrees, WGS 84 | RTK base station longitude. ***Likely error:*** 17 of 454 populated values are **positive** (e.g. `120.906005`) although all sites are in the western hemisphere. These should be read as west longitude (negated). |
| `base_alt` | text | m | RTK base station altitude as reported by the base station used. |
| `base_marked_permanently` | text (boolean) | `TRUE` / `FALSE` | Whether the base station location was permanently marked (e.g. with rebar). |
| `weather` | text | free text | Weather during the flight. |
| `dataset_notes` | text | free text | Contributor or curator notes about the dataset. |

### Derived from image EXIF metadata

All `_derived` attributes are computed from the images retained after curation (extraneous and duplicate images removed) that lie within the footprint polygon.

| Column | Type | Units / format | Description |
|---|---|---|---|
| `image_count_derived` | integer | images | Number of images in the mission. |
| `file_size_derived` | text | GB (10⁹ bytes) | Total file size of all images. |
| `file_format_derived` | text | e.g. `JPG` | Most common image file format. |
| `resolution_x_derived` | integer | pixels | Most common image width. |
| `resolution_y_derived` | integer | pixels | Most common image height. |
| `aspect_ratio_derived` | text | ratio | `resolution_x_derived / resolution_y_derived`, rounded to 2 decimals. |
| `earliest_date_derived` | text | `YYYY-MM-DD` | Date of the earliest image. |
| `earliest_year_derived` | text | `YYYY` | Year of the earliest image. |
| `earliest_datetime_local_derived` | text | `YYYY-MM-DD HH:MM:SS`, **time zone varies (see note)** | Timestamp of the earliest image. |
| `latest_datetime_local_derived` | text | `YYYY-MM-DD HH:MM:SS`, time zone varies | Timestamp of the latest image. |
| `earliest_time_local_derived` | text | `HH:MM:SS`, time zone varies | Time of day of the earliest image. |
| `latest_time_local_derived` | text | `HH:MM:SS`, time zone varies | Time of day of the latest image. |
| `single_date_derived` | boolean | `TRUE` / `FALSE` | Whether all images were captured on the same calendar date. |
| `solarnoon_utc_derived` | text | `HH:MM:SS` UTC | Time of solar noon at the mission centroid on `earliest_date_derived`. Compare with image times to estimate sun angle. |
| `centroid_lon_derived` | text | decimal degrees, EPSG:4326 | Longitude of the centroid of the image locations. |
| `centroid_lat_derived` | text | decimal degrees, EPSG:4326 | Latitude of the centroid of the image locations. |
| `area_derived` | text | ha | Area of the footprint polygon (`geom`). |
| `image_density_derived` | text | images / ha | Number of images within the footprint divided by `area_derived`. |
| `flight_speed_derived` | text | m/s | Median horizontal speed between consecutive images (median used to avoid the effect of battery swaps and turns). |
| `image_frequency_derived` | text | images / s | 1 / (mean interval between consecutive image captures), using only intervals between the 20th and 80th percentiles. |
| `camera_pitch_derived` | text | degrees from nadir (0 = nadir) | Camera pitch from EXIF gimbal pitch (converted to degrees up from nadir for DJI platforms). For non-smart-oblique missions it is the median absolute pitch. For smart-oblique missions it is the 90th percentile, i.e. the oblique angle. |
| `smart_oblique_derived` | boolean | `TRUE` / `FALSE` | `TRUE` if the 10th–90th percentile range of absolute camera pitch is ≥ 10°, indicating multiple camera angles within the mission. |
| `percent_images_rtk_derived` | integer | percent | Percent of images with an RTK fixed solution (EXIF `RTKFlag = 50`; DJI platforms only, 0 for others). |
| `white_balance_mode_derived` | text | `auto` / `manual` | Most common white balance setting across images. |
| `white_balance_pct_mode_derived` | integer | percent | Percent of images whose white balance matches `white_balance_mode_derived`. |
| `exposure_median_derived` | text | s | Median exposure (shutter) time. |
| `exposure_cv_derived` | text | unitless | Variability of exposure time: standard deviation divided by the **median** (not the mean). |
| `flight_terrain_correlation_derived` | integer | score 0–100 | **Terrain-follow fidelity score**, despite its name. It measures how constant the drone's height above ground was. AGL = drone GNSS altitude from EXIF minus ground elevation sampled at each image location from the AWS Terrain Tiles DEM (zoom 14, via the R `elevatr` package). AGL values outside the 10th–90th percentile are discarded, then score = max(0, 100 − 2 × SD(AGL in m)). 100 = perfectly constant AGL. The code can also write this as `gps_terrain_fidelity_derived`, a planned rename. ***UNSURE:*** confirm which name should be published. |

**Time zone of the `*_local_derived` timestamps: despite the name, many are in UTC, not local time.** Per image, `extract_datetime_local()` (`src/metadata-extraction_imagery_perimage.R`) takes the first non-missing EXIF field among `capture_datetime`, `GPSDateTime`, and `DateTimeOriginal`, and records no time zone. `GPSDateTime` is UTC, while `DateTimeOriginal` is the camera clock, usually set to local time. So any image whose EXIF includes `GPSDateTime` gets a UTC timestamp. The distribution of `earliest_time_local_derived` across all California missions (local daylight time = UTC − 7 h) confirms this:

| Aircraft (project) | Missions | Earliest-image hours | Interpretation |
|---|---|---|---|
| Phantom 4 RTK, Phantom 4 Standard / Advanced / Pro, Matrice 100, Matrice 300 | 278 | 09–17 | Local time |
| Mavic 3 (`2023-ny-ofo`) | 89 | 09–15 | Local time |
| Mavic 3 (`2023-tahoe-aspen`, `2024-ofo2`, `2024-ucnrs`, `2025-focal`, `2025-focal2`) | 198 | mostly 15–22 | UTC |
| eBee X, Evo II v2 | 17 | 16–23 | UTC |
| Matrice 210 RTK (`2020-ucnrs`) | 24 | 00–14 | ***UNKNOWN:*** probably an unset or wrong camera clock |

These interpretations are inferred from the times of day, not read from the raw EXIF. The fix would be to always use one field (e.g. `GPSDateTime`, in UTC) and label the column accordingly. Until then, compare a mission's times against `solarnoon_utc_derived`, which is always UTC: about 19:00–20:15 for California sites. `earliest_date_derived` can also be off by one day for UTC timestamps after 17:00 local time.

### Photogrammetry-derived altitude

| Column | Type | Units / format | Description |
|---|---|---|---|
| `agl_mean` | text | m | Mean camera height above ground, computed from photogrammetry outputs. AGL per image = aligned camera elevation from Metashape minus the photogrammetry DTM elevation beneath it. The mean uses only values between the 10th and 90th percentiles. Empty where photogrammetry did not produce enough valid values (< 5 aligned cameras over a valid DTM).
| `agl_fidelity` | text (integer) | score 0–100 | Terrain-follow fidelity score from the photogrammetry AGL values: max(0, 100 − 2 × SD(AGL in m)), using values between the 10th and 90th percentiles. More reliable than `flight_terrain_correlation_derived` because it uses aligned camera positions and a site-specific DTM. |

### Curation notes (from OFO visual review)

OFO curators reviewed every sub-mission (image locations, altitudes, camera angles) and recorded anomalies. Sub-mission notes are joined to the mission level with `; ` as the separator. Empty means no anomaly of that type was recorded.

| Column | Type | Units / format | Description |
|---|---|---|---|
| `anomaly_severity` | text | score 1–3 | Expected effect of the recorded anomalies on downstream products such as orthomosaics, point clouds, and tree detection. **1** = minor; not expected to affect downstream products. **2** = expected to affect downstream products, but cause significant degradation for tree detection. **3** = expected to significantly degrade downstream products (e.g. more than half the images missing, either randomly across the mission or in large chunks). Intermediate values (e.g. 2.5) occur. Missions with anomalies in several sub-missions have one value per sub-mission, joined by `; `. Empty = no anomaly recorded. |
| `anomalies_collection_time` | text | free text | Anomalies in collection timing, e.g. sub-missions flown in different years. |
| `anomalies_altitude` | text | free text | Anomalies in flight altitude, e.g. altitude discontinuities between images. |
| `anomalies_spatial` | text | free text | Spatial anomalies, e.g. gaps in coverage or irregular transect spacing. |
| `anomalies_camera_pitch` | text | free text | Anomalies in camera pitch, e.g. images at an unexpected angle. |
| `anomalies_excess_images` | text | free text | Excess images, e.g. re-flown or duplicated transects. |
| `anomalies_missing_images` | text | free text | Missing images, e.g. gaps in transects or incomplete missions. |
| `anomalies_other` | text | free text | Other anomalies. |
| `anomaly_notes` | text | free text | Curator notes explaining the anomaly records or severity assignment. |

Image IDs referenced in these notes have the form `{sub_mission_id}_{NNNNNN}` (e.g. `000047-01_000252`).

### Usage restriction

| Column | Type | Units / format | Description |
|---|---|---|---|
| `withhold_from_training` | boolean (0/1) | – | **Important usage restriction.** OFO has designated a stratified subset of approximately 20% of missions to be excluded from training machine-learning models intended for broad use by the forest mapping community. These missions are reserved as test data for model evaluation and intercomparison. `1` (true) = withheld.
