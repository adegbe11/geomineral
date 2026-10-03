// Radar-style ramp for zone scores.
export const heatColor = (s: number) =>
  s >= 0.85 ? "#B5122E" : s >= 0.65 ? "#E2552F" : s >= 0.45 ? "#F2A33A" : "#F7E27A";
export const cellRing = (lng: number, lat: number, km: number) => {
  const dy = km / 2 / 110.57,
    dx = km / 2 / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [
    [lng - dx, lat - dy],
    [lng + dx, lat - dy],
    [lng + dx, lat + dy],
    [lng - dx, lat + dy],
    [lng - dx, lat - dy],
  ];
};
