import data from "./data/species.json";
import type { Habit, Mineral } from "./minerals";

// Every IMA mineral species known to Wikidata (CC0): name, formula, crystal system, Wikidata id.
export type Species = { name: string; formula: string; system: string; qid: string };
const rows = data as [string, string, string, string][];
export const SPECIES_COUNT = rows.length;
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
const index = rows.map((r) => fold(r[0]));
const toSpecies = (r: (typeof rows)[number]): Species => ({
  name: r[0],
  formula: r[1],
  system: r[2],
  qid: r[3],
});

export function searchSpecies(query: string, limit = 25, skip: Set<string> = new Set()) {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const starts: Species[] = [],
    contains: Species[] = [];
  for (let i = 0; i < rows.length && starts.length < limit; i++) {
    if (skip.has(index[i])) continue;
    if (index[i].startsWith(q)) starts.push(toSpecies(rows[i]));
    else if (contains.length < limit && index[i].includes(q)) contains.push(toSpecies(rows[i]));
  }
  return [...starts, ...contains].slice(0, limit);
}

export function findSpecies(name: string) {
  const i = index.indexOf(fold(name.trim()));
  return i < 0 ? undefined : toSpecies(rows[i]);
}

export const habitFor = (system: string): Habit =>
  ({
    Cubic: "cubic",
    Tetragonal: "prism",
    Hexagonal: "prism",
    Trigonal: "point",
    Orthorhombic: "tabular",
    Monoclinic: "tabular",
    Triclinic: "rhomb",
    Amorphous: "botryoidal",
  })[system] as Habit ?? "massive";

// A stable, muted colour per name so the cabinet does not look uniform.
export function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const s = 28,
    l = 52;
  const k = (n: number) => (n + h / 30) % 12;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => l / 100 - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
export const asMineral = (s: Species): Mineral => ({
  name: s.name,
  formula: s.formula || "—",
  group: s.system ? `${s.system} crystal system` : "Mineral species",
  hardness: "—",
  color: colorFor(s.name),
  habit: habitFor(s.system),
  luster: "—",
  streak: "—",
  traits: "",
  setting: "",
  commodity: "",
  species: { system: s.system, qid: s.qid },
});
export const mindatSearch = (name: string) =>
  `https://www.mindat.org/search.php?search=${encodeURIComponent(name)}`;
export const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;
