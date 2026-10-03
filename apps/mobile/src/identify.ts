import { minerals, type Mineral } from "./minerals";

// Field-test answers. Undefined means "not tested".
export type Answers = {
  shine?: "Metallic" | "Not metallic";
  scratch?: "Fingernail" | "Coin" | "Steel" | "Nothing";
  streak?: Streak;
  magnet?: "Pulls" | "No pull";
  uv?: "Glows" | "No glow";
};
export type Streak = "White" | "Black or grey" | "Red-brown" | "Yellow or brown" | "Green or blue" | "Metal colour";
export const STREAKS: [Streak, string][] = [
  ["White", "#F4F2EC"],
  ["Black or grey", "#3A3C3E"],
  ["Red-brown", "#8C3B2C"],
  ["Yellow or brown", "#B8892F"],
  ["Green or blue", "#4F9C8E"],
  ["Metal colour", "#C9A13E"],
];

// Mohs scratch bands: fingernail 2.5, copper coin 3.5, steel 5.5.
const BANDS = { Fingernail: [0, 2.5], Coin: [2.5, 3.5], Steel: [3.5, 5.5], Nothing: [5.5, 10] } as const;
const STRONG = new Set(["Magnetite"]);
const WEAK = new Set(["Pyrrhotite", "Ilmenite", "Chromite", "Hematite"]);
const GLOWS_OFTEN = new Set(["Fluorite", "Calcite", "Aragonite", "Diamond", "Corundum", "Zircon", "Opal"]);
const GLOWS_SOMETIMES = new Set(["Gypsum", "Halite", "Sphalerite", "Apatite", "Barite", "Smithsonite", "Dolomite", "Celestine"]);

export const hardnessRange = (x: Mineral): [number, number] | null => {
  const n = x.hardness.match(/[\d.]+/g)?.map(Number);
  return n?.length ? [n[0], n[n.length - 1]] : null;
};
/** "either" for minerals like hematite that can be metallic or earthy. */
export const shine = (x: Mineral) =>
  !/^(metallic|submetallic)/i.test(x.luster)
    ? "no"
    : /to (dull|earthy)/i.test(x.luster)
      ? "either"
      : "yes";
export const magnetism = (x: Mineral) =>
  STRONG.has(x.name) ? "Strong" : WEAK.has(x.name) ? "Weak" : "None";
export const fluorescence = (x: Mineral) =>
  GLOWS_OFTEN.has(x.name) ? "Often" : GLOWS_SOMETIMES.has(x.name) ? "Sometimes" : "Rarely";
export function streakGroup(x: Mineral): Streak {
  const s = x.streak.toLowerCase();
  if (/silver|copper-red|golden/.test(s)) return "Metal colour";
  if (/red|scarlet/.test(s)) return "Red-brown";
  if (/green|blue/.test(s) && !/black/.test(s)) return "Green or blue";
  if (/yellow|brown|bronze/.test(s)) return "Yellow or brown";
  if (/black|grey|gray/.test(s)) return "Black or grey";
  return "White";
}

export function matches(x: Mineral, a: Answers) {
  if (x.rock) return false;
  if (a.shine && shine(x) !== "either" && (a.shine === "Metallic") !== (shine(x) === "yes"))
    return false;
  if (a.scratch) {
    const r = hardnessRange(x);
    const [lo, hi] = BANDS[a.scratch];
    if (!r || r[1] < lo || r[0] > hi) return false;
  }
  if (a.streak && streakGroup(x) !== a.streak) return false;
  if (a.magnet && (a.magnet === "Pulls") !== (magnetism(x) !== "None")) return false;
  if (a.uv && a.uv === "Glows" && fluorescence(x) === "Rarely") return false;
  if (a.uv === "No glow" && fluorescence(x) === "Often") return false;
  return true;
}

/** Minerals consistent with every answered test; AI suggestions first. */
export function narrow(a: Answers, suggested: string[] = []) {
  const lower = suggested.map((s) => s.toLowerCase());
  return minerals
    .filter((x) => matches(x, a))
    .sort((p, q) => {
      const ip = lower.indexOf(p.name.toLowerCase()),
        iq = lower.indexOf(q.name.toLowerCase());
      return (ip < 0 ? 99 : ip) - (iq < 0 ? 99 : iq);
    });
}
