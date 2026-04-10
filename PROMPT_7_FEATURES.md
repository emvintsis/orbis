# Prompt Claude Code — 7 améliorations gameplay & UI

Fais chaque chantier dans l'ordre. Teste après chaque.

---

## CHANTIER 1 — Texte courbé sur les pays ✅

Les noms des pays doivent épouser la forme du territoire, comme sur Pax Historia. Utiliser des labels SVG avec rotation et étirement.

### Approche

Au lieu de `L.divIcon` pour les labels, créer un `L.svgOverlay` par pays avec un `<text>` orienté et étiré selon le bounding box du pays.

Dans map-leaflet.js, remplacer la logique de création des labels dans `updateCountryLabels()` :

```js
function updateCountryLabels() {
  if (!leafletMap || !_labelTiers || !_labelTiers.length) return;
  const wasOnMap = _labelTiers.map(t => leafletMap.hasLayer(t));
  _labelTiers.forEach(tier => { leafletMap.removeLayer(tier); tier.clearLayers(); });

  const TIER0 = new Set([840,643,156,356,76,124,36,392,484,710,360]);

  d3countries.forEach(feat => {
    const code = +feat.id;
    // Skip les pays absorbés
    if (G.absorbedCountries && G.absorbedCountries[code]) return;
    if (G.regions && G.regions.length) {
      const hasRegions = G.regions.some(r => r.owner === code);
      if (!hasRegions) return;
    }

    const name = getCountryName(code);
    if (!name || name === String(code)) return;

    const area = _countryAreaDeg[code] || 0;
    let tier;
    if (TIER0.has(code)) tier = 0;
    else if (area >= 20) tier = 1;
    else if (area >= 2) tier = 2;
    else return;

    // Calculer le bounding box du pays pour orienter le texte
    try {
      const bounds = L.geoJSON(feat).getBounds();
      if (!bounds.isValid()) return;
      
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const latSpan = ne.lat - sw.lat;
      const lngSpan = ne.lng - sw.lng;
      
      // Déterminer si le pays est plus large que haut
      const isWide = lngSpan > latSpan * 1.3;
      const isTall = latSpan > lngSpan * 1.3;
      
      // Centroïde (préférer la capitale)
      const center = d3centroids[code] || [bounds.getCenter().lat, bounds.getCenter().lng];
      
      // Taille de police adaptée à la taille du pays
      const baseSize = tier === 0 ? 14 : tier === 1 ? 11 : 9;
      
      // Espacement des lettres proportionnel à la largeur
      const letterSpacing = Math.min(12, Math.max(2, lngSpan * 0.8));
      
      const cls = tier === 0 ? 'label-xl' : tier === 1 ? 'label-lg' : 'label-md';
      
      // Style avec letter-spacing pour étirer le texte
      const style = `letter-spacing:${letterSpacing}px;font-size:${baseSize}px`;
      
      const divIcon = L.divIcon({
        className: 'leaflet-country-label ' + cls,
        html: `<span style="${style}">${name.toUpperCase()}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      
      L.marker(center, { icon: divIcon, interactive: false }).addTo(_labelTiers[tier]);
    } catch(e) {}
  });

  // Pays custom (code >= 9100)
  Object.entries(G.countries || {}).forEach(([code, c]) => {
    code = +code;
    if (code < 9100) return;
    const regs = (G.regions || []).filter(r => r.owner === code);
    if (!regs.length) return;
    let latSum = 0, lngSum = 0, cnt = 0;
    regs.forEach(r => {
      const cent = _geoCentroid(r);
      if (cent) { latSum += cent[0]; lngSum += cent[1]; cnt++; }
    });
    if (!cnt) return;
    const center = [latSum / cnt, lngSum / cnt];
    const divIcon = L.divIcon({
      className: 'leaflet-country-label label-md',
      html: `<span style="letter-spacing:4px;font-size:9px">${c.name.toUpperCase()}</span>`,
      iconSize: [0, 0], iconAnchor: [0, 0]
    });
    L.marker(center, { icon: divIcon, interactive: false }).addTo(_labelTiers[2]);
  });

  if (_mapOptions.labels) {
    wasOnMap.forEach((was, i) => { if (was) leafletMap.addLayer(_labelTiers[i]); });
    if (!leafletMap.hasLayer(_labelTiers[0])) leafletMap.addLayer(_labelTiers[0]);
  }
}
```

CSS pour les labels courbés :
```css
.leaflet-country-label span {
  font-family: 'Inter', sans-serif;
  font-weight: 800;
  color: rgba(255,255,255,0.55);
  text-shadow: 0 0 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9);
  white-space: nowrap;
  text-transform: uppercase;
  pointer-events: none;
  user-select: none;
}
.label-xl span { font-size: 14px; letter-spacing: 12px; color: rgba(255,255,255,0.6); }
.label-lg span { font-size: 11px; letter-spacing: 8px; }
.label-md span { font-size: 9px; letter-spacing: 4px; }
```

---

## CHANTIER 2 — Panneau info pays au clic ✅

Quand on clique sur un pays, afficher un panneau d'info AVANT d'ouvrir la diplo.

### HTML

Ajouter dans index.html, dans game-body :

```html
<div class="country-info-panel" id="country-info-panel">
  <div class="cip-header">
    <span class="cip-flag" id="cip-flag"></span>
    <span class="cip-name" id="cip-name"></span>
    <button class="cip-close" onclick="closeCountryInfo()">✕</button>
  </div>
  <div class="cip-body">
    <div class="cip-row"><span class="cip-label">Relation</span><span class="cip-val" id="cip-rel"></span></div>
    <div class="cip-row"><span class="cip-label">Régions</span><span class="cip-val" id="cip-regions"></span></div>
    <div class="cip-row"><span class="cip-label">Puissance estimée</span><span class="cip-val" id="cip-power"></span></div>
    <div class="cip-row"><span class="cip-label">Traités actifs</span><span class="cip-val" id="cip-treaties"></span></div>
    <div class="cip-row"><span class="cip-label">Guerres</span><span class="cip-val" id="cip-wars"></span></div>
  </div>
  <div class="cip-actions">
    <button class="cip-btn cip-btn-diplo" onclick="cipOpenDiplo()">💬 Discuter</button>
    <button class="cip-btn cip-btn-war" onclick="cipDeclareWar()">⚔ Déclarer la guerre</button>
  </div>
