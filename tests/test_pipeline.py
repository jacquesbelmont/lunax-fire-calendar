"""Tests for the RA pipeline steps: clean.py, aggregate.py and the files that harmonize.py/export.py write.

Owner issues: RA-1, RA-2, RA-3. AI-assisted code (Claude Code); logged in AI_USE.md.
Fixtures are real FIRMS rows and real FIRMS missing-data entries, copied from the files downloaded on
2026-11-14/15 (file names in the comments); nothing here is invented data. The output checks read the
committed files in docs/data/, so they test what the app shows.
Run: .venv/bin/python -m unittest discover -s tests
"""
import gzip
import io
import json
import sys
import unittest
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import aggregate  # noqa: E402
import clean  # noqa: E402
from config import load_area  # noqa: E402

DOCS_DATA = ROOT / "docs" / "data"
MODIS = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight"
VIIRS = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight"
# data/raw/api/modis/2026/modis_2026_MODIS_SP.csv (area API, standard processing)
MODIS_SP = MODIS + ",type\n-12.9887,-61.2607,310.3,3.2,1.7,2026-01-19,1334,Terra,MODIS,52,61.03,286.5,28.9,D,0\n"
# data/raw/api/modis/2026/modis_2026_MODIS_NRT.csv (NRT: no `type`; acq_time without its leading zero)
MODIS_NRT = MODIS + "\n-12.01128,-60.54181,304.78,1.37,1.16,2026-09-02,105,Terra,MODIS,43,6.1NRT,292.32,7.18,N\n"
# data/raw/api/viirs-jpss2/2024/viirs-jpss2_2024_VIIRS_NOAA21_SP.csv (area API writes acq_time "541")
N21_SP = VIIRS + ",type\n-9.77567,-65.51217,308.09,0.39,0.36,2024-01-17,541,N21,VIIRS,n,2,285.1,0.73,N,0\n"
# data/raw/country/viirs-jpss1/2025/viirs-jpss1_2025_Brazil.csv (type 2 = other static land source)
N20_STATIC = VIIRS + ",type\n-9.65094,-65.73936,328.75,0.38,0.36,2025-04-17,0541,N20,VIIRS,n,2,288.96,2.22,N,2\n"
# data/raw/missing_days.csv (FIRMS missing_data, retrieved 2026-11-14)
MISSING = pd.DataFrame({"sat": ["Aqua", "Aqua"] + ["NOAA21"] * 9,
                        "date": ["2002-07-30", "2002-07-31", "2024-02-27", "2024-02-28", "2024-02-29", "2024-03-01",
                                 "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05", "2024-03-06"]})


def norm(text, route="api"):
    return clean.normalize(pd.read_csv(io.StringIO(text), dtype=clean.READ_DTYPES).assign(country=route), route)


class CleanTests(unittest.TestCase):
    def test_normalize_api_rows(self):
        n21, nrt = norm(N21_SP).iloc[0], norm(MODIS_NRT).iloc[0]
        self.assertEqual((n21["sat"], n21["sensor"], n21["acq_time"], n21["processing"]), ("NOAA21", "VIIRS", "0541", "SP"))
        self.assertEqual((nrt["sat"], nrt["acq_time"], nrt["processing"]), ("Terra", "0105", "NRT"))
        self.assertTrue(pd.isna(nrt["type"]))

    def test_rules_drop_static_sources_and_keep_nrt_after_sp(self):
        raw = pd.concat([norm(t) for t in (MODIS_SP, MODIS_NRT, N21_SP, N20_STATIC)], ignore_index=True)
        out, removed = clean.apply_cleaning_rules(raw, load_area()["bbox"], clean.load_boundary())
        self.assertEqual(removed["sp_type_not_0"], 1)  # the NOAA-20 type 2 row (DE-9)
        self.assertEqual(removed["outside_boundary"] + removed["outside_bbox"], 0)
        self.assertEqual(removed["nrt_covered_by_sp"], 0)  # NRT 2026-09-02 is after the last Terra SP date here
        self.assertEqual(sorted(out["sat"]), ["NOAA21", "Terra", "Terra"])
        self.assertEqual(len(raw) - sum(removed.values()), len(out))


