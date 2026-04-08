# ORBIS — État des fonctionnalités
> Compte rendu technique · 2026-04-07 (mis à jour)

---

## Architecture

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML + 4 écrans de navigation |
| `orbis.css` | Styles complets (~27K) |
| `data.js` | Pays, drapeaux, relations initiales, schéma JSON dynamique |
| `api.js` | Couche Gemini API isolée (erreurs, parsing, debug) |
| `game.js` | Logique complète (carte, actions, diplomatie, IA, sauvegarde) |

Aucun framework. Vanilla JS + D3.js v7 + TopoJSON. Gemini API pour l'IA.

---

## Navigation multi-écrans

- **Écran Titre** : logo ORBIS animé, 3 boutons (Nouvelle Partie / Charger / Paramètres)
- **Écran Nouvelle Partie** : configuration complète avant le lancement
- **Écran Charger** : liste des sauvegardes avec aperçu (nation, tour, date, modules)
- **Écran Paramètres** : gestion de la clé API + suppression des sauvegardes
- Transitions `showScreen()` — inline styles, pas de conflit CSS

---

## Écran de configuration (Nouvelle Partie)

- Saisie de la clé API Gemini (champ password, bouton 👁 pour révéler)
- Clé sauvegardée dans `localStorage` (`orbis_apikey`) — jamais transmise ailleurs
- Choix de la **nation jouable** parmi **17 nations** :
  - États-Unis, Chine, Russie, France, Allemagne, Royaume-Uni, Inde, Brésil, Japon, Turquie, Iran, Arabie Saoudite, Ukraine
  - **Palestine 🇵🇸, Israël 🇮🇱, Jordanie 🇯🇴, Liban 🇱🇧, Égypte 🇪🇬** *(ajoutés — conflit Moyen-Orient)*
- Choix du **style narratif** : Réaliste / Dramatique / Chaotique
- Choix du **modèle Gemini** :
  - `gemini-3-flash-preview` — recommandé
  - `gemini-2.5-flash` — stable
  - `gemini-2.5-pro` — qualité maximale
  - `gemini-2.0-flash` — léger
- **Difficulté** (4 niveaux) : Civil / Diplomate / Stratège / Hardcore
  - Chaque niveau injecte une instruction système différente dans l'IA (coopérative → agressive)
  - Hint descriptif mis à jour dynamiquement
- **Modules activables** (checkboxes avec toggle visuel) :
  - 💰 Gestion des Ressources (trésorerie / stabilité / puissance militaire)
  - 📢 Opinion Publique (réaction du peuple à chaque décret)
  - 🌐 Géopolitique Dynamique (relations inter-IA évolutives, Breaking News)
  - ⚠ Événements de Crise (pandémies, krachs, catastrophes)
  - 🌫 Brouillard de Guerre (pays sans contact masqués sur la carte)

---

## Carte mondiale (D3.js)

- Projection **Natural Earth** adaptée à la largeur de la fenêtre
- **80+ pays** représentés (codes ISO numériques), dont Palestine, Jordanie, Liban, Égypte
- Colorisation dynamique selon la relation avec le joueur :
  - Or `#d4920a` — votre nation
  - Vert `#0f7a3c` — allié
  - Orange `#9a6210` — tensions
  - Rouge foncé `#8a1a1a` — hostile
  - Rouge vif `#cc0000` — guerre
  - Bleu nuit `#14213a` — neutre
  - Noir `#060b12` — inconnu (module Brouillard actif)
- **Transition D3** fluide (500ms) à chaque changement de relations
- **Animation `warPulse`** sur les pays en guerre (stroke rouge pulsant)
- **Surbrillance `country-has-conv`** : contour blanc sur les pays avec une conv ouverte
- **Animation `unreadPulse`** : pays avec message non lu clignote
- Tooltip au survol : nom + statut (affiche "Inconnu" si brouillard actif)
- **Clic sur un pays** → ouvre directement un canal diplomatique
- **Bouton ⌖ Localiser** dans chaque conv → zoom D3 animé (750ms) sur le pays
- Zoom molette + drag (scaleExtent [1, 8]) + boutons +/−/reset
- Légende fixe en bas à gauche (avec entrée "Inconnu" si brouillard actif)

