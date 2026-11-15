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

## Other sources used in the method (method/DECISIONS.md, method/METHOD.md)
- IBGE state boundary of Rondônia (demo area, DE-1; copy in config/area_boundary.geojson): https://servicodados.ibge.gov.br/api/v3/malhas/estados/11?formato=application/vnd.geo+json&qualidade=maxima
- CAMS, "Drifting away from MODIS in the CAMS Global Fire Assimilation System", 2026-02-25 (MODIS end-of-mission dates, DE-2): https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system
- Schroeder, Oliva, Giglio, Csiszar (2014), The New VIIRS 375 m active fire detection data product, Remote Sensing of Environment 143:85-96, doi:10.1016/j.rse.2013.12.008 (DE-2; TODO(verify): read the full paper before quoting details): https://directreadout.sci.gsfc.nasa.gov/publications_documents/Schroeder_et_al_2014b_RSE.pdf

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
| leaflet-draw | 1.0.4 | MIT (package.json; TODO(verify): license text) | docs/lib/leaflet-draw/ |
| plotly.js-dist-min | 4.3.0 | MIT | docs/lib/plotly/ |
| IBGE malhas (Rondônia boundary) | API v3, retrieved 2026-11-14 | TODO(verify): IBGE data license - https://www.ibge.gov.br | config/area_boundary.geojson, docs/data/area.geojson |
| Python: pandas, numpy, scipy, statsmodels, matplotlib | pipeline/requirements.lock.txt | BSD-3-Clause (pandas, numpy, scipy, statsmodels); matplotlib license (PSF-based) - TODO(verify): exact license texts | pipeline/ |
| NASA FIRMS (data) | TODO(verify): product versions - data/PROVENANCE.md | TODO(verify): data license/citation - https://www.earthdata.nasa.gov/data/tools/firms | pipeline/, docs/data/ |