class AggregateTests(unittest.TestCase):
    def flags(self, sat, year):
        return aggregate.flag_missing_months([(sat, year)], MISSING).set_index("year_month")

    def test_noaa21_start_and_missing_days(self):
        f = self.flags("NOAA21", 2024)
        self.assertEqual(f.loc[["2024-01", "2024-02", "2024-03", "2024-04"], "missing_days"].tolist(), [16, 3, 6, 0])
        self.assertEqual(f.loc[["2024-01", "2024-04"], "flagged"].tolist(), [1, 0])

    def test_aqua_starts_on_2002_07_04(self):
        f = self.flags("Aqua", 2002)
        self.assertEqual(f.index[0], "2002-07")
        self.assertEqual(f.loc["2002-07", "missing_days"], 5)  # 3 days before the start + 2 FIRMS missing days

    def test_no_month_after_data_end(self):
        end = aggregate.DATA_END
        f = self.flags("NOAA20", int(end[:4]))
        self.assertEqual(f.index.max(), end[:7])
        self.assertEqual(f.loc[end[:7], "flagged"], 0)  # DATA_END is a month end, so the last month is complete


class ExportedDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cells = pd.read_csv(DOCS_DATA / "monthly_cells.csv", dtype={"cell_id": str, "year_month": str})
        cls.months = pd.read_csv(DOCS_DATA / "months.csv", dtype={"year_month": str})
        cls.meta = json.loads((DOCS_DATA / "metadata.json").read_text())

    def test_period_is_complete_and_ends_at_data_end(self):
        end = aggregate.DATA_END
        expected = pd.period_range("2000-11", end[:7], freq="M").strftime("%Y-%m").tolist()
        self.assertEqual(sorted(self.cells["year_month"].unique()), expected)
        self.assertEqual((self.meta["period"]["last_month"], self.meta["data_cutoff_date"]), (end[:7], end))
        self.assertEqual(len(self.cells), self.cells["cell_id"].nunique() * len(expected))  # dense: no missing rows

    def test_native_months_are_the_reference_satellite(self):
        """DE-11: from 2012-02 the value is the observed count of S-NPP, then NOAA-20 from 2018-04."""
        early = self.cells[self.cells["estimated"].eq(0) & (self.cells["year_month"] < "2012-02")]
        self.assertTrue(early["viirs_eq"].isna().all())  # before VIIRS, estimated = 0 only marks months without data
        nat = self.cells[self.cells["estimated"].eq(0) & (self.cells["year_month"] >= "2012-02")]
        ref = nat["noaa20"].where(nat["year_month"] >= "2018-04", nat["snpp"])
        pd.testing.assert_series_equal(nat["viirs_eq"], ref, check_names=False, check_dtype=False)
        self.assertTrue(nat["viirs_eq_var"].fillna(0).eq(0).all())

    def test_estimated_months_follow_the_ratio(self):
        """DE-6: viirs_eq = k(month) x (Terra + Aqua) when both are valid, else k_T(month) x Terra."""
        k = self.meta["method"]["k_by_month"]
        est = self.cells[self.cells["estimated"].eq(1) & self.cells["viirs_eq"].notna()]
        both = est["aqua"].notna()
        month = est["year_month"].str[5:7]
        pred = (month.map(k["TA"]) * (est["terra"] + est["aqua"])).where(both, month.map(k["T"]) * est["terra"])
        # export.py writes 6 significant digits (float_format "%.6g"): relative rounding error at most 5e-6
        self.assertTrue(((pred - est["viirs_eq"]).abs() <= 5e-6 * est["viirs_eq"].abs() + 1e-9).all())
        self.assertTrue((est["viirs_eq_var"] >= 0).all())

    def test_flagged_months_are_never_zero(self):
        """AGENTS.md rule 6: a flagged satellite-month has an empty raw column, never 0."""
        col = {"Terra": "terra", "Aqua": "aqua", "SNPP": "snpp", "NOAA20": "noaa20", "NOAA21": "noaa21"}
        for _, f in self.months[self.months["flagged"].eq(1)].iterrows():
            values = self.cells.loc[self.cells["year_month"].eq(f["year_month"]), col[f["sat"]]]
            self.assertTrue(values.isna().all(), f"{f['sat']} {f['year_month']} is flagged but has values")

    def test_provisional_months_are_exactly_the_nrt_months(self):
        """DE-4: a satellite-month is provisional if and only if the hotspot files hold NRT rows for it."""
        nrt = set()
        for e in json.loads((DOCS_DATA / "hotspots" / "index.json").read_text())["files"]:
            with gzip.open(DOCS_DATA / "hotspots" / e["file"], "rt") as fh:
                h = pd.read_csv(fh, comment="#", dtype=str, usecols=["acq_date", "sat", "version"])
            h = h[h["version"].str.endswith("NRT")]
            nrt |= set(zip(h["sat"], h["acq_date"].str[:7]))
        prov = self.months[self.months["provisional"].eq(1)]
        self.assertEqual(set(zip(prov["sat"], prov["year_month"])), nrt)


