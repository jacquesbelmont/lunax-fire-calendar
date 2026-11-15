"""Tests for pipeline/export_hotspots.py. Rows are copied from the real cleaned file modis_2000 (2026-11-15).
Run: .venv/bin/python -m unittest discover -s tests
"""
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import export_hotspots as eh  # noqa: E402

META = {"attribution": "We acknowledge the use of data (FIRMS).", "disclaimer_url": "https://example.org/d",
        "data_cutoff_date": "2025-12-31", "archived": "Archived FIRMS data, not live."}

REAL = pd.DataFrame({
    "latitude": ["-12.2886", "-9.9137", "-12.2882"], "longitude": ["-63.4996", "-64.8371", "-63.5652"],
    "acq_date": ["2000-11-05"] * 3, "acq_time": ["1440", "1439", "1440"], "sat": ["Terra"] * 3,
    "sensor": ["MODIS"] * 3, "confidence": ["78", "38", "26"], "daynight": ["D"] * 3, "frp": ["18.8", "11.3", "9.4"],
    "type": ["0"] * 3, "version": ["6.2"] * 3})


class HotspotRowsTests(unittest.TestCase):
    def test_adds_cell_id_like_aggregate_and_sorts(self):
        out = eh.hotspot_rows(REAL)
        self.assertEqual(list(out.columns), eh.COLUMNS)
        self.assertEqual(out["cell_id"].tolist(), ["320_460", "310_465", "310_466"])
        self.assertEqual(out["acq_time"].tolist(), ["1439", "1440", "1440"])

    def test_keeps_text_exactly(self):
        out = eh.hotspot_rows(REAL.assign(acq_time=["0058", "0058", "0058"]))
        self.assertTrue((out["acq_time"] == "0058").all())
        self.assertIn("-12.2886", out["latitude"].tolist())


class WriteTests(unittest.TestCase):
    def test_file_has_attribution_header_and_same_bytes_on_rerun(self):
        with tempfile.TemporaryDirectory() as d:
            rows = eh.hotspot_rows(REAL)
            header = eh.build_header(META, "modis", 2000)
            a, b = Path(d) / "a.csv.gz", Path(d) / "b.csv.gz"
            eh.write_hotspot_file(rows, header, a)
            eh.write_hotspot_file(rows, header, b)
            self.assertEqual(a.read_bytes(), b.read_bytes())
            lines = gzip.open(a, "rt").read().splitlines()
            self.assertTrue(all(l.startswith("#") for l in lines[:len(header)]))
            self.assertIn(META["attribution"], lines[1])
            self.assertIn("2025-12-31", lines[3])
            self.assertEqual(lines[len(header)], ",".join(eh.COLUMNS))
            self.assertEqual(len(lines), len(header) + 1 + 3)


class IndexTests(unittest.TestCase):
    def test_merge_and_drop_missing_files(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "modis_2000.csv.gz").write_bytes(b"x")
            e1 = {"source": "modis", "year": 2000, "file": "modis_2000.csv.gz", "rows": 3, "bytes": 1}
            e2 = {"source": "modis", "year": 2001, "file": "modis_2001.csv.gz", "rows": 9, "bytes": 1}
            files = eh.update_index([e1, e2], d)
            self.assertEqual([e["year"] for e in files], [2000])  # 2001's file does not exist
            self.assertEqual(json.loads((Path(d) / "index.json").read_text())["files"][0]["rows"], 3)


if __name__ == "__main__":
    unittest.main()
