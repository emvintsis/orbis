# Prompt Claude Code — Carte propre : provinces, zoom, couleurs

3 chantiers indépendants. Tous terminés.

---

## CHANTIER 1 — Nouveau admin1.topojson avec les vraies provinces ✅

Script `build-topojson.py` créé et exécuté. Résultat :
- USA: 51 États, Canada: 13, Russie: 86, Chine: 32, Inde: 36, Brésil: 27
- Total: 4596 provinces
- Taille: 2.7 MB (simplification 0.01)
- Mapping `adm0_a3` déjà compatible dans map-leaflet.js (ligne 405)

---

## CHANTIER 2 — Bordures régions visibles au zoom seulement ✅

- `getRegionStyle()` dynamique selon le zoom (invisible <4, léger 4-6, visible 6+)
- `_borderLayer` épaissi (weight: 1.2, opacity: 0.9) pour frontières pays permanentes
- `rebuildBorders()` mis à jour aussi
- `zoomend` handler ajouté pour MAJ des bordures de régions

---

## CHANTIER 3 — Chaque pays a sa propre couleur unique ✅

- `getCC()` remplacé : palette COUNTRY_PALETTE de 30 couleurs + hash stable + `adjustBrightness()`
- Relations ne changent plus la couleur des pays
- `updateRelationMarkers()` ajouté : pastilles emoji sur les capitales (🟢 allié, 🟡 tension, 🔴 hostile, ⚔️ guerre)
- Appelé à la fin de `updateColors()`

---

## ORDRE D'EXÉCUTION

1. ✅ **Chantier 3** (couleurs) — le plus rapide
2. ✅ **Chantier 2** (zoom bordures)
3. ✅ **Chantier 1** (nouveau topojson)
