"""Potential zones: where inside the radius each candidate mineral is most supported.

A grid is laid over the search circle. Every cell is scored from evidence that has a
real position: the mapped rock unit under the cell, recorded sites nearby, and the
distance to the nearest mapped fault. Adjacent high cells become named targets.
Evidence without a position (published research) is deliberately not spatialised.
"""

import math
import re

from shapely.geometry import LineString, Polygon
from shapely.geometry import Point as SPoint
from shapely.strtree import STRtree

from .analysis import ROCK_RULES, STRUCTURAL

SITE_KM = 3.0
FAULT_KM = 1.5


def _proj(lat: float, lng: float):
    kx = 111.32 * math.cos(math.radians(lat))
    return (
        lambda lo, la: ((lo - lng) * kx, (la - lat) * 110.57),
        lambda x, y: (lng + x / kx, lat + y / 110.57),
    )


def _rock_kind(text: str, commodity: str) -> str | None:
    kind = None
    for rule in ROCK_RULES:
        if commodity in rule["commodities"] and any(t in text for t in rule["terms"]):
            if rule["kind"] == "direct":
                return "direct"
            kind = "host"
    return kind


def _code(place: str) -> str:
    letters = re.sub(r"[^A-Za-z]", "", place).upper()
    return (letters[:3] or "LOC").ljust(3, "X")


def _summary(commodity: str, parts: list[dict]) -> list[str]:
    rocks = list(dict.fromkeys(p["rock"] for p in parts if p["rock"]))
    sites = set().union(*(p["sites"] for p in parts)) if parts else set()
    faults = [p["fault"] for p in parts if p["fault"] is not None]
    out = []
    if rocks:
        out.append(f"Mapped {', '.join(rocks[:2])}")
    if sites:
        noun = "site" if len(sites) == 1 else "sites"
        out.append(f"{len(sites)} recorded {commodity.lower()} {noun} in and around the zone")
    if any(p["producer"] for p in parts):
        out.append("Includes a past or present producing mine")
    if any(p.get("sample") for p in parts):
        out.append("Includes your lab-confirmed sample")
    if faults:
        out.append(f"Mapped fault as close as {min(faults):.1f} km")
    return out


