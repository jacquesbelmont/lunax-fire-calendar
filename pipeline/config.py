"""Load settings: FIRMS_MAP_KEY from .env and the demo area from config/area.json.

Owner issue: JA-2. SCOPE: R2, R4.
AI-assisted code (Claude Code); logged in AI_USE.md.
Never print or log the MAP_KEY.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
AREA_PATH = ROOT / "config" / "area.json"


def load_map_key():
    """Return FIRMS_MAP_KEY from the environment (.env). Fail clearly if missing."""
    load_dotenv(ROOT / ".env")
    key = os.environ.get("FIRMS_MAP_KEY", "").strip()
    if not key:
        raise RuntimeError("FIRMS_MAP_KEY is not set: copy .env.example to .env and add your key")
    return key


def load_area(path=AREA_PATH):
    """Return {"name": str, "bbox": (west, south, east, north)} from config/area.json (DE-1)."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    bbox = data.get("bbox_west_south_east_north")
    if not data.get("name") or not bbox:
        raise ValueError(f"{path}: demo area not set yet (decision DE-1 in method/DECISIONS.md)")
    west, south, east, north = (float(v) for v in bbox)
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError(f"{path}: bbox must be west,south,east,north with west < east and south < north")
    return {"name": data["name"], "bbox": (west, south, east, north)}