class MLChallengerTests(unittest.TestCase):
    def test_verdict_follows_the_pre_registered_rule(self):
        """DE-18: the stored verdict must follow from the stored numbers and margin."""
        path = ROOT / "method" / "results" / "ml_metrics.json"
        if not path.exists():
            self.skipTest("pipeline/ml.py has not been run")
        r = json.loads(path.read_text())
        ta, margin = r["backcast"]["TA"]["ml"], r["margin"]
        wins = (ta["mdape_monthly_area"] <= margin["mdape_monthly_area_max"]
                and abs(ta["relative_bias_total"]) <= margin["abs_relative_bias_total_max"])
        self.assertEqual(r["verdict"]["ml_beats_ratio"], wins)
        self.assertEqual(margin, {"mdape_monthly_area_max": 0.113, "abs_relative_bias_total_max": 0.02})
        self.assertEqual(r["backcast"]["TA"]["ml"]["n_cell_months"], r["backcast"]["TA"]["ratio"]["n_cell_months"])

    def test_hybrid_verdict_follows_the_pre_registered_rule(self):
        """DE-19: the stored exploratory verdict must follow from the stored numbers."""
        path = ROOT / "method" / "results" / "ml_hybrid_metrics.json"
        if not path.exists():
            self.skipTest("pipeline/ml.py --hybrid has not been run")
        r = json.loads(path.read_text())
        sel, c, a = r["selection_loyo_2015_2025"], r["chosen"], r["fresh_test_2026"]["2026_all"]
        self.assertEqual(c, min(("A", "B", "C"), key=lambda k: sel[k]["median_mdape_monthly_area"]))
        promising = (sel[c]["median_mdape_monthly_area"] < sel["ratio"]["median_mdape_monthly_area"]
                     and a["hybrid"]["mdape_monthly_area"] < a["ratio"]["mdape_monthly_area"]
                     and abs(sel[c]["pooled_relative_bias_total"]) <= 0.02
                     and abs(a["hybrid"]["relative_bias_total"]) <= 0.02)
        self.assertEqual(r["exploratory_verdict"]["promising"], promising)


class MunicipalitiesTest(unittest.TestCase):
    """DE-24: every detection gets one municipality, and the 52 municipal series add up to the whole area."""

    def test_assignment_of_real_detections(self):
        import export  # noqa: E402 (imports matplotlib and scipy)
        features = json.loads((ROOT / "config" / "municipalities.geojson").read_text(encoding="utf-8"))["features"]
        with gzip.open(DOCS_DATA / "hotspots" / "viirs-jpss1_2025.csv.gz", "rt") as f:
            rows = pd.read_csv(io.StringIO("".join(line for line in f if not line.startswith("#"))))
        idx, n_nearest = export.municipality_of(rows["longitude"].to_numpy(), rows["latitude"].to_numpy(), features)
        self.assertEqual(len(features), 52)
        self.assertTrue(((idx >= 0) & (idx < 52)).all())
        self.assertLessEqual(n_nearest, 1)  # 1 of 2,168,855 in the full export (2026-11-15)

    def test_municipal_sums_equal_the_area(self):
        cells = pd.read_csv(DOCS_DATA / "monthly_cells.csv", dtype={"year_month": str})
        munis = pd.read_csv(DOCS_DATA / "municipalities.csv", dtype={"year_month": str, "area_id": str})
        self.assertEqual(munis["area_id"].nunique(), 52)
        for col in ["viirs_eq", "terra", "aqua", "snpp", "noaa20", "noaa21"]:
            a = cells.groupby("year_month")[col].sum(min_count=1)
            m = munis.groupby("year_month")[col].sum(min_count=1).reindex(a.index)
            same = ((a - m).abs() <= 1e-3 * a.abs().clip(lower=1)) | (a.isna() & m.isna())
            self.assertTrue(same.all(), col)
