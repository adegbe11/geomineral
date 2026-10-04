# Ground model

GeoMineral's learned prospectivity: how much the ground around a pin resembles ground around real deposits.

- **Inputs (the ground only):** rock type and age (Macrostrat), magnetic anomaly (NOAA EMAG2v3), terrain (Terrarium). Known mines are never inputs.
- **Answers:** USGS MRDS deposits worldwide (up to 600 per mineral, outside-US first, one per ~10 km), against 6,000 random land points and other minerals' deposits at least 10 km away.
- **Test:** 5-fold cross-validation on 2° blocks (~200 km), so every score comes from regions the model never saw. A mineral ships only with AUC ≥ 0.75 overall and ≥ 0.70 outside the USA.
- **In the app:** a pin's score becomes "top x% of land" against held-out ordinary ground; top 2% adds two points, top 10% one.
- **Blind test (45 named mines + 45 random spots, mine records hidden):** right mineral named 9/45 before, 19/45 after; random spots given any mineral 41/45 before, 31/45 after.

Rebuild: `PYTHONPATH=services/api python scripts/train_prospectivity.py points|features|train` (needs `mrds.csv` and `emag2_upcont.tif` in `services/api/.data/training`).

| Mineral | AUC | AUC outside USA | Shipped |
|---|---|---|---|
| Diamond | 0.87 | 0.88 | Yes |
| Rare earth elements | 0.852 | 0.748 | Yes |
| Gypsum | 0.839 | 0.766 | Yes |
| Silver | 0.835 | 0.834 | Yes |
| Clay | 0.834 | 0.728 | Yes |
| Antimony | 0.833 | 0.828 | Yes |
| Tantalum | 0.823 | 0.763 | Yes |
| Uranium | 0.823 | 0.723 | Yes |
| Niobium | 0.82 | 0.762 | Yes |
| Lead | 0.817 | 0.824 | Yes |
| Nickel | 0.81 | 0.82 | Yes |
| Platinum | 0.808 | 0.805 | Yes |
| Zinc | 0.803 | 0.808 | Yes |
| Fluorite | 0.801 | 0.811 | Yes |
| Titanium | 0.794 | 0.811 | Yes |
| Tungsten | 0.794 | 0.793 | Yes |
| Chromium | 0.791 | 0.749 | Yes |
| Tin | 0.786 | 0.783 | Yes |
| Copper | 0.785 | 0.784 | Yes |
| Limestone | 0.783 | 0.779 | Yes |
| Graphite | 0.765 | 0.725 | Yes |
| Kaolin | 0.757 | 0.7 | Yes |
| Barite | 0.752 | 0.753 | Yes |
| Molybdenum | 0.75 | 0.745 | Yes |
| Gold | 0.746 | 0.725 | No |
| Aluminium | 0.733 | 0.722 | No |
| Phosphate | 0.72 | 0.705 | No |
| Lithium | 0.716 | 0.696 | No |
| Manganese | 0.716 | 0.693 | No |
| Cobalt | 0.711 | 0.707 | No |
| Iron | 0.678 | 0.677 | No |
