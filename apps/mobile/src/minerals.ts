export type Habit =
  | "cubic"
  | "prism"
  | "point"
  | "rhomb"
  | "botryoidal"
  | "massive"
  | "tabular"
  | "nugget"
  | "octahedral"
  | "fibrous"
  | "layered"
  | "granular"
  | "glassy"
  | "banded";
export type Mineral = {
  name: string;
  formula: string;
  group: string;
  hardness: string;
  color: string;
  habit: Habit;
  luster: string;
  streak: string;
  traits: string;
  setting: string;
  commodity: string;
  lookalikes?: string[];
  aliases?: string[];
  rock?: boolean;
  /** From the full species list: name, formula and crystal system only. */
  species?: { system: string; qid: string };
};

const m = (
  name: string,
  formula: string,
  group: string,
  hardness: string,
  color: string,
  habit: Habit,
  luster: string,
  streak: string,
  traits: string,
  setting: string,
  commodity: string,
  lookalikes: string[] = [],
  aliases: string[] = [],
): Mineral => ({
  name,
  formula,
  group,
  hardness,
  color,
  habit,
  luster,
  streak,
  traits,
  setting,
  commodity,
  lookalikes,
  aliases,
});
const r = (
  name: string,
  group: string,
  color: string,
  habit: Habit,
  traits: string,
  setting: string,
  commodity = "",
  lookalikes: string[] = [],
): Mineral => ({
  name,
  formula: "Rock",
  group,
  hardness: "Varies",
  color,
  habit,
  luster: "Varies",
  streak: "—",
  traits,
  setting,
  commodity,
  lookalikes,
  rock: true,
});

