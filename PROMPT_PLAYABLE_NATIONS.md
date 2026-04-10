# Tous les pays jouables + Système de reconnaissance territoriale

## Contexte

ORBIS est un simulateur géopolitique. Actuellement seuls 18 pays sont jouables (dropdown codé en dur dans `index.html`). Objectif : rendre **tous les ~200 pays jouables**, y compris les pays non-reconnus (Kosovo, Taiwan, Somaliland, Sahara Occidental, Chypre du Nord…), avec un système de reconnaissance diplomatique réaliste.

---

## Étape 0 — Désalignement critique des codes pays

- [x] Corriger `ISO3_TO_NUM` dans `map-leaflet.js` pour s'aligner sur `NAMES` :
  - `KOS:9001` (Kosovo — était 383)
  - `TWN:9002` (Taiwan — était 158)
  - `SOL:9003` (Somaliland — était 706=Somalie)
  - `SAH:9008` (Sahara Occidental — était 732)
  - `CYN:9012` (Chypre du Nord — était 983)
  - `SDS:736` (Soudan du Sud — était 728)
  - `KAS:9020` (Cachemire — nouveau code)
- [x] Vérifier `PSX:275` (Palestine) OK
- [x] Ajouter dans `NAMES` : `9020:'Cachemire'` si manquant
- [x] Ajouter dans `FLAGS` : `9020:'🏔'` si manquant

---

## Étape 1 — Sélecteur de nation : tous les pays jouables

- [x] Remplacer `<select id="sel-nation">` dans `index.html` par le composant `.nation-picker` (input search + liste filtrée + hidden input pour valeur)
- [x] Implémenter `initNationPicker()` dans `ui.js` :
  - Tri alphabétique de `NAMES` (normalisation NFD pour accents)
  - Sections : « Pays majeurs » (FEATURED), « Territoires disputés » (DISPUTED), « Tous les pays »
  - Filtre search input, gestion focus/blur, click-outside ferme la liste
  - Présélection France par défaut, format hidden `"Nom|Code"`
- [x] Ajouter styles CSS `.nation-picker`, `.nation-list`, `.np-item`, `.np-section`, `.np-badge`, `.np-item.disputed`
- [x] Appeler `initNationPicker()` au `DOMContentLoaded`
- [x] Vérifier que `startGame()` fonctionne toujours avec le hidden input

---

## Étape 2 — Relations auto-générées par blocs géopolitiques

- [x] Ajouter `GEO_BLOCS` dans `data.js` (NATO, OTSC, UE, BRICS, ASEAN, CCG, LIGUE_ARABE, MERCOSUR, UNION_AFRICAINE, OCS, FIVE_EYES, QUAD)
- [x] Ajouter `BILATERAL_CONFLICTS` (~50 paires de conflits/alliances spécifiques vrais en 2025)
- [x] Ajouter `BLOC_RIVALRIES` (NATO vs OTSC, FIVE_EYES vs OCS)
- [x] Implémenter `generateRelations(playerCode)` :
  1. `INIT_REL` priorité max
  2. Conflits bilatéraux
  3. Détection blocs du joueur
  4. Membres même bloc militaire → `ally`
  5. Blocs rivaux → `tension`
- [x] Remplacer dans `startGame()` : `relations: { ...(INIT_REL[+code] || {}) }` → `relations: generateRelations(+code)`
- [x] Étendre `initWorldRels()` pour utiliser `BILATERAL_CONFLICTS` et blocs sur toutes les paires majeures

---

## Étape 3 — Système de reconnaissance territoriale

- [x] Ajouter `RECOGNITION` dans `data.js` pour : Kosovo (9001), Taiwan (9002), Palestine (275), Somaliland (9003), Sahara Occidental (9008), Chypre du Nord (9012)
- [x] Implémenter `isRecognizedBy(territoryCode, observerCode)`
- [x] Ajouter dans `generateRelations()` :
  - Étape 7 : joueur = territoire disputé → `claimed_by` devient `hostile`
  - Étape 8 : autre territoire disputé non reconnu par joueur → pas de relation ou `unrecognized`
- [x] Ajouter `'unrecognized'` dans `REL_LABELS` et `REL_COLORS` (violet sombre `#2a1a3a`)
- [x] Ajouter gestion couleur `unrecognized` dans `map-leaflet.js` (polygones, borders)
- [x] Implémenter `buildTerritorialContext()` dans `turns.js` :
  - Section si joueur = territoire disputé
  - Liste des territoires disputés dans `G.relations` avec état de reconnaissance
  - Règle injectée pour IA : coalitions/sanctions selon reconnaissance
- [x] Injecter `buildTerritorialContext()` dans `buildActionPrompt()` après `═══ RELATIONS ═══`
- [x] Bloquer `openConvWith()` dans `diplomacy.js` si relation `unrecognized` (message "Ce pays ne reconnaît pas votre nation")
- [x] Bloquer les contacts entrants si statut `unrecognized`
- [x] Fallback compat save : traiter `unrecognized` comme `neutral` si valeur inconnue

---

## Étape 4 — Ressources initiales auto-générées

- [x] Implémenter `getInitResources(code)` dans `data.js` :
  - Priorité à `INIT_RESOURCES` manuel
  - Heuristiques : G7, NATO+UE, NATO, UE, BRICS, disputed
  - Jitter ±5 pour variation
- [x] Remplacer dans `startGame()` : `INIT_RESOURCES[+code] || {...}` → `getInitResources(+code)`

---

## Étape 5 — Capitales et archétypes leaders auto-générés

- [x] Dans `map-leaflet.js`, après chargement provinces, compléter `CAPITALS` manquants via centroïde des provinces du pays
- [x] Dans `diplomacy.js` (et partout où `LEADER_ARCHETYPES[code]` est lu), fallback : `{ type: 'Pragmatique', trait: 'Défend les intérêts nationaux.', emoji: '🏛' }`

---

## Contraintes

- Les 18 `INIT_REL` manuels restent PRIORITAIRES (plus précis que génération auto)
- Les codes 9000+ de `NAMES` sont la référence — `ISO3_TO_NUM` doit s'aligner dessus
- Le statut `unrecognized` peut évoluer en cours de partie (reconnaissance via décret ou IA)
- Compat saves : `unrecognized` non géré → traité comme `neutral`, pas de crash
- Ne pas générer de relations pour territoires inhabités (pas de provinces dans TopoJSON)
- `buildTerritorialContext()` ajoute ~100-200 tokens, acceptable