---

## Système de jeu — Le Décret National

- Textarea en bas de l'écran : l'action du joueur en texte libre
- **Entrée** = soumettre | **Shift+Entrée** = aller à la ligne
- **Le décret est affiché dans le flux** dès la soumission (carte dorée `📜 DÉCRET`)
- L'action est envoyée à Gemini avec un prompt compact :
  - Nation + style + difficulté + date + numéro de tour
  - Relations actuelles non-neutres (format court `Pays:lettre`)
  - Historique compressé : `G.lastResume` (résumé 10 mots généré par Gemini au tour précédent)
  - Contexte mondial : 8 relations bilatérales clés entre grandes puissances
- **Règle absolue injectée** : l'IA ne peut pas agir à la place du joueur. Les événements décrivent uniquement les réactions des autres nations. `relations_modifiees` = perception des autres envers le joueur, jamais une décision prise en son nom.
- **Réponse JSON structurée** (`responseSchema` strict, 8192 tokens max) :
  - `nouvelle_date` — avance de 3 à 6 mois
  - `resume_action` — 10 mots, stocké pour le tour suivant
  - `evenements[]` — 3 à 5 événements catégorisés
  - `contacts_entrants[]` — pays qui réagissent en contactant le joueur
  - `conversations_auto[]` — échanges bilatéraux entre tiers (renseignement)
  - `relations_modifiees[]` — réactions des nations envers le joueur
  - `evolutions_mondiales[]` — changements de relations entre pays tiers (module Géopolitique)
  - `impact_ressources` — delta trésorerie/stabilité/puissance (module Ressources)
  - `opinion_publique` — score 0-100 + commentaire (module Opinion)
  - `evenement_crise` — titre/effet/impact (module Crises)
- Robustesse JSON : 5 stratégies de parsing en cascade
- Validation des codes ISO et statuts avant application

---

## Flux d'Actualités

- Fil chronologique dans le panneau droit (haut)
- **Séparateur temporel** à chaque tour : `SAUT TEMPOREL → Mois AAAA`
- **Carte Décret** (dorée) : affiche le prompt du joueur dès la soumission
- Cartes d'événements avec 7 catégories colorées :
  - `DIPLOMATIQUE` — bleu
  - `MILITAIRE` — rouge
  - `ÉCONOMIQUE` — orange
  - `POLITIQUE` — violet
  - `HUMANITAIRE` — vert
  - `OPINION PUBLIQUE` — jaune (module Opinion)
  - `RENSEIGNEMENT` — gris ardoise
  - `⚡ BREAKING` / `⚡ CRISE MONDIALE` — rouge pulsant (module Géopolitique/Crises)
  - `⚠ ERREUR [TYPE]` — carte debug rouge (erreurs API)
- Animation `slideIn` à l'apparition de chaque carte
- **Carte Renseignement** : partie publique + message source anonyme (style classifié)
- **Carte Breaking News** : générée quand une relation entre grandes puissances change
- **Carte Debug** : type d'erreur, message, détails (safety ratings, snippet JSON, HTTP status)
- **Historique complet (`fullHistory`)** : reconstruit le flux depuis les sauvegardes

---

## Diplomatie

### Conversations bilatérales et groupées
- Panneau droit (bas), liste des conversations actives
- Création via :
  - Clic sur la carte → conv bilatérale directe
  - Bouton **+ Nouveau** → modal multi-nations
  - Contact entrant automatique (réaction IA)
- **Modal amélioré** :
  - Liste de cases à cocher avec recherche en temps réel
  - Tags visuels des nations sélectionnées (avec bouton ✕)
  - Sélection multiple → **conversation de groupe**