export const minerals: Mineral[] = [
  // Native elements
  m("Gold", "Au", "Native elements", "2.5-3", "#D4A52C", "nugget", "Metallic", "Golden yellow",
    "Rich yellow, soft and malleable; dents rather than shatters. Very heavy for its size and never tarnishes.",
    "Quartz veins in greenstone belts and placer gravels in rivers.", "gold", ["Pyrite", "Chalcopyrite"]),
  m("Silver", "Ag", "Native elements", "2.5-3", "#C9CCCE", "nugget", "Metallic", "Silver-white",
    "Bright white metal that tarnishes black. Soft, malleable and heavy; often wiry.",
    "Oxidised zones of silver, lead and zinc deposits.", "silver", ["Galena"]),
  m("Copper", "Cu", "Native elements", "2.5-3", "#B9693F", "nugget", "Metallic", "Copper-red",
    "Pinkish copper colour on fresh surfaces, tarnishing brown or green. Malleable.",
    "Basalt lava flows and oxidised copper deposits.", "copper", ["Bornite"]),
  m("Graphite", "C", "Native elements", "1-2", "#3C3F42", "layered", "Metallic to dull", "Black",
    "Very soft and greasy; marks paper and smears fingers black. Flaky sheets.",
    "Metamorphosed organic-rich rocks such as schist and marble.", "graphite", ["Molybdenite", "Hematite"]),
  m("Sulfur", "S", "Native elements", "1.5-2.5", "#E8CF3A", "point", "Resinous", "Pale yellow",
    "Bright lemon-yellow, brittle and light. Smells of sulfur when warm.",
    "Volcanic vents, hot springs and salt domes.", "sulfur", ["Orpiment"], ["Sulphur"]),
  m("Diamond", "C", "Native elements", "10", "#E6EEF0", "octahedral", "Adamantine", "None",
    "Hardest natural mineral with brilliant lustre; often octahedral crystals.",
    "Kimberlite and lamproite pipes and the gravels eroded from them.", "diamond", ["Quartz", "Zircon"]),

  // Sulfides
  m("Pyrite", "FeS2", "Sulfides", "6-6.5", "#B8A156", "cubic", "Metallic", "Greenish-black",
    "Brassy cubes, often striated. Brittle and harder than gold; the streak is dark, not gold.",
    "Almost every rock type and many hydrothermal ore deposits.", "pyrite", ["Gold", "Chalcopyrite", "Marcasite"], ["Fool's gold"]),
  m("Chalcopyrite", "CuFeS2", "Sulfides", "3.5-4", "#C2A23F", "massive", "Metallic", "Greenish-black",
    "Brassy yellow, often with an iridescent tarnish. Softer than pyrite.",
    "The main copper ore in porphyry and massive sulfide deposits.", "copper", ["Pyrite", "Gold"]),
  m("Bornite", "Cu5FeS4", "Sulfides", "3", "#7D5A8C", "massive", "Metallic", "Grey-black",
    "Bronze on fresh surfaces, tarnishing purple and blue ('peacock ore').",
    "Copper deposits with chalcopyrite.", "copper", ["Chalcopyrite"], ["Peacock ore"]),
  m("Galena", "PbS", "Sulfides", "2.5-2.75", "#8E959B", "cubic", "Metallic", "Lead-grey",
    "Bright silver-grey cubes, very heavy, with perfect cubic cleavage.",
    "Lead-zinc veins and carbonate-hosted deposits.", "lead", ["Silver"]),
  m("Sphalerite", "ZnS", "Sulfides", "3.5-4", "#7A5230", "massive", "Resinous to adamantine", "Pale yellow to brown",
    "Brown to black with a resinous lustre; streak much paler than the specimen.",
    "Lead-zinc deposits, often with galena.", "zinc", ["Galena", "Cassiterite"]),
  m("Cinnabar", "HgS", "Sulfides", "2-2.5", "#B3322D", "massive", "Adamantine", "Scarlet",
    "Bright red and very heavy. Contains mercury; do not grind or heat.",
    "Near hot springs and young volcanic areas.", "mercury", ["Hematite", "Realgar"]),
  m("Pentlandite", "(Fe,Ni)9S8", "Sulfides", "3.5-4", "#B49A5E", "massive", "Metallic", "Bronze-brown",
    "Bronze-yellow and non-magnetic, usually mixed with magnetic pyrrhotite.",
    "Nickel sulfide ores in mafic and ultramafic intrusions.", "nickel", ["Pyrrhotite", "Pyrite"]),
  m("Pyrrhotite", "Fe1-xS", "Sulfides", "3.5-4.5", "#9E8A5C", "massive", "Metallic", "Grey-black",
    "Bronze and weakly magnetic; tarnishes quickly.",
    "Mafic intrusions and nickel-copper ores.", "nickel", ["Pentlandite", "Pyrite"]),
  m("Molybdenite", "MoS2", "Sulfides", "1-1.5", "#8A9097", "layered", "Metallic", "Bluish-grey",
    "Soft bluish-grey flakes that feel greasy. Bluer than graphite.",
    "Porphyry deposits and granite veins.", "molybdenum", ["Graphite"]),
  m("Stibnite", "Sb2S3", "Sulfides", "2", "#7F868B", "prism", "Metallic", "Lead-grey",
    "Long, striated grey blades that can bend.",
    "Low-temperature hydrothermal veins.", "antimony"),
  m("Arsenopyrite", "FeAsS", "Sulfides", "5.5-6", "#B9BCBD", "prism", "Metallic", "Black",
    "Silver-white wedge-shaped crystals. Often associated with gold.",
    "Gold-bearing quartz veins.", "gold", ["Pyrite", "Marcasite"]),
  m("Marcasite", "FeS2", "Sulfides", "6-6.5", "#B5AE88", "tabular", "Metallic", "Greenish-black",
    "Paler than pyrite, with cockscomb crystals. Crumbles as it oxidises.",
    "Sedimentary rocks and low-temperature veins.", "pyrite", ["Pyrite"]),

  // Oxides
  m("Hematite", "Fe2O3", "Oxides", "5-6", "#8C4A3C", "botryoidal", "Metallic to earthy", "Red-brown",
    "Steel-grey to red. The reddish streak is the best clue.",
    "Banded iron formations and many weathered rocks.", "iron", ["Magnetite", "Goethite"]),
  m("Magnetite", "Fe3O4", "Oxides", "5.5-6.5", "#3D4245", "octahedral", "Metallic", "Black",
    "Black octahedra that are strongly magnetic.",
    "Igneous and metamorphic rocks, black beach sands and iron ores.", "iron", ["Hematite", "Chromite", "Ilmenite"]),
  m("Goethite", "FeO(OH)", "Oxides", "5-5.5", "#7A5531", "botryoidal", "Earthy to silky", "Yellow-brown",
    "Brown to black, often in rounded crusts. Yellow-brown streak.",
    "Weathered iron-bearing rocks and laterite.", "iron", ["Hematite", "Limonite"]),
  m("Limonite", "FeO(OH)·nH2O", "Oxides", "4-5.5", "#9C6A35", "massive", "Earthy", "Yellow-brown",
    "Rusty yellow-brown earthy masses. A field name for mixed iron hydroxides.",
    "Weathered iron deposits, bogs and gossans.", "iron", ["Goethite"]),
  m("Cassiterite", "SnO2", "Oxides", "6-7", "#4A372B", "prism", "Adamantine", "White to grey",
    "Heavy brown-black crystals with a bright lustre and pale streak.",
    "Granite-related veins, pegmatites and river placers.", "tin", ["Sphalerite", "Wolframite"]),
  m("Chromite", "FeCr2O4", "Oxides", "5.5", "#2E2D2C", "granular", "Submetallic", "Dark brown",
    "Black grains with a brown streak; weakly magnetic at most.",
    "Ultramafic rocks such as peridotite and serpentinite.", "chromium", ["Magnetite"]),
  m("Ilmenite", "FeTiO3", "Oxides", "5-6", "#38383A", "tabular", "Metallic", "Black",
    "Black and weakly magnetic. Common in heavy mineral sands.",
    "Gabbro, anorthosite and beach sands.", "titanium", ["Magnetite", "Hematite"]),
  m("Rutile", "TiO2", "Oxides", "6-6.5", "#8B3B22", "prism", "Adamantine", "Pale brown",
    "Red-brown needles or prisms, often as golden hairs inside quartz.",
    "Metamorphic rocks and heavy mineral sands.", "titanium"),
  m("Corundum", "Al2O3", "Oxides", "9", "#7D86A8", "prism", "Vitreous", "White",
    "Barrel-shaped hexagonal crystals; second only to diamond in hardness. Ruby and sapphire are varieties.",
    "Metamorphic rocks, some pegmatites and gem gravels.", "gemstones", ["Spinel"], ["Ruby", "Sapphire"]),
  m("Wolframite", "(Fe,Mn)WO4", "Oxides", "4-4.5", "#3A3430", "tabular", "Submetallic", "Brown-black",
    "Very heavy dark bladed crystals with one perfect cleavage.",
    "Quartz veins and greisens near granite.", "tungsten", ["Cassiterite"]),
  m("Pyrolusite", "MnO2", "Oxides", "6-6.5", "#2F2F33", "fibrous", "Metallic to dull", "Black",
    "Sooty black; often forms fern-like dendrites on rock surfaces.",
    "Manganese deposits and weathered rocks.", "manganese"),

  // Carbonates
  m("Calcite", "CaCO3", "Carbonates", "3", "#E3DCC9", "rhomb", "Vitreous", "White",
    "Breaks into rhombs; scratched by a knife. Clear crystals show double images.",
    "Limestone, marble, caves and mineral veins.", "limestone", ["Quartz", "Dolomite"]),
  m("Dolomite", "CaMg(CO3)2", "Carbonates", "3.5-4", "#E8D8C8", "rhomb", "Vitreous to pearly", "White",
    "Pinkish-white saddle-shaped rhombs.",
    "Dolostone, hydrothermal veins and marble.", "limestone", ["Calcite"], ["Dolostone"]),
  m("Aragonite", "CaCO3", "Carbonates", "3.5-4", "#E4D3B4", "prism", "Vitreous", "White",
    "Needle-like or six-sided columns; can look like coral.",
    "Caves, hot springs and shells.", "limestone", ["Calcite"]),
  m("Malachite", "Cu2CO3(OH)2", "Carbonates", "3.5-4", "#1F8A5B", "banded", "Silky to dull", "Light green",
    "Vivid green with light and dark bands.",
    "Oxidised zones above copper deposits.", "copper", ["Chrysocolla", "Azurite"]),
  m("Azurite", "Cu3(CO3)2(OH)2", "Carbonates", "3.5-4", "#2C4DA8", "point", "Vitreous", "Light blue",
    "Deep blue crystals or crusts, often with malachite.",
    "Oxidised zones above copper deposits.", "copper", ["Lapis lazuli"]),
  m("Rhodochrosite", "MnCO3", "Carbonates", "3.5-4", "#D06A7B", "banded", "Vitreous", "White",
    "Rose-pink, often banded.",
    "Hydrothermal silver and manganese veins.", "manganese", ["Rose quartz"]),
  m("Siderite", "FeCO3", "Carbonates", "3.5-4.5", "#8A6B45", "rhomb", "Vitreous to pearly", "White",
    "Tan to brown rhombs; heavier than calcite.",
    "Sedimentary ironstones and hydrothermal veins.", "iron"),
  m("Smithsonite", "ZnCO3", "Carbonates", "4-4.5", "#9CC8C2", "botryoidal", "Vitreous to pearly", "White",
    "Grape-like crusts in pastel blue-green, pink or yellow.",
    "Oxidised zinc deposits.", "zinc"),

  // Sulfates and halides
  m("Gypsum", "CaSO4·2H2O", "Sulfates", "2", "#E5E1D6", "tabular", "Vitreous to pearly", "White",
    "So soft a fingernail scratches it. Clear plates (selenite) or fibres (satin spar).",
    "Evaporite beds, clays and dry lake beds.", "gypsum", ["Calcite", "Halite"], ["Selenite", "Alabaster"]),
  m("Barite", "BaSO4", "Sulfates", "3-3.5", "#D8D0C4", "tabular", "Vitreous", "White",
    "Surprisingly heavy pale tabular crystals.",
    "Hydrothermal veins and sedimentary deposits.", "barite", ["Calcite", "Celestine"], ["Baryte"]),
  m("Celestine", "SrSO4", "Sulfates", "3-3.5", "#AFC7E3", "tabular", "Vitreous", "White",
    "Pale sky-blue tabular crystals, often in geodes.",
    "Limestones and evaporites.", "strontium", ["Barite"], ["Celestite"]),
  m("Halite", "NaCl", "Halides", "2.5", "#EDE8E1", "cubic", "Vitreous", "White",
    "Clear cubes with perfect cubic cleavage; dissolves in water.",
    "Evaporite beds and salt domes.", "salt", ["Calcite", "Fluorite"], ["Rock salt"]),
  m("Fluorite", "CaF2", "Halides", "4", "#7B5BA7", "cubic", "Vitreous", "White",
    "Glassy cubes in purple, green or yellow, often colour-banded.",
    "Hydrothermal veins and carbonate rocks.", "fluorite", ["Amethyst", "Calcite"], ["Fluorspar"]),

  // Phosphates
  m("Apatite", "Ca5(PO4)3(F,Cl,OH)", "Phosphates", "5", "#5E9E8F", "prism", "Vitreous", "White",
    "Six-sided prisms, often green or blue. Defines 5 on the Mohs scale.",
    "Igneous rocks, carbonatites and phosphorite.", "phosphate", ["Beryl", "Tourmaline"]),
  m("Turquoise", "CuAl6(PO4)4(OH)8·4H2O", "Phosphates", "5-6", "#40B5AD", "massive", "Waxy", "White to greenish",
    "Opaque sky-blue to green, often with dark veining.",
    "Dry regions in altered copper-bearing rocks.", "gemstones", ["Chrysocolla"]),
  m("Vanadinite", "Pb5(VO4)3Cl", "Phosphates", "3-4", "#C2421F", "prism", "Adamantine", "Pale yellow",
    "Bright red-orange hexagonal crystals; heavy.",
    "Oxidised lead deposits.", "vanadium"),

  // Silicates
  m("Quartz", "SiO2", "Silicates", "7", "#C7D1CE", "point", "Vitreous", "White",
    "Glassy six-sided crystals; scratches glass and has no cleavage. Quartz alone is not evidence of gold.",
    "Almost every rock type, and veins.", "silica", ["Calcite", "Feldspar"], ["Rock crystal"]),
  m("Amethyst", "SiO2", "Silicates", "7", "#8A5BA8", "point", "Vitreous", "White",
    "Purple quartz, often in geodes.",
    "Cavities in volcanic rocks and veins.", "gemstones", ["Fluorite"]),
  m("Rose quartz", "SiO2", "Silicates", "7", "#E3AEB4", "massive", "Vitreous", "White",
    "Pale pink and usually massive, not crystalline.",
    "Granite pegmatites.", "silica", ["Rhodochrosite"]),
  m("Smoky quartz", "SiO2", "Silicates", "7", "#6A584B", "point", "Vitreous", "White",
    "Brown to nearly black quartz crystals.",
    "Granites and pegmatites.", "silica"),
  m("Citrine", "SiO2", "Silicates", "7", "#E3A83A", "point", "Vitreous", "White",
    "Yellow to orange quartz.",
    "Pegmatites and veins.", "gemstones", ["Topaz"]),
  m("Agate", "SiO2", "Silicates", "6.5-7", "#B57B58", "banded", "Waxy", "White",
    "Banded chalcedony, often in rounded nodules.",
    "Cavities in volcanic rocks.", "gemstones", ["Jasper"]),
  m("Jasper", "SiO2", "Silicates", "6.5-7", "#9D3D2E", "massive", "Dull to waxy", "White",
    "Opaque red, brown or yellow chalcedony.",
    "Sedimentary and volcanic rocks.", "gemstones", ["Agate", "Chert"]),
  m("Opal", "SiO2·nH2O", "Silicates", "5.5-6.5", "#D8E6EB", "massive", "Vitreous to waxy", "White",
    "May show flashes of colour; softer than quartz.",
    "Sandstone and volcanic rock cavities.", "gemstones"),
  m("Orthoclase", "KAlSi3O8", "Silicates", "6", "#E1B79A", "prism", "Vitreous", "White",
    "Pink to cream blocky crystals with two cleavages at right angles.",
    "Granite and pegmatite.", "feldspar", ["Quartz"], ["Feldspar", "K-feldspar"]),
  m("Plagioclase", "(Na,Ca)AlSi3O8", "Silicates", "6-6.5", "#D8D9D2", "tabular", "Vitreous", "White",
    "White to grey feldspar; fine parallel striations on cleavage faces.",
    "Basalt, gabbro, diorite and many other rocks.", "feldspar", ["Orthoclase"], ["Feldspar"]),
  m("Labradorite", "(Ca,Na)AlSi3O8", "Silicates", "6-6.5", "#4D5D6E", "tabular", "Vitreous", "White",
    "Dark grey feldspar with a blue-green flash when turned.",
    "Gabbro and anorthosite.", "gemstones"),
  m("Muscovite", "KAl2(AlSi3O10)(OH)2", "Silicates", "2-2.5", "#D8CFB4", "layered", "Pearly", "White",
    "Clear to silvery mica; peels into thin flexible sheets.",
    "Granite, pegmatite and schist.", "mica", ["Biotite"], ["Mica"]),
  m("Biotite", "K(Mg,Fe)3AlSi3O10(OH)2", "Silicates", "2.5-3", "#2F2A24", "layered", "Pearly", "White to grey",
    "Black mica; peels into thin sheets.",
    "Granite, schist and gneiss.", "mica", ["Muscovite"], ["Mica"]),
  m("Olivine", "(Mg,Fe)2SiO4", "Silicates", "6.5-7", "#7E9A3C", "granular", "Vitreous", "White",
    "Olive-green glassy grains. Gem variety is peridot.",
    "Basalt and peridotite.", "gemstones", ["Epidote"], ["Peridot"]),
  m("Garnet", "X3Y2(SiO4)3", "Silicates", "6.5-7.5", "#7E2630", "octahedral", "Vitreous", "White",
    "Round 12- or 24-sided crystals, usually deep red.",
    "Schist, gneiss and some igneous rocks.", "gemstones", ["Ruby"]),
  m("Tourmaline", "Complex borosilicate", "Silicates", "7-7.5", "#2C2C2C", "prism", "Vitreous", "White",
    "Long striated prisms with a rounded triangular cross-section; black is common.",
    "Granite pegmatites.", "gemstones", ["Hornblende"], ["Schorl"]),
  m("Beryl", "Be3Al2Si6O18", "Silicates", "7.5-8", "#86B9A8", "prism", "Vitreous", "White",
    "Hexagonal prisms. Emerald is green, aquamarine blue.",
    "Granite pegmatites.", "beryllium", ["Apatite"], ["Emerald", "Aquamarine"]),
  m("Topaz", "Al2SiO4(F,OH)2", "Silicates", "8", "#E2C08A", "prism", "Vitreous", "White",
    "Hard prismatic crystals with one perfect cleavage.",
    "Pegmatites and rhyolite cavities.", "gemstones", ["Citrine", "Quartz"]),
  m("Zircon", "ZrSiO4", "Silicates", "7.5", "#9B5D3A", "prism", "Adamantine", "White",
    "Small, hard, bright crystals; used to date rocks.",
    "Granites and heavy mineral sands.", "zirconium", ["Diamond"]),
  m("Spodumene", "LiAlSi2O6", "Silicates", "6.5-7", "#C8C2A8", "prism", "Vitreous", "White",
    "Pale flattened prisms with a fibrous look. A photo cannot show lithium content.",
    "Lithium-rich granite pegmatites.", "lithium", ["Feldspar"]),
  m("Lepidolite", "K(Li,Al)3(Si,Al)4O10(F,OH)2", "Silicates", "2.5-3", "#B48FB8", "layered", "Pearly", "White",
    "Lilac to pink mica that peels into flakes.",
    "Lithium-rich pegmatites.", "lithium", ["Muscovite"]),
  m("Hornblende", "Ca2(Mg,Fe)4Al(Si7Al)O22(OH)2", "Silicates", "5-6", "#2E3A2E", "prism", "Vitreous", "Grey-green",
    "Dark green to black elongated crystals; cleavages at 124°.",
    "Diorite, andesite and amphibolite.", "", ["Tourmaline", "Augite"], ["Amphibole"]),
  m("Augite", "(Ca,Na)(Mg,Fe,Al)(Si,Al)2O6", "Silicates", "5.5-6", "#2D2E26", "prism", "Vitreous", "Grey-green",
    "Stubby dark crystals; cleavages near 90°.",
    "Basalt and gabbro.", "", ["Hornblende"], ["Pyroxene"]),
  m("Epidote", "Ca2(Al,Fe)3(SiO4)3(OH)", "Silicates", "6-7", "#6C7A2E", "prism", "Vitreous", "White",
    "Pistachio-green, often in veins.",
    "Altered volcanic rocks and metamorphic rocks.", "", ["Olivine"]),
  m("Kyanite", "Al2SiO5", "Silicates", "4.5-7", "#5B7FB8", "prism", "Vitreous", "White",
    "Blue blades; harder across the blade than along it.",
    "Schist and gneiss.", "", ["Sodalite"]),
  m("Talc", "Mg3Si4O10(OH)2", "Silicates", "1", "#D8DDD2", "layered", "Pearly to greasy", "White",
    "Softest mineral; feels soapy.",
    "Altered ultramafic rocks and marble.", "talc", ["Gypsum"], ["Soapstone"]),
  m("Serpentine", "(Mg,Fe)3Si2O5(OH)4", "Silicates", "2.5-4", "#5E7F4C", "fibrous", "Waxy to silky", "White",
    "Mottled green, waxy and smooth. Some fibrous forms are asbestos; do not break or grind.",
    "Altered ultramafic rocks.", "", ["Jade"]),
  m("Chrysocolla", "Cu2H2Si2O5(OH)4", "Silicates", "2-4", "#3AA3A8", "botryoidal", "Vitreous to earthy", "Light blue",
    "Blue-green crusts; softer than turquoise.",
    "Oxidised copper deposits.", "copper", ["Turquoise", "Malachite"]),
  m("Kaolinite", "Al2Si2O5(OH)4", "Silicates", "2-2.5", "#ECE6DA", "massive", "Earthy", "White",
    "White clay that is chalky and soft; smells earthy when damp.",
    "Weathered granite and feldspar-rich rocks.", "kaolin", ["Gypsum"], ["Kaolin", "China clay"]),
  m("Jade", "NaAlSi2O6 / Ca2(Mg,Fe)5Si8O22(OH)2", "Silicates", "6-7", "#4F8B5E", "massive", "Waxy to vitreous", "White",
    "Very tough green stone, smooth and dense. Jadeite and nephrite are both called jade.",
    "High-pressure metamorphic rocks and serpentinite.", "gemstones", ["Serpentine"], ["Jadeite", "Nephrite"]),
  m("Lapis lazuli", "Lazurite with calcite and pyrite", "Silicates", "5-5.5", "#26408F", "massive", "Dull to vitreous", "Light blue",
    "Deep blue with gold pyrite flecks and white calcite.",
    "Metamorphosed limestone (marble).", "gemstones", ["Azurite", "Sodalite"]),
  m("Sodalite", "Na8(Al6Si6O24)Cl2", "Silicates", "5.5-6", "#2F4F9A", "massive", "Vitreous", "White",
    "Royal blue with white veins; no pyrite flecks.",
    "Silica-poor igneous rocks.", "", ["Lapis lazuli"]),
  m("Bauxite", "Al hydroxides", "Oxides", "1-3", "#B66A3E", "granular", "Earthy", "Reddish",
    "Reddish-brown clay-like rock, often with small round pisoliths.",
    "Deep tropical weathering of aluminium-rich rocks.", "aluminium", ["Laterite"]),

  // Rocks
  r("Granite", "Igneous rocks", "#C9B6A6", "granular",
    "Coarse interlocking crystals of pink or white feldspar, grey quartz and black mica.",
    "Cooled slowly deep underground; forms large bodies and mountain cores.", "", ["Diorite", "Gneiss"]),
  r("Basalt", "Igneous rocks", "#3D3F3F", "massive",
    "Dark and fine-grained, often with gas bubble holes.",
    "Lava flows, ocean floor and volcanic islands.", "copper", ["Andesite", "Gabbro"]),
  r("Andesite", "Igneous rocks", "#6E6E6A", "massive",
    "Grey, fine-grained, often with scattered visible crystals.",
    "Volcanoes above subduction zones.", "copper", ["Basalt"]),
  r("Rhyolite", "Igneous rocks", "#C7A9A0", "massive",
    "Pale pink or grey, fine-grained, sometimes flow-banded.",
    "Explosive volcanoes rich in silica.", "", ["Andesite"]),
  r("Diorite", "Igneous rocks", "#8E8E86", "granular",
    "Salt-and-pepper mix of white feldspar and black hornblende; little quartz.",
    "Intrusions below volcanic arcs.", "copper", ["Granite", "Gabbro"]),
  r("Gabbro", "Igneous rocks", "#3F433D", "granular",
    "Dark and coarse-grained; the slow-cooled form of basalt.",
    "Deep oceanic crust and layered intrusions.", "nickel", ["Basalt", "Diorite"]),
  r("Peridotite", "Igneous rocks", "#5F7340", "granular",
    "Dense green rock made mostly of olivine.",
    "The upper mantle; exposed in ophiolites.", "nickel", ["Serpentinite"]),
  r("Pegmatite", "Igneous rocks", "#D9C3AE", "granular",
    "Very coarse crystals, some larger than a hand.",
    "Late-stage veins around granite; source of lithium, tin and gems.", "lithium", ["Granite"]),
  r("Obsidian", "Igneous rocks", "#141414", "glassy",
    "Black volcanic glass with sharp, curved fractures.",
    "Rapidly cooled silica-rich lava.", "", ["Basalt"]),
  r("Pumice", "Igneous rocks", "#D9D5C8", "massive",
    "Light, frothy volcanic rock that can float.",
    "Explosive eruptions.", ""),
  r("Kimberlite", "Igneous rocks", "#4B5A4A", "massive",
    "Blue-green to grey rock with rounded fragments.",
    "Deep volcanic pipes; the main source of diamonds.", "diamond", ["Peridotite"]),
  r("Sandstone", "Sedimentary rocks", "#C9A671", "granular",
    "Sand-sized grains you can see and feel.",
    "Rivers, beaches and deserts.", "silica", ["Quartzite"]),
  r("Limestone", "Sedimentary rocks", "#D3CBB5", "layered",
    "Grey to cream, often with fossils.",
    "Shallow warm seas and reefs.", "limestone", ["Marble", "Dolostone"]),
  r("Shale", "Sedimentary rocks", "#5E5A54", "layered",
    "Fine-grained and splits into thin layers.",
    "Mud in lakes, deltas and deep seas.", "clay", ["Slate"]),
  r("Mudstone", "Sedimentary rocks", "#7B7267", "massive",
    "Very fine-grained, blocky rather than layered.",
    "Calm water where mud settles.", "clay", ["Shale"]),
  r("Conglomerate", "Sedimentary rocks", "#A6927A", "granular",
    "Rounded pebbles held together in finer cement.",
    "Fast rivers and beaches; some hold gold.", "gold", ["Breccia"]),
  r("Breccia", "Sedimentary rocks", "#8E7A68", "granular",
    "Angular broken fragments cemented together.",
    "Fault zones, landslides and volcanic vents.", "", ["Conglomerate"]),
  r("Chert", "Sedimentary rocks", "#857A6E", "massive",
    "Hard and smooth; breaks with sharp curved edges.",
    "Deep-sea sediments and limestone nodules.", "silica", ["Jasper"]),
  r("Coal", "Sedimentary rocks", "#1D1C1A", "layered",
    "Black, light and combustible; may be banded shiny and dull.",
    "Ancient swamps and peat.", "coal", ["Obsidian"]),
  r("Ironstone", "Sedimentary rocks", "#8B4F33", "banded",
    "Heavy rusty rock, sometimes with red and grey bands.",
    "Banded iron formations and iron-rich sediments.", "iron", ["Jasper"]),
  r("Laterite", "Sedimentary rocks", "#A3532F", "granular",
    "Red, iron-rich crust with nodules; hardens in air.",
    "Deep weathering in hot, wet climates.", "aluminium", ["Bauxite"]),
  r("Marble", "Metamorphic rocks", "#E7E3DC", "granular",
    "Sugary interlocking calcite crystals.",
    "Heated and squeezed limestone.", "marble", ["Quartzite"]),
  r("Quartzite", "Metamorphic rocks", "#DCD0C2", "granular",
    "Very hard; breaks through grains rather than around them.",
    "Heated and squeezed sandstone.", "silica", ["Marble", "Sandstone"]),
  r("Slate", "Metamorphic rocks", "#4A4E52", "layered",
    "Splits into flat sheets; dull, fine-grained.",
    "Low-grade metamorphism of shale.", "", ["Shale"]),
  r("Schist", "Metamorphic rocks", "#7C7A70", "layered",
    "Glittering mica flakes aligned in wavy layers.",
    "Mountain belts; hosts garnet and some gold.", "gold", ["Gneiss"]),
  r("Gneiss", "Metamorphic rocks", "#8F857A", "banded",
    "Light and dark minerals in bands.",
    "High-grade metamorphism deep in mountain roots.", "", ["Granite", "Schist"]),
  r("Serpentinite", "Metamorphic rocks", "#4E6E48", "massive",
    "Green, slippery-looking and often streaked.",
    "Altered mantle rocks; hosts nickel, chromium and talc.", "nickel", ["Jade"]),
  r("Greenstone", "Metamorphic rocks", "#4F6650", "massive",
    "Dull green altered volcanic rock.",
    "Ancient greenstone belts; major hosts of gold.", "gold", ["Serpentinite"]),
];