def build_zones(
    lat: float,
    lng: float,
    radius_km: float,
    place: str,
    commodities: list[str],
    layers: dict,
    occurrences: list[dict],
) -> dict:
    fwd, back = _proj(lat, lng)
    units = []
    for u in layers.get("units", []):
        text = f"{u.get('lith', '')} {u.get('name', '')}".lower()
        for ring in u.get("rings", []):
            if len(ring) >= 4:
                try:
                    poly = Polygon([fwd(x, y) for x, y in ring]).buffer(0)
                except ValueError:
                    continue
                if not poly.is_empty:
                    units.append((poly, text, u.get("name", "")))
    unit_tree = STRtree([p for p, _, _ in units]) if units else None
    faults = [
        LineString([fwd(x, y) for x, y in path])
        for f in layers.get("faults", [])
        for path in f.get("paths", [])
        if len(path) >= 2
    ]
    fault_tree = STRtree(faults) if faults else None

    cell = max(1.0, radius_km / 12)
    n = int(math.ceil(radius_km / cell))
    centres = [
        (i * cell, j * cell)
        for i in range(-n, n + 1)
        for j in range(-n, n + 1)
        if math.hypot(i * cell, j * cell) <= radius_km
    ]
    under: dict[tuple, tuple[str, str] | None] = {}
    fault_d: dict[tuple, float] = {}
    for c in centres:
        pt = SPoint(c)
        hit = None
        if unit_tree is not None:
            for idx in unit_tree.query(pt):
                if units[idx][0].contains(pt):
                    hit = (units[idx][1], units[idx][2])
                    break
        under[c] = hit
        if fault_tree is not None:
            fault_d[c] = faults[fault_tree.nearest(pt)].distance(pt)

    result = {"cell_km": round(cell, 2), "by_commodity": {}}
    for commodity in commodities:
        sites = [
            (
                fwd(o["lng"], o["lat"]),
                "producer" in str(o.get("status", "")).lower(),
                o.get("status") == "Your confirmed sample",
            )
            for o in occurrences
            if commodity in o.get("commodities", [])
        ]
        # Only evidence types that exist in this area count towards the full scale.
        has_rock = any(u and _rock_kind(u[0], commodity) for u in under.values())
        has_fault = commodity in STRUCTURAL and bool(fault_d)
        scale = 0.4 + (0.45 if has_rock else 0) + (0.15 if has_fault else 0)
        cells, reasons = [], {}
        for c in centres:
            why: dict = {"rock": None, "sites": set(), "producer": False, "fault": None}
            g = 0.0
            if under[c]:
                kind = _rock_kind(under[c][0], commodity)
                if kind:
                    g = 1.0 if kind == "direct" else 0.6
                    why["rock"] = under[c][1] or "rock unit"
            near = [i for i, (p, _, _) in enumerate(sites) if math.dist(p, c) <= SITE_KM]
            s = min(1.0, len(near) / 3) * 0.8 if near else 0.0
            if near:
                why["sites"] = set(near)
                if any(sites[i][1] for i in near):
                    s += 0.2
                    why["producer"] = True
                if any(sites[i][2] for i in near):
                    s = min(1.0, s + 0.2)
                    why["sample"] = True
            f = 0.0
            if commodity in STRUCTURAL and c in fault_d and (g or s):
                if fault_d[c] <= FAULT_KM:
                    f = 1.0
                    why["fault"] = fault_d[c]
                elif fault_d[c] <= 2 * FAULT_KM:
                    f = 0.5
            score = round((0.45 * g + 0.4 * s + 0.15 * f) / scale, 3)
            if score >= 0.15:
                cells.append((c, score))
                reasons[c] = why
        if not cells:
            continue
        top = max(s for _, s in cells)
        cut = max(0.5, 0.75 * top)
        hot = {c for c, s in cells if s >= cut}
        score_of = dict(cells)
        targets, seen = [], set()
        for c in sorted(hot, key=lambda k: -score_of[k]):
            if c in seen:
                continue
            group, stack = [], [c]
            seen.add(c)
            while stack:
                k = stack.pop()
                group.append(k)
                for dx, dy in ((cell, 0), (-cell, 0), (0, cell), (0, -cell)):
                    nb = (round(k[0] + dx, 6), round(k[1] + dy, 6))
                    match = next((h for h in hot if math.dist(h, nb) < cell * 0.01), None)
                    if match is not None and match not in seen:
                        seen.add(match)
                        stack.append(match)
            cx = sum(k[0] for k in group) / len(group)
            cy = sum(k[1] for k in group) / len(group)
            why = _summary(commodity, [reasons[k] for k in group if k in reasons])
            tlng, tlat = back(cx, cy)
            targets.append(
                {
                    "commodity": commodity,
                    "lat": round(tlat, 5),
                    "lng": round(tlng, 5),
                    "score": max(score_of[k] for k in group),
                    "area_km2": round(len(group) * cell * cell, 1),
                    "distance_km": round(math.hypot(cx, cy), 1),
                    "reasons": why,
                }
            )
        targets = sorted(targets, key=lambda t: (-t["score"], -t["area_km2"]))[:3]
        result["by_commodity"][commodity] = {
            "max": top,
            "cells": [[*map(lambda v: round(v, 5), back(*c)), s] for c, s in cells],
            "targets": targets,
        }
    # Stable, readable target names across all minerals: GM-KAL-01, GM-KAL-02...
    code = _code(place)
    everything = sorted(
        (t for z in result["by_commodity"].values() for t in z["targets"]),
        key=lambda t: -t["score"],
    )
    for i, t in enumerate(everything, 1):
        t["id"] = f"GM-{code}-{i:02d}"
    return result
