export type Mineral = {
  name: string;
  formula: string;
  group: string;
  hardness: string;
  color: string;
  traits: string;
  setting: string;
  commodity: string;
};
export const minerals: Mineral[] = [
  {
    name: "Gold",
    formula: "Au",
    group: "Native elements",
    hardness: "2.5-3",
    color: "#C99D32",
    traits:
      "Yellow metallic appearance; malleable rather than brittle. Pyrite can look similar.",
    setting:
      "Hydrothermal veins and placer sediments are among its geological settings.",
    commodity: "gold",
  },
  {
    name: "Copper",
    formula: "Cu",
    group: "Native elements",
    hardness: "2.5-3",
    color: "#B97046",
    traits:
      "Fresh surfaces are pinkish; tarnishing changes the surface colour. Native copper is malleable.",
    setting: "Occurs in some volcanic rocks and in altered copper deposits.",
    commodity: "copper",
  },
  {
    name: "Quartz",
    formula: "SiO2",
    group: "Silicates",
    hardness: "7",
    color: "#AABBB8",
    traits:
      "Glassy appearance, variable colour and curved fracture surfaces. Quartz alone is not evidence of gold.",
    setting:
      "Widespread in igneous, metamorphic and sedimentary rocks, including veins.",
    commodity: "quartz",
  },
  {
    name: "Calcite",
    formula: "CaCO3",
    group: "Carbonates",
    hardness: "3",
    color: "#DAD4C4",
    traits:
      "Often pale or transparent, with rhombohedral cleavage. Colour alone cannot distinguish it from quartz.",
    setting: "Common in limestone, marble and mineral veins.",
    commodity: "limestone",
  },
  {
    name: "Pyrite",
    formula: "FeS2",
    group: "Sulfides",
    hardness: "6-6.5",
    color: "#AD9B59",
    traits:
      "Brass-coloured metallic mineral; brittle, sometimes with cubic crystals. Often confused with gold.",
    setting: "Found in many rock types and hydrothermal mineral deposits.",
    commodity: "pyrite",
  },
  {
    name: "Magnetite",
    formula: "Fe3O4",
    group: "Oxides",
    hardness: "5.5-6.5",
    color: "#555F60",
    traits:
      "Typically black and strongly magnetic. Magnetic response is a clue, not a complete identification.",
    setting:
      "Occurs in igneous and metamorphic rocks and some sedimentary iron deposits.",
    commodity: "iron",
  },
  {
    name: "Hematite",
    formula: "Fe2O3",
    group: "Oxides",
    hardness: "5-6",
    color: "#906A62",
    traits:
      "Appearance ranges from earthy red to metallic grey; a reddish streak is characteristic.",
    setting:
      "Occurs in iron formations, altered rocks and many other geological settings.",
    commodity: "iron",
  },
  {
    name: "Gypsum",
    formula: "CaSO4·2H2O",
    group: "Sulfates",
    hardness: "2",
    color: "#DDDCD4",
    traits:
      "A soft mineral, commonly clear, white or pale. Fibrous and massive forms also occur.",
    setting:
      "Common in evaporite deposits; also forms through alteration processes.",
    commodity: "gypsum",
  },
  {
    name: "Spodumene",
    formula: "LiAlSi2O6",
    group: "Silicates",
    hardness: "6.5-7",
    color: "#B4B09D",
    traits:
      "A lithium-bearing pyroxene with variable colour. A photograph cannot establish lithium content.",
    setting: "Associated with lithium-rich granitic pegmatites.",
    commodity: "lithium",
  },
];
export const mineralSource = (m: Mineral) =>
  `https://handbookofmineralogy.org/pdfs/${m.name.toLowerCase()}.pdf`;
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[₂₃₄₅₆₇₈₉]/g, (c) => String("₂₃₄₅₆₇₈₉".indexOf(c) + 2))
    .replace(/\s/g, "");
export function searchMinerals(query: string, group = "All") {
  const q = normalize(query);
  return minerals.filter(
    (m) =>
      (group === "All" || m.group === group) &&
      normalize([m.name, m.formula, m.group, m.commodity].join(" ")).includes(
        q,
      ),
  );
}