const SUB = "₀₁₂₃₄₅₆₇₈₉";
/** Chemical formula with subscript counts: FeS2 -> FeS₂, CaSO4·2H2O -> CaSO₄·2H₂O. */
export const pretty = (formula: string) =>
  formula.replace(/(?<=[A-Za-z)\]])\d+/g, (d) => [...d].map((x) => SUB[+x]).join(""));
export const isRock = (x: Mineral) => !!x.rock;
export const mineralSource = (x: Mineral) =>
  x.rock
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(x.name.replace(/ /g, "_"))}`
    : `https://www.mindat.org/search.php?search=${encodeURIComponent(x.name)}`;
export const sourceName = (x: Mineral) => (x.rock ? "Wikipedia" : "Mindat");
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[₂₃₄₅₆₇₈₉]/g, (c) => String("₂₃₄₅₆₇₈₉".indexOf(c) + 2))
    .replace(/\s/g, "");
export const findMineral = (name: string) => {
  const q = normalize(name);
  return minerals.find(
    (x) =>
      normalize(x.name) === q ||
      (x.aliases ?? []).some((a) => normalize(a) === q),
  );
};
export function searchMinerals(query: string, group = "All") {
  const q = normalize(query);
  return minerals.filter(
    (x) =>
      (group === "All" ||
        (group === "Rocks" ? x.rock : !x.rock && x.group === group)) &&
      normalize(
        [x.name, x.formula, x.group, x.commodity, ...(x.aliases ?? [])].join(" "),
      ).includes(q),
  );
}
export const GROUPS = [
  "All",
  ...new Set(minerals.filter((x) => !x.rock).map((x) => x.group)),
  "Rocks",
];
