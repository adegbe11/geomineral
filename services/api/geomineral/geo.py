from pyproj import Geod
from shapely.geometry import Polygon

GEOD = Geod(ellps="WGS84")


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    return abs(GEOD.inv(a[0], a[1], b[0], b[1])[2])


def polygon_area_m2(points: list[list[float]]) -> float:
    if len(points) < 3 or any(
        len(p) != 2 or not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90) for p in points
    ):
        raise ValueError("Choose at least three valid vertices.")
    polygon = Polygon(points)
    if not polygon.is_valid or polygon.is_empty:
        raise ValueError("Project area must not cross itself.")
    area = abs(GEOD.geometry_area_perimeter(polygon)[0])
    if area <= 0 or area > 1e12:
        raise ValueError("Choose a non-zero project area smaller than 1 million square kilometres.")
    return area
