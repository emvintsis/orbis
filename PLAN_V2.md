# Plan V2 — Régions, optimisation, guerres réelles

## Tâche 1 — Régions au lieu de départements ✅ DONE
- Problème : admin1.topojson = 4461 features (départements/provinces détaillés) → lag
- Solution : fusionner les features ayant un champ `region` (47 pays, ex: GBR 232→16, FRA 101→18)
- Résultat : 2613 features, 234 pays, 1 MB (280 KB gzippé)
- Pays sans champ `region` gardent leurs admin-1 tels quels (ce sont déjà des régions)

## Tâche 2 — Expansion territoriale par régions conquises ✅ DONE
- `initializeOwnership()` applique les guerres initiales : transfère N provinces proportionnel au `progress`
- Le transfert progressif en cours de jeu était déjà implémenté (evolutions_guerre)
- `updateColors()` colore les provinces occupées avec la couleur de l'occupant
- `updateBordersMesh()` dessine les contours des provinces occupées (front-borders animés)

## Tâche 3 — Optimisation performances ✅ DONE
- Provinces dans un `<g class="province-layer">` avec toggle display sur le groupe (1 op au lieu de 2600)
- Zoom handler throttlé via `requestAnimationFrame`
- `updateColors()` sans transitions D3 (supprimé `.transition().duration(600)`)
- `updateBordersMesh()` : frontières pays créées une seule fois (cachées dans `_borderPath`)
- Sélections label/province cachées dans des variables (`_labelLayer`, `_provinceLayer`)
- Provinces visibles uniquement au zoom >= 3

## Tâche 4 — Guerres actuelles du monde réel ✅ DONE
- `INIT_WARS` dans data.js : Russie-Ukraine (progress 22%), Israël-Palestine (progress 75%)
- `INIT_WORLD_TENSIONS` : tensions Inde-Pakistan, Israël-Iran, Israël-Liban, Corée N-S, Arabie-Yémen, Myanmar-Chine
- `INIT_REL` enrichi : Israël (376) ajouté comme pays avec relations initiales, Palestine en 'war' avec Israël
- `initWorldRels()` intègre `INIT_WORLD_TENSIONS`
- `startGame()` charge `INIT_WARS` dans `G.warProgress` + sync relations du joueur
- `initializeOwnership()` transfère les provinces des zones occupées au démarrage
