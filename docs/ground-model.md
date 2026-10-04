# Ground model

GeoMineral's learned prospectivity: how much the ground around a pin resembles ground around real deposits.

- **Inputs (the ground only):** rock type and age (Macrostrat), magnetic anomaly (NOAA EMAG2v3, bundled at 4 arc-minutes so training and live read identical values), free-air gravity (computed from EIGEN-6C4 to degree 1080, ~9 km), mapped faults (Macrostrat, zoom 7) and terrain (Terrarium). Known mines are never inputs.
- **Answers:** USGS MRDS deposits worldwide (up to 600 per mineral (1,000–1,500 for gold, copper, silver, lead, zinc, iron, uranium), outside-US first, one per ~10 km), against 6,000 random land points and other minerals' deposits at least 10 km away.
- **Test:** 5-fold cross-validation on 2° blocks (~200 km), so every score comes from regions the model never saw. A mineral ships only with AUC ≥ 0.75 overall and ≥ 0.70 outside the USA.
- **In the app:** a pin's score becomes "top x% of land" against held-out ordinary ground; top 2% adds two points, top 10% one.
- **Blind test (the same 45 named mines + 45 random land spots, mine records hidden):** right mineral 9/45 with rules only, 20/45 with the ground model. On 2,500 held-out land points, the "top 10%" line flags 8–11% of land.

Rebuild: `PYTHONPATH=services/api python scripts/train_prospectivity.py points|features|train` (needs `mrds.csv` and `emag2_upcont.tif` in `services/api/.data/training`).

| Mineral | AUC | AUC outside USA | Shipped |
|---|---|---|---|
| Diamond | 0.879 | 0.89 | Yes |
| Rare earth elements | 0.87 | 0.78 | Yes |
| Uranium | 0.866 | 0.68 | No |
| Niobium | 0.859 | 0.785 | Yes |
| Gypsum | 0.855 | 0.798 | Yes |
| Silver | 0.852 | 0.851 | Yes |
| Clay | 0.837 | 0.711 | Yes |
| Chromium | 0.819 | 0.786 | Yes |
| Lead | 0.819 | 0.817 | Yes |
| Nickel | 0.818 | 0.819 | Yes |
| Tantalum | 0.818 | 0.748 | Yes |
| Copper | 0.812 | 0.808 | Yes |
| Fluorite | 0.812 | 0.817 | Yes |
| Titanium | 0.812 | 0.827 | Yes |
| Antimony | 0.811 | 0.801 | Yes |
| Tungsten | 0.801 | 0.794 | Yes |
| Zinc | 0.8 | 0.79 | Yes |
| Platinum | 0.795 | 0.79 | Yes |
| Tin | 0.785 | 0.784 | Yes |
| Gold | 0.775 | 0.762 | Yes |
| Limestone | 0.772 | 0.772 | Yes |
| Graphite | 0.766 | 0.724 | Yes |
| Aluminium | 0.757 | 0.749 | Yes |
| Kaolin | 0.748 | 0.677 | No |
| Phosphate | 0.729 | 0.717 | No |
| Barite | 0.723 | 0.719 | No |
| Molybdenum | 0.717 | 0.711 | No |
| Cobalt | 0.709 | 0.705 | No |
| Lithium | 0.701 | 0.68 | No |
| Manganese | 0.689 | 0.664 | No |
| Iron | 0.677 | 0.672 | No |
