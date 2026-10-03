"""US land manager lookup (USGS PAD-US) with general collecting guidance.

Guidance is a starting point, never permission: rules, closures and mining claims vary locally.
"""

import httpx

from .config import USER_AGENT

PADUS = "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Manager_Name/FeatureServer/0/query"
SOURCE = "USGS PAD-US 2.1"
CHECK = "Check local rules, closures and mining claims before collecting."
MANAGERS = {
    "BLM": "Bureau of Land Management",
    "USFS": "U.S. Forest Service",
    "NPS": "National Park Service",
    "FWS": "U.S. Fish and Wildlife Service",
    "DOD": "Department of Defense",
    "BOR": "Bureau of Reclamation",
    "TRIB": "Tribal land",
    "STAT": "State",
    "SDNR": "State natural resources",
    "SPR": "State parks",
    "SFW": "State fish and wildlife",
    "SLB": "State land board",
    "CITY": "City",
    "CNTY": "County",
    "NGO": "Conservation organisation",
    "PVT": "Private",
}


def _rule(attrs: dict) -> tuple[int, str, str]:
    """(restrictiveness, status, guidance) for one PAD-US feature."""
    manager, kind, gap = attrs.get("Mang_Name"), attrs.get("Des_Tp"), str(attrs.get("GAP_Sts"))
    if manager == "DOD":
        return (
            6,
            "Restricted",
            "Military land. Public entry and collecting are not allowed without authorization.",
        )
    if manager == "NPS":
        return (
            5,
            "No collecting",
            "Collecting rocks and minerals is prohibited in National Park Service areas.",
        )
    if kind in ("WA", "WSA") or gap == "1":
        return 5, "Protected", "Strictly protected area. Collecting is usually prohibited."
    if manager == "FWS":
        return 5, "No collecting", "Collecting is generally prohibited on wildlife refuges."
    if manager == "TRIB":
        return 4, "Permission needed", "Tribal land. Collecting needs permission from the tribe."
    if manager in ("STAT", "SDNR", "SPR", "SFW", "SLB", "CITY", "CNTY", "NGO"):
        return 3, "Check local rules", "Rules vary; many state and local parks prohibit collecting."
    if manager == "USFS":
        return (
            2,
            "Limited collecting",
            "Small amounts for personal use are generally allowed in National Forests.",
        )
    if manager == "BLM":
        return (
            1,
            "Limited collecting",
            "Casual collecting of small amounts for personal use is generally allowed on BLM land, except where posted.",
        )
    if manager == "PVT":
        return 4, "Private", "Private land. Collecting needs the owner's permission."
    return 3, "Check local rules", "Land rules are unclear here."


def in_us(lat: float, lng: float) -> bool:
    return 17.5 <= lat <= 72 and -180 <= lng <= -64


async def lookup(lat: float, lng: float) -> dict:
    if not in_us(lat, lng):
        return {
            "covered": False,
            "status": "Not covered",
            "guidance": "Land status is available for the United States only. Ask the local land office.",
            "source": SOURCE,
        }
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        r = await client.get(
            PADUS,
            params={
                "f": "json",
                "geometry": f"{lng},{lat}",
                "geometryType": "esriGeometryPoint",
                "inSR": 4326,
                "spatialRel": "esriSpatialRelIntersects",
                "outFields": "Mang_Name,Mang_Type,Des_Tp,Unit_Nm,Pub_Access,GAP_Sts,FeatClass",
                "returnGeometry": "false",
            },
        )
        r.raise_for_status()
        payload = r.json()
    if "error" in payload:
        raise ValueError("Land service rejected the query")
    features = [f["attributes"] for f in payload.get("features", [])]
    if not features:
        return {
            "covered": True,
            "status": "No public land record",
            "guidance": "Not in the public lands database. It may be private: get the owner's permission. "
            + CHECK,
            "source": SOURCE,
        }
    rank, status, guidance = max(_rule(a) for a in features)
    main = max(features, key=lambda a: (_rule(a)[0], a.get("FeatClass") == "Fee"))
    return {
        "covered": True,
        "status": status,
        "guidance": f"{guidance} {CHECK}",
        "manager": MANAGERS.get(main.get("Mang_Name"), main.get("Mang_Name") or "Unknown"),
        "unit": main.get("Unit_Nm") or "",
        "units": sorted({a.get("Unit_Nm") for a in features if a.get("Unit_Nm")}),
        "source": SOURCE,
    }