- **Conversations de groupe** :
  - Affichage multi-drapeaux + badge `GROUPE` dans la liste
  - Sujet auto-généré : `Sommet multilatéral — Pays A, Pays B…`
  - Chaque nation non-joueur répond à tour de rôle (IA consciente de tous les participants)
  - Contexte multilatéral injecté dans chaque réponse IA

### Chat diplomatique
- **Entrée** = envoyer | **Shift+Entrée** = aller à la ligne
- Gemini incarne le chef d'État de chaque nation participante
- Contexte injecté : date, sujet, relation avec le joueur, 6 derniers échanges
- Tokens de réponse : **1500** (messages complets, non tronqués)
- `cleanReply()` filtre les artefacts de prompt
- Historique conservé par conversation en localStorage

### Notifications de contact entrant
- Toast animé en bas à droite (slide-in, 5s, auto-dismiss)
- Badge numérique sur l'en-tête "Diplomatie"

---

## Modules optionnels

### 💰 Ressources
- 3 jauges en en-tête : Trésorerie 💰 / Stabilité 🏛 / Puissance ⚔
- Barres de progression colorées (or/vert/bleu), mises à jour avec transition 0.5s
- Valeurs initiales : 60 / 70 / 50 ; delta injecté par Gemini chaque tour (±20 max)

### 📢 Opinion Publique
- Score 0-100 + icône émoji (😊/😐/😠) + commentaire une phrase
- Carte dédiée dans le flux après chaque tour

### 🌐 Géopolitique Dynamique
- `worldRels` : carte des relations bilatérales entre les 17 nations jouables
- L'IA peut modifier ces relations en réaction aux actions du joueur
- **Breaking News** générée quand une grande puissance change de statut avec une autre

### ⚠ Crises
- L'IA peut générer un événement de crise (pandémie, krach, catastrophe naturelle)
- Affiché comme `⚡ CRISE MONDIALE` dans le flux

### 🌫 Brouillard de Guerre
- Les pays sans relation et sans conversation sont colorés `#060b12` (noir)
- Tooltip affiche "Inconnu" au lieu du statut
- Légende spécifique affichée sur la carte

---

## Relations initiales — Moyen-Orient

| Nation | Alliés | Hostiles | Tensions |
|---|---|---|---|
| 🇵🇸 Palestine | Iran, Qatar, Turquie | Israël, USA, UK | Égypte, Arabie Saoudite |
| 🇮🇱 Israël | USA, UK, France | Iran, Palestine, Syrie, Liban | Turquie |
| 🇱🇧 Liban | Iran, Syrie | Israël | USA, Arabie Saoudite |
| 🇯🇴 Jordanie | USA, Arabie Saoudite, EAU | Iran | — |
| 🇪🇬 Égypte | Arabie Saoudite, EAU | — | Iran |

---

## Sauvegarde multi-slots

- Auto-save après chaque tour et chaque message diplomatique
- `orbis_saves[]` : tableau de sauvegardes dans `localStorage` (migration auto depuis `orbis_save` legacy)
- Données sauvegardées : nation, relations, conversations, `fullHistory`, `worldRels`, `lastResume`, modules, difficulté, modèle, date in-game, tour
- Indicateur `✓ Sauvegardé` (flash 2s) en en-tête
- Écran "Charger" : aperçu avec drapeau, date, difficulté, modules actifs, numéro de tour
- Suppression individuelle avec confirmation + `clearAllSaves()` dans Paramètres
- Reprise complète : carte reconstruite, conversations restaurées, flux reconstruit depuis `fullHistory`

---

## Interface

- **Redimensionnement des panneaux** : barre verticale (carte ↔ panneau droit, min 280px/max 700px) et barre horizontale (flux ↔ diplomatie, min 60px)
- **En-tête** : Nation, Date, Tour, Difficulté + compteurs alliés/tensions/hostiles/guerres + jauges ressources (si module actif)
- **Erreurs API** : carte debug dans le flux avec type (HTTP/SAFETY/JSON/EMPTY/OTHER), message, détails techniques

