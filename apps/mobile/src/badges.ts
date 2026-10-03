import { shine } from "./identify";
import { findMineral, type Mineral } from "./minerals";

export type Record = { rock_type?: string; project_id: string };
export type Badge = { id: string; name: string; detail: string; color: string; earned: boolean };

const RARE = new Set([
  "Diamond", "Corundum", "Beryl", "Topaz", "Vanadinite", "Cinnabar", "Gold", "Silver",
  "Lapis lazuli", "Kimberlite", "Wolframite", "Spodumene",
]);

/** Distinct Guide entries found in the user's samples. */
export function found(records: Record[]) {
  const map = new Map<string, Mineral>();
  for (const r of records) {
    const m = r.rock_type ? findMineral(r.rock_type) : undefined;
    if (m) map.set(m.name, m);
  }
  return map;
}

export function badges(records: Record[]): Badge[] {
  const f = [...found(records).values()];
  const minerals = f.filter((m) => !m.rock);
  const has = (test: (m: Mineral) => boolean, n = 1) => f.filter(test).length >= n;
  const projects = new Set(records.filter((r) => r.rock_type && r.rock_type !== "Unidentified").map((r) => r.project_id));
  return [
    { id: "first", name: "First Find", detail: "Log your first identified sample", color: "#4CC38A", earned: f.length >= 1 },
    { id: "ten", name: "Collector", detail: "10 different minerals or rocks", color: "#3D86C6", earned: f.length >= 10 },
    { id: "curator", name: "Curator", detail: "25 different minerals or rocks", color: "#8A5BA8", earned: f.length >= 25 },
    { id: "metal", name: "Metal Hunter", detail: "3 metallic minerals", color: "#C9A13E", earned: minerals.filter((m) => shine(m) !== "no").length >= 3 },
    { id: "crystal", name: "Crystal Seeker", detail: "3 silicate minerals", color: "#5FB0C8", earned: has((m) => m.group === "Silicates", 3) },
    {
      id: "rocks",
      name: "Rock Reader",
      detail: "An igneous, a sedimentary and a metamorphic rock",
      color: "#9D7A5B",
      earned: ["Igneous rocks", "Sedimentary rocks", "Metamorphic rocks"].every((g) => has((m) => m.group === g)),
    },
    { id: "gem", name: "Gem Finder", detail: "Any gemstone", color: "#D0587A", earned: has((m) => m.commodity === "gemstones") },
    { id: "rare", name: "Rare Find", detail: "Gold, diamond, beryl, topaz or another rare find", color: "#E0A526", earned: has((m) => RARE.has(m.name)) },
    { id: "magnet", name: "Lodestone", detail: "Find magnetite", color: "#56606A", earned: has((m) => m.name === "Magnetite") },
    { id: "field", name: "Field Regular", detail: "Identified samples in 3 projects", color: "#1F7A47", earned: projects.size >= 3 },
  ];
}
