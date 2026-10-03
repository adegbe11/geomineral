"""Rebuild apps/mobile/src/data/species.json from Wikidata (CC0).

Every item that is an instance of "mineral species" (Q12089225), with its
chemical formula and crystal system. Run with the project Python:
    .venv/Scripts/python.exe scripts/build-species.py
"""

import csv
import io
import json
from pathlib import Path

import httpx

QUERY = """SELECT ?m ?name (SAMPLE(?f) AS ?formula) (SAMPLE(?sysLabel) AS ?system) WHERE {
  ?m wdt:P31 wd:Q12089225 .
  ?m rdfs:label ?name . FILTER(LANG(?name) = "en")
  OPTIONAL { ?m wdt:P274 ?f }
  OPTIONAL { ?m wdt:P556 ?sys . ?sys rdfs:label ?sysLabel . FILTER(LANG(?sysLabel) = "en") }
} GROUP BY ?m ?name"""
SYSTEMS = {
    "cubic crystal system": "Cubic",
    "face-centered cubic": "Cubic",
    "body-centered cubic": "Cubic",
    "tetragonal crystal system": "Tetragonal",
    "hexagonal crystal system": "Hexagonal",
    "trigonal crystal system": "Trigonal",
    "orthorhombic crystal system": "Orthorhombic",
    "monoclinic crystal system": "Monoclinic",
    "triclinic crystal system": "Triclinic",
    "amorphous solid": "Amorphous",
}
OUT = Path(__file__).resolve().parents[1] / "apps/mobile/src/data/species.json"


def main():
    response = httpx.get(
        "https://query.wikidata.org/sparql",
        params={"query": QUERY},
        headers={
            "Accept": "text/csv",
            "User-Agent": "GeoMineral/0.2 (https://github.com/adegbe11/geomineral)",
        },
        timeout=180,
    )
    response.raise_for_status()
    rows = []
    for row in csv.DictReader(io.StringIO(response.text)):
        name = row["name"].strip()
        if not name:
            continue
        rows.append(
            [
                name[0].upper() + name[1:],
                row["formula"].strip(),
                SYSTEMS.get(row["system"], ""),
                row["m"].rsplit("/", 1)[-1],
            ]
        )
    rows.sort(key=lambda r: r[0].lower())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(rows)} species -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