</div>
```

### CSS

```css
.country-info-panel {
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 340px;
  background: rgba(12, 16, 24, 0.97);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 12px;
  z-index: 800;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  animation: cipFadeIn 0.2s ease;
}
.country-info-panel.active { display: block; }
@keyframes cipFadeIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }

.cip-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; border-bottom: 1px solid var(--border);
}
.cip-flag { font-size: 1.8rem; }
.cip-name { flex:1; font-size: 1rem; font-weight: 700; color: var(--text); }
.cip-close { background:none; border:none; color:var(--text3); font-size:1rem; cursor:pointer; }

.cip-body { padding: 12px 16px; }
.cip-row { display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.cip-label { font-size:0.72rem; color:var(--text3); }
.cip-val { font-size:0.72rem; color:var(--text); font-weight:600; }

.cip-actions { display:flex; gap:8px; padding: 12px 16px; border-top: 1px solid var(--border); }
.cip-btn { flex:1; padding:8px; font-size:0.72rem; font-weight:600; border-radius:6px; cursor:pointer; border:1px solid var(--border); }
.cip-btn-diplo { background:rgba(40,120,200,0.15); color:#70b0f0; border-color:rgba(40,120,200,0.3); }
.cip-btn-war { background:rgba(200,40,40,0.1); color:#f07070; border-color:rgba(200,40,40,0.2); }
.cip-btn:hover { filter: brightness(1.2); }
```

### JavaScript

```js
let _cipCode = null;

function openCountryInfo(code) {
  _cipCode = code;
  const name = getCountryName(code);
  const flag = getCountryFlag(code);
  const rel = G.relations[code] || 'neutral';
  
  document.getElementById('cip-flag').textContent = flag;
  document.getElementById('cip-name').textContent = name;
  document.getElementById('cip-rel').textContent = REL_LABELS[rel] || 'Neutre';
  document.getElementById('cip-rel').style.color = REL_COLORS[rel] || '#888';
  
  // Nombre de régions
  const regionCount = G.regions ? G.regions.filter(r => r.owner === code).length : '?';
  document.getElementById('cip-regions').textContent = regionCount;
  
  // Puissance estimée (basée sur le nombre de régions)
  const powerEstimate = Math.min(100, Math.round(regionCount * 3));
  document.getElementById('cip-power').textContent = powerEstimate + '/100';
  
  // Traités actifs avec ce pays
  const treaties = (G.treaties || []).filter(t => t.active && t.parties.some(p => p.code === code));
  document.getElementById('cip-treaties').textContent = treaties.length ? treaties.map(t => t.label).join(', ') : 'Aucun';
  
  // Guerres
  const wars = [];
  Object.entries(G.warProgress || {}).forEach(([def, wp]) => {
    if (+def === code || wp.attacker === code) wars.push(`vs ${getCountryName(+def === code ? wp.attacker : +def)}`);
  });
  document.getElementById('cip-wars').textContent = wars.length ? wars.join(', ') : 'Aucune';
  
  document.getElementById('country-info-panel').classList.add('active');
}

function closeCountryInfo() {
  document.getElementById('country-info-panel').classList.remove('active');
  _cipCode = null;
}

function cipOpenDiplo() {
  if (_cipCode) {
    closeCountryInfo();
    openConvWith(_cipCode, getCountryName(_cipCode));
  }
}

function cipDeclareWar() {
  if (_cipCode) {
    closeCountryInfo();
    const textarea = document.getElementById('action-input');
    if (textarea) textarea.value = `Déclarer la guerre à ${getCountryName(_cipCode)}`;
  }
}
```

### Modifier le click handler dans _regionLayer

Dans map-leaflet.js, dans le `onEachFeature` du _regionLayer (ou du countryLayer), remplacer le click handler :

```js
layer.on('click', e => {
  const owner = feature.properties.owner || +feature.id;
  if (owner === G.nationCode) return;
  openCountryInfo(owner);
});
```

---

## CHANTIER 3 — Mémoire longue par consolidation ✅

### Principe

Tous les 5 tours, résumer les 5 derniers tours en ~200 mots et stocker dans `G.consolidations[]`. Injecter les 2-3 dernières consolidations dans le prompt.

### Implémentation

Dans turns.js, à la FIN de `resolveAction()`, après le saveGame() :

```js
  // Consolidation mémoire tous les 5 tours
  if (G.turn > 0 && G.turn % 5 === 0) {
    consolidateMemory();
  }
```

Fonction de consolidation (PAS d'appel API, juste du côté client) :

```js
function consolidateMemory() {
  if (!G.consolidations) G.consolidations = [];
  
  // Récupérer les 5 derniers résumés d'action
  const recentHistory = (G.actionHistory || []).slice(-5);
  if (recentHistory.length === 0) return;
  
  const summary = recentHistory.map(h => {
    const turn = h.turn || '?';
    const action = (h.action || '').slice(0, 80);
    const result = (h.result || h.resume || '').slice(0, 80);
    const events = (h.events || []).slice(0, 3).map(e => e.titre || e).join(', ');
    return `T${turn}: ${action}${result ? ' → ' + result : ''}${events ? '. Événements: ' + events : ''}`;
  }).join('\n');
  
  const consolidation = {
    fromTurn: recentHistory[0]?.turn || G.turn - 5,
    toTurn: G.turn,
    date: G.date,
    text: summary.slice(0, 600)
  };
  
  G.consolidations.push(consolidation);
  
  // Garder max 10 consolidations (= 50 tours d'histoire)
  if (G.consolidations.length > 10) G.consolidations.shift();
  
  console.info(`[MEMORY] Consolidation tours ${consolidation.fromTurn}-${consolidation.toTurn}`);
}
```

### Injection dans le prompt

Dans `buildActionPrompt()` de turns.js, dans la section CONTEXTE, après `${hist}` :

```js
  // Mémoire longue
  const memoryCtx = (G.consolidations || []).slice(-3).map(c => 
    `[Tours ${c.fromTurn}-${c.toTurn}, ${c.date}] ${c.text}`
  ).join('\n');
  const memoryLine = memoryCtx ? `\nMÉMOIRE HISTORIQUE:\n${memoryCtx}` : '';
```

Injecter `${memoryLine}` après `${hist}` dans le template du prompt.

### Sauvegardes

Dans ui.js :
- startGame : `consolidations: []`
- loadSave : `consolidations: save.consolidations || []`
- saveGame : `consolidations: G.consolidations || []`

---

## CHANTIER 4 — Monde vivant réaliste ✅

### Le problème

Le monde bouge peu entre les tours, et quand il bouge c'est souvent irréaliste (guerre tous les 3 mois).

### Fix dans buildActionPrompt()

Remplacer le bloc MONDE VIVANT dans buildActionPrompt() par :

```js
  const worldBoost = `
MONDE VIVANT : Le monde évolue indépendamment du joueur, mais de manière RÉALISTE.
- Les guerres entre pays tiers sont RARES (1-2 par an max dans le monde). Les tensions montent progressivement avant un conflit.
- Les événements courants : élections, réformes économiques, accords commerciaux, sommets diplomatiques, crises humanitaires, scandales politiques, avancées scientifiques.
- Les guerres existantes évoluent (cessez-le-feu, escalade, négociations) mais de nouvelles guerres ne démarrent que si les tensions sont au maximum depuis plusieurs tours.
- Si ${_jumpDuration} est "semaine" ou "mois" : 0-1 évolution mondiale mineure.
- Si ${_jumpDuration} est "trimestre" : 1-2 évolutions mondiales, dont max 1 changement de relation significatif.
- Si ${_jumpDuration} est "semestre" ou "an" : 2-4 évolutions mondiales, des élections, des traités, possiblement 1 nouveau conflit si les tensions existantes l'imposent.
- RÉALISME : consulte le calendrier mondial. En janvier = Davos, en septembre = AG ONU, en novembre = G20/COP. Les événements doivent coller à la période.${calendarCtx}`;
```

---

## CHANTIER 5 — Mini-carte ✅

### HTML

Ajouter dans index.html, dans map-wrap :

```html
<div class="minimap" id="minimap"></div>
```

### CSS

```css
.minimap {
  position: absolute;
  bottom: 80px;
  left: 12px;
  width: 160px;
  height: 90px;
  background: rgba(12, 16, 24, 0.9);
  border: 1px solid var(--border);
  border-radius: 6px;
  z-index: 500;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.minimap .leaflet-container { background: #0a0e14 !important; }
```

### JavaScript

Dans map-leaflet.js, APRÈS la création de leafletMap, ajouter :

```js
  // Mini-carte
  const minimapTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_noannotation/{z}/{x}/{y}{r}.png', {
    maxZoom: 4, subdomains: 'abcd'
  });
  const minimap = new L.Control.MiniMap(minimapTiles, {
    toggleDisplay: false,
    minimized: false,
    position: 'bottomleft',
    width: 160,
    height: 90,
    zoomLevelOffset: -5,
    zoomAnimation: false
  }).addTo(leafletMap);
```

MAIS le plugin `L.Control.MiniMap` n'est peut-être pas chargé. Alternative sans plugin :

```js
  // Mini-carte maison
  const minimapDiv = document.getElementById('minimap');
  if (minimapDiv) {
    const minimapMap = L.map(minimapDiv, {
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false,
      boxZoom: false, keyboard: false,
      center: [20, 0], zoom: 1
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_noannotation/{z}/{x}/{y}{r}.png', {
      maxZoom: 4, subdomains: 'abcd'
    }).addTo(minimapMap);
    
    // Rectangle de vue
    let viewRect = null;
    function updateMinimap() {
      const bounds = leafletMap.getBounds();
      if (viewRect) minimapMap.removeLayer(viewRect);
      viewRect = L.rectangle(bounds, {
        color: '#d4920a', weight: 1.5, fill: true, fillOpacity: 0.15, interactive: false
      }).addTo(minimapMap);
    }
    leafletMap.on('moveend', updateMinimap);
    leafletMap.on('zoomend', updateMinimap);
    setTimeout(updateMinimap, 1000);
  }
```

---

## CHANTIER 6 — Raccourcis clavier ✅

Dans map-leaflet.js ou ui.js, ajouter :

```js
document.addEventListener('keydown', e => {
  // Ne pas intercepter si on est dans un textarea/input
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  
  switch(e.key) {
    case 'Enter':
      // Exécuter l'action
      const execBtn = document.getElementById('btn-exec');
      if (execBtn && !execBtn.disabled) execBtn.click();
      break;
    case 'Escape':
      // Fermer la chronologie / le panneau info / les modals
      if (document.getElementById('chrono-panel')?.classList.contains('active')) {
        closeChronology();
      } else if (document.getElementById('country-info-panel')?.classList.contains('active')) {
        closeCountryInfo();
      } else {
        // Fermer toute modal ouverte
        document.querySelectorAll('.modal-ov.on').forEach(m => m.classList.remove('on'));
      }
      break;
    case 'n': case 'N':
      // Suivant dans la chronologie
      if (document.getElementById('chrono-panel')?.classList.contains('active')) {
        nextChronoStep();
      }
      break;
    case '1':
      if (!e.ctrlKey) setJumpDuration('semaine');
      break;
    case '2':
      if (!e.ctrlKey) setJumpDuration('mois');
      break;
    case '3':
      if (!e.ctrlKey) setJumpDuration('trimestre');
      break;
    case '4':
      if (!e.ctrlKey) setJumpDuration('semestre');
      break;
    case '5':
      if (!e.ctrlKey) setJumpDuration('an');
      break;
    case 'p': case 'P':
      // Passer le tour
      if (!e.ctrlKey) {
        const skipBtn = document.getElementById('btn-skip');
        if (skipBtn) skipBtn.click();
      }
      break;
  }
});
```

---

## CHANTIER 7 — Tutoriel première partie ✅

### Principe

Si `G.turn === 1` et pas de save, afficher un overlay de bienvenue avec 3 étapes.

### HTML

```html
<div class="tuto-overlay" id="tuto-overlay">
  <div class="tuto-card">
    <div class="tuto-step" id="tuto-step-1">
      <div class="tuto-emoji">🌍</div>
      <h3>Bienvenue dans ORBIS</h3>
      <p>Vous dirigez <strong id="tuto-nation"></strong>. Décrivez vos actions et l'IA simule les conséquences. Tout est possible : diplomatie, guerre, alliances, conquêtes, révolutions...</p>
      <button class="tuto-btn" onclick="nextTutoStep(2)">Suivant →</button>
    </div>
    <div class="tuto-step" id="tuto-step-2" style="display:none">
      <div class="tuto-emoji">✍️</div>
      <h3>Votre première action</h3>
      <p>Tapez votre action dans la barre en bas. Exemples :<br>
      <em>"Proposer une alliance à l'Allemagne"</em><br>
      <em>"Annexer la Belgique"</em><br>
      <em>"Lancer un programme spatial"</em></p>
      <button class="tuto-btn" onclick="nextTutoStep(3)">Suivant →</button>
    </div>
    <div class="tuto-step" id="tuto-step-3" style="display:none">
      <div class="tuto-emoji">💬</div>
      <h3>Diplomatie & Carte</h3>
      <p>Cliquez sur un pays pour voir ses infos et discuter. Utilisez les touches <strong>1-5</strong> pour changer le saut temporel, <strong>N</strong> pour passer les événements, <strong>P</strong> pour passer le tour.</p>
      <button class="tuto-btn" onclick="closeTuto()">Commencer à jouer !</button>
    </div>
  </div>
</div>
```

### CSS

```css
.tuto-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  z-index: 9999;
  align-items: center;
  justify-content: center;
}
.tuto-overlay.active { display: flex; }
.tuto-card {
  background: rgba(12, 16, 24, 0.98);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px;
  max-width: 420px;
  text-align: center;
}
.tuto-emoji { font-size: 3rem; margin-bottom: 12px; }
.tuto-card h3 { font-size: 1.1rem; color: var(--text); margin-bottom: 10px; }
.tuto-card p { font-size: 0.78rem; color: var(--text2); line-height: 1.6; margin-bottom: 16px; }
.tuto-card em { color: var(--accent); font-style: normal; }
.tuto-btn {
  padding: 10px 24px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.tuto-btn:hover { background: #c08500; }
```

### JavaScript

```js
function showTutorial() {
  if (G.turn > 1 || localStorage.getItem('orbis_tuto_done')) return;
  document.getElementById('tuto-nation').textContent = G.nation;
  document.getElementById('tuto-overlay').classList.add('active');
}

function nextTutoStep(step) {
  document.querySelectorAll('.tuto-step').forEach(s => s.style.display = 'none');
  document.getElementById('tuto-step-' + step).style.display = 'block';
}

function closeTuto() {
  document.getElementById('tuto-overlay').classList.remove('active');
  localStorage.setItem('orbis_tuto_done', '1');
}
```

Appeler `showTutorial()` à la fin de `launchGame()` dans ui.js.

---

## ORDRE

1. Chantier 6 (raccourcis) — 2 min, pas de risque
2. Chantier 4 (monde vivant) — 2 min, juste du prompt
3. Chantier 3 (mémoire) — 5 min
4. Chantier 1 (labels) — 5 min  
5. Chantier 2 (panneau info) — 10 min
6. Chantier 5 (mini-carte) — 5 min
7. Chantier 7 (tutoriel) — 5 min

`node --check` après chaque chantier.
