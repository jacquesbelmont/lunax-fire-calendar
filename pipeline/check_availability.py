"""Record SP and NRT date ranges per sensor using the FIRMS data_availability endpoint.

Owner issue: JA-2. SCOPE: R2, S4. Output goes into DATA_CONTRACT.md.
AI-assisted code (Claude Code); logged in AI_USE.md.
Needs FIRMS_MAP_KEY in .env. Never print the key (it is part of the URL).
"""
import requests

from config import load_map_key

URL = "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{key}/{sensor}"


def fetch_data_availability(sensor="ALL"):
    """Return the CSV text (data_id, min_date, max_date per dataset).
    `ALL` as listed on https://firms.modaps.eosdis.nasa.gov/api/data_availability/ (checked 2026-11-15)."""
    try:
        resp = requests.get(URL.format(key=load_map_key(), sensor=sensor), timeout=60)
        resp.raise_for_status()
    except requests.RequestException as exc:
        # Re-raise without the exception text: it contains the URL, and the URL contains the key.
        raise RuntimeError(f"data_availability request failed ({type(exc).__name__})") from None
    return resp.text


def main():
    print(fetch_data_availability())


if __name__ == "__main__":
    main()