---

## Ce qui manque / pistes d'amélioration

### Priorité haute — impact gameplay immédiat

**1. Objectifs de victoire et conditions de défaite**
- Définir des victoires selon le style choisi : hégémonie militaire, domination économique, paix régionale, survie en tant qu'État faible
- Conditions de game over claires : trésorerie à 0 → banqueroute, stabilité à 0 → coup d'État, guerre perdue → occupation
- Gemini génère un écran de fin narratif (résumé de la partie, épitaphe de votre règne)

**2. Alertes contextuelles et avertissements**
- Badge ou toast quand une relation glisse vers "hostile" (−2 niveaux en un tour)
- Alerte si l'opinion publique passe sous 20 (risque de révolte)
- Notification si une puissance majeure change de relation entre elles (déjà partiellement couvert par Breaking News, mais sans alerte proactive)

**3. Résumé structuré de fin de tour**
- Panneau "bilan du tour" avant de passer au suivant : tableau des relations modifiées, delta ressources, opinion, événement de crise — tout au même endroit
- Actuellement les infos sont éparpillées dans le flux, difficile de les lire d'un coup d'œil

**4. Portraits et personnalités des dirigeants IA**
- Attribuer à chaque nation un archétype de dirigeant : Idéologue / Pragmatique / Nationaliste / Expansionniste / Pacifiste
- L'archétype influence le prompt diplomatique (ton, concessions, lignes rouges)
- Affiché dans le chat sous forme de badge discret

---

### Priorité moyenne — profondeur stratégique

**5. Traités formels**
- Au-delà des conversations libres, permettre de proposer des traités codifiés : accord de non-agression, pacte commercial, alliance défensive
- Les traités sont suivis dans un panneau dédié avec date d'expiration et clauses
- Gemini réagit à la violation d'un traité (indignation, rupture diplomatique)

**6. Graphiques de tendances**
- Mini-graphe dans les archives : courbe d'évolution des ressources et de l'opinion publique sur N tours
- Permet de voir l'impact cumulatif des décisions, pas juste le delta du dernier tour

**7. Événements autonomes inter-IA**
- Actuellement les `evolutions_mondiales` existent mais sont générées en réponse au joueur
- Ajouter un système d'événements "de fond" : élections dans un pays tiers, coup d'État IA, traité signé entre deux nations sans implication du joueur
- Renforce l'illusion d'un monde vivant indépendant

**8. Module : Renseignement actif**
- Nouveau module : possibilité de "mandater" une opération de renseignement sur un pays cible
- Gemini révèle des infos partielles sur les intentions de ce pays (tier 1 : intentions, tier 2 : plans militaires, tier 3 : corruption interne)
- Coût en trésorerie ou en stabilité (risque de scandale)

---

### Priorité basse — polish et confort

