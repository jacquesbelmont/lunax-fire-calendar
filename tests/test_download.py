"""Tests for pipeline/download.py and pipeline/config.py.
Fixtures are copied from real FIRMS answers (2026-11-14); nothing here is invented data.
Run: .venv/bin/python -m unittest discover -s tests
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import config  # noqa: E402
import download  # noqa: E402

INDEX = ("filename,size,updated\n"
         "AttributesReadme.txt,3178,2025-06-23 13:53:50\n"
         "modis_2000_Afghanistan.csv,587,2023-12-14 11:15:07\n"
         "modis_2000_Brazil.csv,3,2023-12-14 11:15:07\n"
         "viirs-snpp_2012_Brazil.csv,3,2023-12-14 11:15:07\n")

ROW = ("<tr>\n<td>{}</td>\n<td>{}</td>\n<td>{}</td>\n<td>{}</td>\n</tr>\n")
REAL_HTML = (ROW.format("2026-07-16", "Suomi NPP (VIIRS)", "2024-03-06", "NOAA-21 (VIIRS)")
             + ROW.format("2026-05-30", "Suomi NPP (VIIRS)", "", ""))


class FakeResponse:
    def __init__(self, content=b"abc"):
        self.content = content
        self.text = content.decode()

    def raise_for_status(self):
        pass


class ParseIndexTests(unittest.TestCase):
    def test_skips_header_and_non_data_files(self):
        entries = download.parse_index(INDEX)
        self.assertEqual([e["filename"] for e in entries],
                         ["modis_2000_Afghanistan.csv", "modis_2000_Brazil.csv", "viirs-snpp_2012_Brazil.csv"])

    def test_select_filters_country_source_and_years(self):
        entries = download.parse_index(INDEX)
        picked = download.select_files(entries, ["Brazil"], sources=("modis",), years=(2000, 2000))
        self.assertEqual([e["filename"] for e in picked], ["modis_2000_Brazil.csv"])

    def test_unknown_country_is_an_error(self):
        with self.assertRaises(ValueError):
            download.select_files(download.parse_index(INDEX), ["Atlantis"])


class DownloadEntryTests(unittest.TestCase):
    entry = {"source": "modis", "year": 2000, "country": "Brazil", "filename": "modis_2000_Brazil.csv", "size": 3}

    def test_downloads_then_uses_cache(self):
        with tempfile.TemporaryDirectory() as d:
            session = mock.Mock()
            session.get.return_value = FakeResponse(b"abc")
            self.assertEqual(download.download_entry(self.entry, d, session), "downloaded")
            self.assertEqual(download.download_entry(self.entry, d, session), "cached")
            self.assertEqual(session.get.call_count, 1)
            self.assertTrue((Path(d) / "country/modis/2000/modis_2000_Brazil.csv").exists())

    def test_size_mismatch_leaves_no_file(self):
        with tempfile.TemporaryDirectory() as d:
            session = mock.Mock()
            session.get.return_value = FakeResponse(b"abcd")
            with self.assertRaises(RuntimeError):
                download.download_entry(self.entry, d, session)
            self.assertFalse(list(Path(d).rglob("*.csv")))
            self.assertFalse(list(Path(d).rglob("*.part")))


class RetryTests(unittest.TestCase):
    def test_retries_then_succeeds(self):
        session = mock.Mock()
        session.get.side_effect = [download.requests.ConnectionError("x"), FakeResponse()]
        with mock.patch.object(download.time, "sleep"):
            self.assertEqual(download.fetch_with_retries("u", session).content, b"abc")
        self.assertEqual(session.get.call_count, 2)

    def test_gives_up_after_all_retries(self):
        session = mock.Mock()
        session.get.side_effect = download.requests.ConnectionError("x")
        with mock.patch.object(download.time, "sleep"), self.assertRaises(RuntimeError):
            download.fetch_with_retries("u", session)
        self.assertEqual(session.get.call_count, download.RETRIES)


class AreaApiTests(unittest.TestCase):
    def test_windows_cover_each_day_once(self):
        w = download.api_windows("2024-01-17", "2024-02-02")
        days = [d for first, n in w for d in download.pd.date_range(first, periods=n)]
        self.assertEqual(days, list(download.pd.date_range("2024-01-17", "2024-02-02")))
        self.assertTrue(all(1 <= n <= download.API_MAX_DAYS for _, n in w))

    def test_errors_never_show_the_key(self):
        session = mock.Mock()
        session.get.side_effect = download.requests.ConnectionError("x")
        with tempfile.TemporaryDirectory() as d, mock.patch.object(download.time, "sleep"), \
                self.assertRaises(RuntimeError) as cm:
            download.download_area_api("VIIRS_NOAA21_SP", "2024-01-17", "2024-01-17", (-67, -13.75, -59.75, -7.75),
                                       "KEY123", d, session)
        self.assertNotIn("KEY123", str(cm.exception))
        self.assertIsNone(cm.exception.__cause__)


class MissingDaysTests(unittest.TestCase):
    def test_parses_sp_and_nrt_items(self):
        df = download.parse_missing_days({"success": True, "html": REAL_HTML})
        self.assertEqual(df.to_dict("records"), [
            {"sat": "NOAA21", "date": "2024-03-06", "processing": "NRT"},
            {"sat": "SNPP", "date": "2026-05-30", "processing": "SP"},
            {"sat": "SNPP", "date": "2026-07-16", "processing": "SP"},
        ])

    def test_unknown_satellite_is_an_error(self):
        bad = ROW.format("2026-07-16", "Mystery (X)", "", "")
        with self.assertRaises(ValueError):
            download.parse_missing_days({"success": True, "html": bad})

    def test_success_false_is_an_error(self):
        with self.assertRaises(RuntimeError):
            download.parse_missing_days({"success": False, "html": ""})

    def test_writes_csv(self):
        with tempfile.TemporaryDirectory() as d:
            session = mock.Mock()
            session.get.return_value = FakeResponse(json.dumps({"success": True, "html": REAL_HTML}).encode())
            download.download_missing_days(d, session)
            self.assertEqual((Path(d) / "missing_days.csv").read_text().splitlines()[0], "sat,date,processing")


class ConfigTests(unittest.TestCase):
    def test_area_not_set_is_an_error(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "area.json"
            p.write_text('{"name": null, "bbox_west_south_east_north": null}')
            with self.assertRaises(ValueError):
                config.load_area(p)

    def test_area_loaded(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "area.json"
            p.write_text('{"name": "x", "bbox_west_south_east_north": [-67, -13.75, -59.75, -7.75]}')
            self.assertEqual(config.load_area(p)["bbox"], (-67.0, -13.75, -59.75, -7.75))

    def test_bad_bbox_is_an_error(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "area.json"
            p.write_text('{"name": "x", "bbox_west_south_east_north": [10, 0, -10, 5]}')
            with self.assertRaises(ValueError):
                config.load_area(p)

    def test_missing_key_is_an_error(self):
        with mock.patch.object(config, "load_dotenv"), mock.patch.dict(config.os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                config.load_map_key()


if __name__ == "__main__":
    unittest.main()
