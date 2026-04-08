# Plan : Fix provinces manquantes + lag carte

## Problème
1. **Lag** : ~4000 SVG `<path class="province">` dessinés en permanence, même à zoom 1 où ils sont invisibles (stroke 0.18px)
2. **Provinces manquantes** : certains pays n'ont aucune province dans `ne_50m_admin_1_states_provinces.geojson`

## Solution

### Étape 1 — Performance : affichage conditionnel des provinces par zoom ✅ DONE
- Ajouter un seuil de zoom (`PROVINCE_ZOOM_THRESHOLD = 3`)
- Dans le handler `d3zoom.on('zoom')`, toggle `display:none` / `display:block` sur les `.province` selon `k >= seuil`
- **Pas d'impact gameplay** : `G.provinceOwnership` et la logique de guerre restent inchangés (ils manipulent des données, pas le DOM)
- `updateColors()` continue de set le fill pour les provinces occupées, elles seront visibles quand on zoome

### Étape 2 — Diagnostic : identifier les pays sans provinces ✅ DONE
- 50m n'avait que 9 pays (294 features) — quasi inutile
- 10m a 4596 features couvrant 251 pays — parfait

### Étape 3 — Remplacement source provinces ✅ DONE
- Téléchargé `ne_10m_admin_1_states_provinces.geojson` (38.8 MB)
- Strippé propriétés inutiles, converti en TopoJSON simplifié + quantifié
- Résultat : `admin1.topojson` (1.5 MB, ~350 KB gzippé), 4461 features, 234 pays
- game.js modifié pour charger `admin1.topojson` local au lieu du CDN 50m
- Conversion TopoJSON → GeoJSON features via `topojson.feature()` côté client

### Étape 4 — Codes ISO manquants dans ISO3_TO_NUM ✅ DONE
- Ajouté `KOS:383` (Kosovo), `SDS:728` (Soudan du Sud), `PRI:630` (Porto Rico)
- 5 pays restants sans provinces : Vatican, Maldives, Marshall, Tuvalu, 736(doublon)
  → Micro-états insulaires sans admin-1 dans Natural Earth, acceptable

### Étape 5 — Nettoyage ✅ DONE
- Supprimé build_data/, node_modules/, package.json (outils de conversion temporaires)
- `admin1.topojson` (1.5 MB) reste dans le repo comme asset statique

## Architecture finale
- Provinces = purement visuel (subdivision strokes) SAUF pendant les guerres (fill occupant)
- La couche `.country-base` (TopoJSON) est toujours visible et interactive
- La logique de guerre utilise `G.provinceOwnership` / `countryToProvinces` (data, pas DOM)
- Provinces cachées par défaut (`display:none`), visibles au zoom >= 3
- Provinces occupées (guerre) toujours visibles quel que soit le zoom
- Source : `admin1.topojson` local (1.5 MB, ~350 KB gzippé, 4461 features, 234 pays)