**9. Export de la partie en récit**
- Bouton "Générer le récit" dans les archives : Gemini compile `fullHistory` en une narration prose de la partie (style livre d'histoire)
- Export en `.txt` ou copie dans le presse-papier

**10. Tutoriel interactif**
- À la première partie, overlay guidé : "Cliquez sur un pays pour ouvrir un canal", "Tapez votre premier décret ici…"
- Peut être désactivé dans les paramètres

**11. Sons et ambiance**
- Musique de fond ambiante (drone politique, musique orchestrale sobre)
- Sons UI discrets : slide de carte, envoi de message, alerte diplomatique
- Contrôle volume dans Paramètres

**12. Nom de slot personnalisable**
- Permettre de nommer une sauvegarde ("Partie URSS - tour 12") pour mieux s'y retrouver
- Actuellement le nom est auto-généré (nation + date)

---

**13. Expansion territoriale par provinces (carte dynamique)**

Je souhaite que la carte de mon jeu ORBIS permette aux nations de s'étendre physiquement. Actuellement, je colorie des pays entiers, ce qui est trop rigide.

**1. Data (`index.html`) :**
- Changer la source D3 pour utiliser le TopoJSON haute résolution : `https://unpkg.com/world-atlas@2.0.2/countries-10m.json` ou mieux, un fichier incluant les provinces (`admin_1`)

**2. State Management (`game.js`) :**
- Ajouter `G.provinceOwnership = {}` dans l'état initial
- Créer une fonction `initializeOwnership()` qui, au premier chargement, attribue chaque province à son pays souverain d'origine

**3. Rendu de la Carte (`game.js`) :**
- Modifier `updateColors()` : au lieu d'utiliser `getCC(+d.id)`, la fonction doit chercher la couleur de l'occupant dans `G.provinceOwnership[+d.id]`
- Si une province est occupée par une nation ennemie, elle doit prendre la couleur de l'ennemi (Rouge) ou de l'attaquant, créant ainsi une "tache" d'occupation sur la carte

**4. Logique de Conquête :**
- Modifier la résolution des guerres (`evolutions_guerre`) : lorsqu'un attaquant gagne du terrain (`delta > 0`), choisir aléatoirement des IDs de provinces limitrophes de la zone de conflit et transférer leur propriété dans `G.provinceOwnership`

**5. Visualisation :**
- Utiliser `topojson.mesh` pour redessiner dynamiquement les frontières : les lignes entre deux provinces possédées par la même nation doivent être fines et transparentes, tandis que la ligne de front (entre deux nations différentes) doit être épaisse et pulsante

**15. Conflits initiaux incomplets**
- Actuellement seule la guerre Russie→Ukraine est pré-chargée dans `warProgress` au démarrage
- Ajouter les conflits actifs réels en 2025 dans `INIT_WARS` (en plus de Russie-Ukraine) :
  - Israël → Gaza (Palestine), Israël → Liban
  - Soudan : guerre civile (SAF vs RSF)
  - Myanmar : guerre civile (junte vs résistance)
  - Yémen : Houthis vs coalition Arabie Saoudite
  - Éthiopie : instabilité régionale (Tigré/Amhara)
  - Sahel : insurrections jihadistes (Mali, Burkina Faso, Niger)
- Ces conflits doivent être injectés dans `G.warProgress` et `G.relations` selon la nation jouée, et dans le prompt de contexte

**16. Date de départ incorrecte**
- Le jeu démarre en "Janvier 2025" alors qu'on est en 2026
- Corriger la date initiale `G.date` dans `startGame()` : `'Janvier 2026'`
- Corriger aussi le titre du jeu dans `index.html` : "Simulateur Géopolitique Mondial · 2025" → 2026
- Vérifier que les scénarios personnalisés générés par Gemini utilisent 2026 comme année de référence par défaut

**17. Événements mondiaux autonomes trop répétitifs**
- Les `evenements_mondiaux` générés par Gemini reviennent trop souvent sur les mêmes types (tremblements de terre, catastrophes naturelles)
- Solutions :
  - Ajouter dans le prompt une contrainte explicite : "NE PAS répéter le même type d'événement que dans les 3 derniers tours"
  - Injecter un `lastWorldEvents` (liste des 3 derniers types d'événements) dans le prompt pour que Gemini les évite
  - Élargir la liste suggérée dans le prompt : scandales politiques, records sportifs, percées scientifiques, incidents diplomatiques mineurs, crises sanitaires locales, faits divers criminels notables, découvertes archéologiques, catastrophes industrielles, élections régionales, mouvements sociaux

---

### Refus explicite (non prioritaire)
- ~~Mode multijoueur~~ — architecturalement incompatible avec le modèle localStorage + Gemini synchrone
- ~~Arbre technologique~~ — crée un meta-game qui entre en conflit avec le texte libre
- ~~Gestion démographique~~ — ajoute de la micro-gestion sans gain narratif clair
