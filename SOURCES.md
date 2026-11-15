# SOURCES

## Official sources
- https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/
- https://www.spaceappschallenge.org/resources/project-submission-guide/
- https://www.spaceappschallenge.org/resources/judging-awards-guide/
- https://www.spaceappschallenge.org/legal/
- https://www.earthdata.nasa.gov/data/tools/firms
- https://firms.modaps.eosdis.nasa.gov/api/
- https://firms.modaps.eosdis.nasa.gov/download/
- https://firms.modaps.eosdis.nasa.gov/academy/
- https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know

## Compiled reference
- [method/FIRMS_REFERENCE.md](method/FIRMS_REFERENCE.md) (AI-assisted, to be reviewed by the team; lists its own sources)
- FIRMS archive README, November 2026: [data/reference/FIRMS_archive_README_2026-11.rtf](data/reference/FIRMS_archive_README_2026-11.rtf)
- Country yearly summary: https://firms.modaps.eosdis.nasa.gov/country/
- Attributes: https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs
- FIRMS FAQ: https://www.earthdata.nasa.gov/data/tools/firms/faq
- LANCE disclaimer: https://www.earthdata.nasa.gov/data/projects/lance#ed-lance-disclaimer
- FIRMS country files index: https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt
- FIRMS missing data (used for the month flags, DE-14): https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data
- FIRMS area API (NOAA-21, `VIIRS_NOAA21_SP`, 2024-01-17 to 2025-12-31; needs a free MAP_KEY): https://firms.modaps.eosdis.nasa.gov/api/area/ ; date ranges: https://firms.modaps.eosdis.nasa.gov/api/data_availability/

## Other sources used in the method (method/DECISIONS.md, method/METHOD.md)
- IBGE state boundary of Rondônia (demo area, DE-1; copy in config/area_boundary.geojson): https://servicodados.ibge.gov.br/api/v3/malhas/estados/11?formato=application/vnd.geo+json&qualidade=maxima
- CAMS, "Drifting away from MODIS in the CAMS Global Fire Assimilation System", 2026-02-25 (MODIS end-of-mission dates, DE-2): https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system
- Schroeder, Oliva, Giglio, Csiszar (2014), The New VIIRS 375 m active fire detection data product, Remote Sensing of Environment 143:85-96, doi:10.1016/j.rse.2013.12.008 (DE-2; full paper read 2026-11-15): https://directreadout.sci.gsfc.nasa.gov/publications_documents/Schroeder_et_al_2014b_RSE.pdf
- MODIS Collection 6 and 6.1 Active Fire Product User's Guide, version 1.0, May 2021 (confidence classes, MCD14ML version naming, `type` codes; linked from the FIRMS FAQ): https://www.earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf
- VIIRS Collection 2 375 m Active Fire User Guide, version 1.2, June 2025 (VIIRS `type` codes; linked from the FIRMS FAQ): https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf

## Space Apps Connect discussions
- Challenge author (official): https://github.com/nasa/spaceapps/discussions/1879
- GO Team (official): https://github.com/nasa/spaceapps/discussions/1981
- GO Team (official): https://github.com/nasa/spaceapps/discussions/2057
- Navigators (advisory): https://github.com/nasa/spaceapps/discussions/2016
- Navigators (advisory): https://github.com/nasa/spaceapps/discussions/1959
- Navigators (advisory): https://github.com/nasa/spaceapps/discussions/2125

## References

| Library / resource | Version | License | Where used |
|--------------------|---------|---------|------------|
| leaflet | 1.9.4 | BSD-2-Clause | docs/lib/leaflet/ |
| leaflet-draw | 1.0.4 | MIT (text in docs/lib/leaflet-draw/LICENSE, from https://github.com/Leaflet/Leaflet.draw/blob/v1.0.4/MIT-LICENSE.md) | docs/lib/leaflet-draw/ |
| plotly.js-dist-min | 4.3.0 | MIT | docs/lib/plotly/ |
| IBGE malhas (Rondônia boundary) | API v3, retrieved 2026-11-14 | No license is stated. The IBGE portal's "Termo de Uso e Política de Privacidade para Serviços do Portal do IBGE" (version 1, published 2024-03-11; linked under "Privacidade" in the footer of https://www.ibge.gov.br; read in a browser on 2026-11-15) covers personal data (LGPD), cookies and user responsibilities, and says nothing about licensing or attribution of published data. The malhas API documentation (https://servicodados.ibge.gov.br/api/docs/malhas?versao=3) states none either. The source is recorded in the file properties and in `docs/data/metadata.json` (`area.boundary_source`), and credited in the app footer | config/area_boundary.geojson, docs/data/area.geojson | config/area_boundary.geojson, docs/data/area.geojson |
| Python, direct dependencies (pipeline/requirements.txt) | pipeline/requirements.lock.txt | From the installed package metadata (2026-11-15): pandas BSD-3-Clause; numpy BSD-3-Clause (LICENSE.txt); scipy BSD-3-Clause (LICENSE.txt); statsmodels BSD-3-Clause; matplotlib PSF-based matplotlib license; requests Apache-2.0; python-dotenv BSD-3-Clause; scikit-learn BSD-3-Clause (RA-6 ML challenger only). Indirect dependencies: MIT, BSD (joblib, threadpoolctl and cloudpickle: BSD-3-Clause), Apache-2.0, PSF-2.0, MIT-CMU (pillow) and MPL-2.0 (certifi), as in their metadata | pipeline/ |
| NASA FIRMS (data) | MODIS Collection 6/6.1 (`6.2`, `6.03`, `61.03`), VIIRS Collection 2 (`2`), standard processing (`docs/data/metadata.json`; method/METHOD.md) | Open: "NASA promotes full and open sharing of data" (FIRMS FAQ, "Are there any restrictions on using data or imagery from FIRMS?", https://www.earthdata.nasa.gov/data/tools/firms/faq); acknowledgment text in `docs/data/metadata.json` (`attribution`); users who pass FIRMS data on follow the FIRMS citation guidelines and replicate or link the disclaimer (data/reference/FIRMS_archive_README_2026-11.rtf) | pipeline/, docs/data/ |

## Map tiles (web app)
- OpenStreetMap tiles, loaded by the browser from https://tile.openstreetmap.org (ODbL data, attribution shown in the app): https://www.openstreetmap.org/copyright
