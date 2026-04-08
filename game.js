// ── UI state (pre-game) ──
let _currentDiff = 'diplomate';
let _currentModules = { geopolitique: true };

// ── Game state ──
let G = {
  apiKey:'', saveId:'', model:'', nation:'', nationCode:0, style:'', difficulty:'diplomate',
  date:'Janvier 2025', turn:1, saveName:'',
  modules:{ geopolitique:true },
  ressources:{ tresorerie:60, stabilite:70, puissance:50 },
  relations:{}, actionHistory:[], conversations:[], activeConvId:null,
  lastResume:'', worldRels:{}, fullHistory:[],
  scenarioContext:'', scenarioTitle:'',
  staff: { militaires:[], ministres:[] },
  warProgress: {},
  provinceOwnership: {},
  factions: {},
  treaties: [],
  trendsHistory: [],
  opinionScore: 50, lowOpinionTurns: 0, highTreasuryTurns: 0,
  _gameOver: false
};
let d3svg, d3g, d3zoom, d3path, d3proj;
const d3centroids = {};
let d3countries = [];
let d3world = null;        // TopoJSON pays (pour mesh de frontières pays)
let d3provinces = [];      // features GeoJSON admin-1 enrichis (_provinceId, _countryCode)
const countryToProvinces = {}; // { countryCode: [provinceId, ...] }

// ══════════════════════════════════════════
// ── Navigation ──
// ══════════════════════════════════════════
function showScreen(name) {
  const targetId = name === 'game' ? 'game' : 'screen-' + name;
  ['screen-title','screen-newgame','screen-load','screen-settings','screen-archives','game'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === targetId) {
      el.style.display = 'flex';
      el.classList.add('active');
    } else {
      el.style.display = 'none';
      el.classList.remove('active');
    }
  });
  if (name === 'load') renderLoadScreen();
  if (name === 'settings') renderSettingsScreen();
  if (name === 'archives') renderArchivesScreen();
}

window.addEventListener('DOMContentLoaded', () => {
  // Pre-fill API key
  const savedKey = localStorage.getItem('orbis_apikey');
  if (savedKey) {
    const inp = document.getElementById('api-key-input');
    if (inp) inp.value = savedKey;
  }
  const savedModel = localStorage.getItem('orbis_model');
  if (savedModel) {
    const sel = document.getElementById('sel-model');
    if (sel) sel.value = savedModel;
  }
  // Show title
  showScreen('title');
});

// ── Difficulty ──
const DIFF_HINTS = {
  civil:     'Les nations coopèrent et évitent les conflits. Idéal pour débuter.',
  diplomate: 'Comportement diplomatique standard. Équilibré.',
  stratege:  'Les nations sont stratégiques et opportunistes. Elles exploitent les faiblesses.',
  hardcore:  'Les nations sont agressives, imprévisibles et cherchent l\'hégémonie mondiale.'
};
const DIFF_LABELS = { civil:'Civil', diplomate:'Diplomate', stratege:'Stratège', hardcore:'Hardcore' };

function setDiff(diff) {
  _currentDiff = diff;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === diff));
  document.getElementById('diff-hint').textContent = DIFF_HINTS[diff] || '';
}

function toggleModule(key, checked) {
  _currentModules[key] = checked;
  document.getElementById('mod-' + key)?.classList.toggle('active', checked);
}

// ── API key toggles ──
function toggleKey() {
  const inp = document.getElementById('api-key-input');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}
function toggleSettingsKey() {
  const inp = document.getElementById('settings-api-key');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ══════════════════════════════════════════
// ── Start / Load / New ──
// ══════════════════════════════════════════
async function startGame() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) { document.getElementById('setup-err').textContent = 'Veuillez entrer votre clé API Gemini.'; return; }
  const [name, code] = document.getElementById('sel-nation').value.split('|');
  const style = document.getElementById('sel-style').value;
  const model = document.getElementById('sel-model').value;
  const presetPrompt = document.getElementById('preset-prompt')?.value.trim() || '';
  localStorage.setItem('orbis_apikey', key);
  localStorage.setItem('orbis_model', model);

  const initRes = INIT_RESOURCES[+code] || { tresorerie:60, stabilite:70, puissance:50 };
  G = {
    apiKey: key, saveId: Date.now().toString(),
    model, nation: name, nationCode: +code, style,
    difficulty: _currentDiff, date: 'Janvier 2025', turn: 1,
    modules: { ..._currentModules }, ressources: { ...initRes },
    relations: { ...(INIT_REL[+code] || {}) },
    actionHistory: [], conversations: [], activeConvId: null,
    lastResume: '', worldRels: initWorldRels(), fullHistory: [],
    scenarioContext: '', scenarioTitle: '',
    staff: { militaires:[], ministres:[] },
    warProgress: { ...(typeof INIT_WARS !== 'undefined' ? INIT_WARS : {}) },
    provinceOwnership: {},
    factions: {},
    treaties: [],
    trendsHistory: [],
    opinionScore: 50, lowOpinionTurns: 0, highTreasuryTurns: 0,
    _gameOver: false
  };

  // Synchroniser les relations du joueur avec les guerres initiales
  Object.entries(G.warProgress).forEach(([defCode, wp]) => {
    const def = +defCode, atk = wp.attacker;
    if (def === G.nationCode) G.relations[atk] = 'war';
    if (atk === G.nationCode) G.relations[def] = 'war';
  });

  if (presetPrompt) {
    const btn = document.getElementById('btn-start-game');
    const err = document.getElementById('setup-err');
    btn.disabled = true; btn.textContent = 'Génération du scénario…';
    try {
      const preset = await generatePreset(presetPrompt);
      G.date = preset.date_depart || 'Janvier 2025';
      G.scenarioContext = preset.contexte || '';
      G.scenarioTitle = preset.titre_scenario || presetPrompt.slice(0,40);
      if (Array.isArray(preset.relations_initiales)) {
        preset.relations_initiales.forEach(r => {
          if (!r.paysA || !r.paysB || !r.statut) return;
          if (+r.paysA === +code) G.relations[+r.paysB] = r.statut;
          if (+r.paysB === +code) G.relations[+r.paysA] = r.statut;
          const ka = +r.paysA<+r.paysB ? `${r.paysA}-${r.paysB}` : `${r.paysB}-${r.paysA}`;
          G.worldRels[ka] = r.statut;
        });
      }
      err.textContent = '';
    } catch(e) {
      err.textContent = '⚠ ' + e.message;
      btn.disabled = false; btn.textContent = 'Lancer la Simulation →';
      return;
    }
    btn.disabled = false; btn.textContent = 'Lancer la Simulation →';
  }

  document.getElementById('setup-err').textContent = '';
  launchGame();
}

function loadSave(id) {
  const save = getAllSaves().find(s => s.id === id);
  if (!save) return;
  const key = localStorage.getItem('orbis_apikey') || '';
  if (!key) { showScreen('settings'); return; }

  G = {
    apiKey: key,
    saveId: save.id,
    model: save.model || 'gemini-3-flash-preview',
    nation: save.nation, nationCode: save.nationCode,
    style: save.style, date: save.date, turn: save.turn,
    difficulty: save.difficulty || 'diplomate',
    modules: save.modules || { geopolitique: true },
    ressources: save.ressources || { tresorerie:60, stabilite:70, puissance:50 },
    relations: save.relations || {},
    actionHistory: save.actionHistory || [],
    conversations: save.conversations || [],
    activeConvId: null,
    lastResume: save.lastResume || '',
    worldRels: save.worldRels || initWorldRels(),
    fullHistory: save.fullHistory || [],
    scenarioContext: save.scenarioContext || '',
    scenarioTitle: save.scenarioTitle || '',
    staff: save.staff || { militaires:[], ministres:[] },
    warProgress: save.warProgress || {},
    provinceOwnership: save.provinceOwnership || {},
    factions: save.factions || {},
    treaties: save.treaties || [],
    trendsHistory: save.trendsHistory || [],
    opinionScore: save.opinionScore || 50,
    lowOpinionTurns: save.lowOpinionTurns || 0,
    highTreasuryTurns: save.highTreasuryTurns || 0,
    _gameOver: false
  };
  launchGame();
}

function launchGame() {
  document.getElementById('hdr-nation').textContent = (FLAGS[G.nationCode]||'') + ' ' + G.nation;
  document.getElementById('hdr-date').textContent   = G.date;
  document.getElementById('hdr-turn').textContent   = G.turn;
  document.getElementById('hdr-diff').textContent   = DIFF_LABELS[G.difficulty] || 'Normal';

  // Resource bars
  const hdrRes = document.getElementById('hdr-res');
  hdrRes.style.display = G.modules.ressources ? 'flex' : 'none';
  if (G.modules.ressources) updateResourceBars();

  // Fog legend
  document.getElementById('fog-legend').style.display = G.modules.brouillard ? 'flex' : 'none';
  // Renseignement button
  const intelBtn = document.getElementById('btn-intel');
  if (intelBtn) intelBtn.style.display = G.modules.renseignement ? 'block' : 'none';

  updateCounters();
  updateTreatiesCount();
  showScreen('game');

  if (G.fullHistory && G.fullHistory.length) {
    restoreHistory();
  } else {
    document.getElementById('news-feed').innerHTML =
      '<div style="padding:0.6rem;color:var(--text3);font-style:italic;font-size:0.75rem;">Les actualités géopolitiques s\'afficheront ici après votre première action...</div>';
  }

  document.getElementById('conv-list').innerHTML = '<button class="btn-newconv" onclick="openModal()">+ Nouveau</button>';
  document.getElementById('conv-chat').innerHTML = `<div class="no-conv"><div class="nci">🌐</div><p>Cliquez sur un pays sur la carte pour initier un contact, ou utilisez «&nbsp;+ Nouveau&nbsp;».</p></div>`;
  G.conversations.forEach(c => renderConvItem(c));

  initMap();
  fillModalSelect();
  initStaff();
  flashSaved();
  // Tutoriel sur la première partie
  if (!G.fullHistory?.length) setTimeout(startTutorial, 1200);
}

function newGame() {
  showScreen('title');
}

// ══════════════════════════════════════════
// ── Map ──
// ══════════════════════════════════════════
// Country labels: only show for named countries above a minimum size
const LABEL_MIN_AREA = 3000; // px² threshold for label visibility

// ISO 3166-1 alpha-3 → numérique (pour mapper les provinces GeoJSON aux pays TopoJSON)
const ISO3_TO_NUM = {
  AFG:4,ALB:8,DZA:12,ASM:16,AND:20,AGO:24,ATG:28,ARG:32,ARM:51,ABW:533,AUS:36,
  AUT:40,AZE:31,BHS:44,BHR:48,BGD:50,BRB:52,BLR:112,BEL:56,BLZ:84,BEN:204,BTN:64,
  BOL:68,BIH:70,BWA:72,BRA:76,BRN:96,BGR:100,BFA:854,BDI:108,CPV:132,KHM:116,
  CMR:120,CAN:124,CAF:140,TCD:148,CHL:152,CHN:156,COL:170,COM:174,COD:180,COG:178,
  CRI:188,HRV:191,CUB:192,CYP:196,CZE:203,CIV:384,DNK:208,DJI:262,DMA:212,DOM:214,
  ECU:218,EGY:818,SLV:222,GNQ:226,ERI:232,EST:233,SWZ:748,ETH:231,FJI:242,FIN:246,
  FRA:250,GAB:266,GMB:270,GEO:268,DEU:276,GHA:288,GRC:300,GRD:308,GTM:320,GIN:324,
  GNB:624,GUY:328,HTI:332,HND:340,HUN:348,ISL:352,IND:356,IDN:360,IRN:364,IRQ:368,
  IRL:372,ISR:376,ITA:380,JAM:388,JPN:392,JOR:400,KAZ:398,KEN:404,PRK:408,KOR:410,
  KWT:414,KGZ:417,LAO:418,LVA:428,LBN:422,LSO:426,LBR:430,LBY:434,LIE:438,LTU:440,
  LUX:442,MDG:450,MWI:454,MYS:458,MDV:462,MLI:466,MLT:470,MRT:478,MUS:480,MEX:484,
  MDA:498,MCO:492,MNG:496,MNE:499,MAR:504,MOZ:508,MMR:104,NAM:516,NPL:524,NLD:528,
  NZL:554,NIC:558,NER:562,NGA:566,NOR:578,OMN:512,PAK:586,PSE:275,PAN:591,PNG:598,
  PRY:600,PER:604,PHL:608,POL:616,PRT:620,QAT:634,ROU:642,RUS:643,RWA:646,KNA:659,
  LCA:662,VCT:670,WSM:882,SMR:674,STP:678,SAU:682,SEN:686,SRB:688,SLE:694,SGP:702,
  SVK:703,SVN:705,SLB:90,SOM:706,ZAF:710,SSD:728,ESP:724,LKA:144,SDN:729,SUR:740,
  SWE:752,CHE:756,SYR:760,TWN:158,TJK:762,TZA:834,THA:764,TLS:626,TGO:768,TON:776,
  TTO:780,TUN:788,TUR:792,TKM:795,UGA:800,UKR:804,ARE:784,GBR:826,USA:840,URY:858,
  UZB:860,VUT:548,VEN:862,VNM:704,YEM:887,ZMB:894,ZWE:716,KIR:296,MHL:584,FSM:583,
  PLW:585,NRU:520,TUV:798,COK:184,NIU:570,SYC:690,MYT:175,REU:638,GLP:312,MTQ:474,
  GUF:254,PYF:258,NCL:540,WLF:876,SPM:666,ESH:732,MKD:807,ALG:12,XKX:383,SOM:706,
  TMP:626,ZAR:180,ROM:642,MKD:807,GBR:826,
  // Codes alternatifs Natural Earth (10m admin-1)
  KOS:383,SDS:728,PRI:630,
};

function initMap() {
  const wrap = document.querySelector('.map-wrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  d3.select('#map-svg').selectAll('*').remove();
  d3svg = d3.select('#map-svg').attr('width', W).attr('height', H);
  d3proj = d3.geoNaturalEarth1().scale(W/6.3).translate([W/2, H/2]);
  d3path = d3.geoPath().projection(d3proj);

  const mapBaseDefs = d3svg.append('defs').attr('id','map-base-defs');
  const oceanGrad = mapBaseDefs.append('radialGradient').attr('id','ocean-grad')
    .attr('cx','50%').attr('cy','50%').attr('r','70%');
  oceanGrad.append('stop').attr('offset','0%').attr('stop-color','#0f2847');
  oceanGrad.append('stop').attr('offset','100%').attr('stop-color','#081a32');
  const sf = mapBaseDefs.append('filter').attr('id','map-txt-shadow')
    .attr('x','-60%').attr('y','-60%').attr('width','220%').attr('height','220%');
  sf.append('feDropShadow').attr('dx',0).attr('dy',0).attr('stdDeviation',2.2)
    .attr('flood-color','#000').attr('flood-opacity',1);
  d3svg.append('rect').attr('width',W).attr('height',H).attr('fill','url(#ocean-grad)');

  d3g = d3svg.append('g');
  let _provincesVisible = false;
  let _labelLayer = null;   // cached reference
  let _provinceLayer = null;
  const PROVINCE_ZOOM_THRESHOLD = 3;
  let _zoomRAF = 0;
  d3zoom = d3.zoom().scaleExtent([1,16]).on('zoom', e => {
    d3g.attr('transform', e.transform);
    // Throttle expensive DOM updates via rAF
    cancelAnimationFrame(_zoomRAF);
    _zoomRAF = requestAnimationFrame(() => {
      const k = e.transform.k;
      if (_labelLayer) {
        _labelLayer.selectAll('.country-label')
          .attr('font-size', Math.max(2.5, 4.5/k)+'px')
          .attr('fill', k > 1.5 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.55)');
      }
      const shouldShow = k >= PROVINCE_ZOOM_THRESHOLD;
      if (shouldShow !== _provincesVisible) {
        _provincesVisible = shouldShow;
        if (_provinceLayer) _provinceLayer.attr('display', shouldShow ? null : 'none');
      }
    });
  });
  d3svg.call(d3zoom);
  d3svg.call(d3zoom.transform, d3.zoomIdentity);

  d3g.append('path').datum(d3.geoGraticule()())
    .attr('d',d3path).attr('fill','none')
    .attr('stroke','rgba(80,140,200,0.12)').attr('stroke-width',0.3);

  // Indicateur de chargement
  const loadingTxt = d3svg.append('text')
    .attr('x', W/2).attr('y', H/2)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('fill','rgba(255,255,255,0.35)').attr('font-size','13px')
    .attr('font-family','Inter,sans-serif').attr('pointer-events','none')
    .text('Chargement des provinces…');

  const tt = document.getElementById('map-tt');

  // Chargement parallèle : pays (TopoJSON) + provinces admin-1 (TopoJSON local)
  Promise.all([
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json'),
    d3.json('admin1.topojson')
  ]).then(([worldData, provTopoData]) => {
    loadingTxt.remove();
    d3world = worldData;
    d3countries = topojson.feature(worldData, worldData.objects.countries).features;

    // Exclure les polygones inversés (winding order incorrect) —
    // certains petits pays (ex: Maldives) ont un polygone qui couvre le globe entier
    const maxCountryArea = W * H * 0.35;
    d3countries = d3countries.filter(d => {
      const a = d3path.area(d);
      if (a > maxCountryArea) { console.warn('Inverted polygon excluded:', d.id, 'area:', a); return false; }
      return true;
    });

    // Calculer les centroïdes pays (pour zoom-to-country, war fronts, etc.)
    d3countries.forEach(d => {
      const c = d3path.centroid(d);
      if (c && !isNaN(c[0])) d3centroids[+d.id] = c;
    });

    // Index pays par code numérique pour le fallback centroïde
    const countryByCode = {};
    d3countries.forEach(c => { countryByCode[+c.id] = c; });

    // Bboxes pour le fallback géométrique
    const bboxes = d3countries.map(c => ({
      feat: c, code: +c.id, bbox: d3.geoBounds(c)
    }));

    // Convertir le TopoJSON provinces en GeoJSON features
    // Utiliser topojson.merge() par géométrie pour fusionner les sous-polygones
    // (ex: départements français → régions) et supprimer les frontières internes
    const provFeatures = provTopoData.objects.provinces.geometries.map(geom => {
      const merged = topojson.merge(provTopoData, [geom]);
      return {
        type: 'Feature',
        properties: geom.properties || {},
        geometry: merged
      };
    });

    // Associer chaque province admin-1 à son pays parent
    d3provinces = [];
    Object.keys(countryToProvinces).forEach(k => delete countryToProvinces[k]);

    provFeatures.forEach((feat, i) => {
      const pid = feat.properties?.ne_id || i;
      feat._provinceId = pid;

      // Lookup alpha-3 → numérique
      const a3 = feat.properties?.adm0_a3 || feat.properties?.gu_a3 || '';
      let parentCode = ISO3_TO_NUM[a3] || null;

      // Fallback centroïde si alpha-3 manque
      if (!parentCode) {
        const centroid = d3.geoCentroid(feat);
        if (centroid && !isNaN(centroid[0])) {
          const [lon, lat] = centroid;
          const candidates = bboxes.filter(({bbox: [[x0,y0],[x1,y1]]}) =>
            lon >= x0-1 && lon <= x1+1 && lat >= y0-1 && lat <= y1+1
          );
          for (const {feat: cf, code} of candidates) {
            if (d3.geoContains(cf, centroid)) { parentCode = code; break; }
          }
        }
      }

      feat._countryCode = parentCode;
      if (parentCode !== null) {
        d3provinces.push(feat);
        if (!countryToProvinces[parentCode]) countryToProvinces[parentCode] = [];
        countryToProvinces[parentCode].push(pid);
      }
    });

    // Diagnostic : pays sans provinces
    const countriesWithoutProvinces = d3countries
      .map(c => +c.id)
      .filter(code => NAMES[code] && !countryToProvinces[code]);
    if (countriesWithoutProvinces.length) {
      console.warn(`[ORBIS] ${countriesWithoutProvinces.length} pays sans provinces:`,
        countriesWithoutProvinces.map(c => `${c}=${NAMES[c]}`));
    }
    console.info(`[ORBIS] Provinces chargées: ${d3provinces.length}, Pays couverts: ${Object.keys(countryToProvinces).length}`);

    // ── Couche 1 : fond pays (TopoJSON, couverture 100%, interactif)
    // Tous les pays ont une couleur même si leurs provinces ne matchent pas
    d3g.selectAll('.country-base').data(d3countries).join('path')
      .attr('class', 'country-base').attr('d', d3path)
      .attr('fill', d => getCC(+d.id))
      .attr('stroke', 'rgba(8,20,35,0.7)').attr('stroke-width', 0.35)
      .on('mousemove', (ev, d) => {
        const code = +d.id; const n = NAMES[code]; if (!n) return;
        const rel = G.relations[code];
        let relLabel = (code === G.nationCode) ? 'Votre Nation' : (rel ? REL_LABELS[rel] : 'Neutre');
        if (G.modules?.brouillard) {
          if ((!rel || rel==='neutral') && !_getConvCodes().has(code) && code !== G.nationCode) relLabel = 'Inconnu';
        }
        document.getElementById('tt-n').textContent = (FLAGS[code]||'') + ' ' + n;
        document.getElementById('tt-r').textContent = relLabel;
        tt.style.display = 'block';
        tt.style.left = (ev.offsetX+12)+'px'; tt.style.top = (ev.offsetY-10)+'px';
      })
      .on('mouseleave', () => { tt.style.display='none'; })
      .on('click', (ev, d) => {
        const c = +d.id; if (c === G.nationCode || !NAMES[c]) return;
        openConvWith(c, NAMES[c]);
      });

    // ── Couche 2 : groupe provinces (toggle display sur le groupe, pas sur chaque path)
    _provinceLayer = d3g.append('g').attr('class','province-layer').attr('display','none');
    _provinceLayer.selectAll('.province').data(d3provinces).join('path')
      .attr('class', 'province').attr('d', d3path)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(0,0,0,0.15)').attr('stroke-width', 0.12)
      .attr('pointer-events', 'none');

    // Overlays guerre / factions — au-dessus des provinces, sous labels
    d3g.append('g').attr('class','war-front-layer');
    d3g.append('g').attr('class','faction-overlay-layer');

    // Labels pays (sur les pays assez grands)
    _labelLayer = d3g.append('g').attr('class','label-layer');
    const labelLayer = _labelLayer;
    d3countries.forEach(feat => {
      const code = +feat.id;
      if (!NAMES[code]) return;
      const area = d3path.area(feat);
      if (area < LABEL_MIN_AREA) return;
      const [cx, cy] = d3path.centroid(feat);
      if (!cx || isNaN(cx)) return;
      const name = NAMES[code];
      const label = name.length > 12 ? name.split(' ').map(w=>w[0]).join('').toUpperCase() : name.toUpperCase();
      labelLayer.append('text')
        .attr('class','country-label')
        .attr('x', cx).attr('y', cy)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-size','4.5px').attr('font-family','Rajdhani, sans-serif')
        .attr('font-weight','700').attr('letter-spacing','0.08em')
        .attr('fill','rgba(255,255,255,0.55)')
        .attr('filter','url(#map-txt-shadow)')
        .attr('pointer-events','none')
        .text(label);
    });

    initializeOwnership();
    updateColors();
    updateBordersMesh();
    updateMapConvState();
  }).catch(err => {
    loadingTxt.text('Erreur de chargement — vérifiez la connexion');
    console.error('Map load error:', err);
  });
}

function getBorderColor(code) {
  if (code === G.nationCode) return '#d4920a';
  const rel = G.relations[code];
  if (rel === 'war')     return '#cc0000';
  if (rel === 'hostile') return '#6a1515';
  if (rel === 'ally')    return '#1a5c35';
  if (rel === 'tension') return '#6a4a10';
  return '#162436';
}

// Initialise provinceOwnership : chaque province → code ISO de son pays d'origine
// Appelé après le chargement des provinces GeoJSON, n'écrase pas une sauvegarde existante
function initializeOwnership() {
  if (!d3provinces.length) return;
  if (Object.keys(G.provinceOwnership || {}).length > 0) return;
  G.provinceOwnership = {};
  d3provinces.forEach(feat => {
    G.provinceOwnership[feat._provinceId] = feat._countryCode;
  });
  // Appliquer les guerres initiales : transférer des provinces proportionnellement au progress
  if (G.warProgress) {
    Object.entries(G.warProgress).forEach(([defCode, wp]) => {
      const def = +defCode, atk = wp.attacker;
      const provs = countryToProvinces[def] || [];
      if (!provs.length) return;
      const n = Math.max(1, Math.round(provs.length * wp.progress / 100));
      // Transférer n provinces aléatoires
      const shuffled = [...provs].sort(() => Math.random() - 0.5);
      for (let i = 0; i < n && i < shuffled.length; i++) {
        G.provinceOwnership[shuffled[i]] = atk;
      }
    });
  }
}

// Redessine les frontières :
// - Frontières entre pays (TopoJSON mesh) : trait noir moyen
// - Contours des provinces occupées (différentes de leur pays d'origine) : trait rouge pulsant
let _borderPath = null; // cached country borders path
function updateBordersMesh() {
  if (!d3world || !d3g) return;

  // Frontières nationales : créer une seule fois, pas à chaque appel
  if (!_borderPath) {
    _borderPath = d3g.append('path')
      .datum(topojson.mesh(d3world, d3world.objects.countries, (a, b) => a !== b))
      .attr('class', 'country-borders')
      .attr('d', d3path).attr('fill', 'none')
      .attr('stroke', '#0d1520').attr('stroke-width', 0.7)
      .attr('pointer-events', 'none');
  }

  // Contours des provinces occupées — data join (pas remove/append)
  if (G.provinceOwnership && d3provinces.length) {
    const occupiedFeats = d3provinces.filter(feat => {
      const owner = G.provinceOwnership[feat._provinceId];
      return owner !== undefined && owner !== feat._countryCode;
    });
    d3g.selectAll('.front-borders')
      .data(occupiedFeats, d => d._provinceId)
      .join('path')
      .attr('class', 'front-borders')
      .attr('d', d3path)
      .attr('fill', 'none')
      .attr('stroke-width', 1.4)
      .attr('pointer-events', 'none');
  } else {
    d3g.selectAll('.front-borders').remove();
  }

  if (_labelLayer) _labelLayer.raise();
  d3g.select('.war-front-layer').raise();
  d3g.select('.faction-overlay-layer').raise();
}

// Cache couleurs neutres (calculées une seule fois par code ISO)
const _neutralColorCache = {};
// Cache codes pays avec conversations (invalidé manuellement via _invalidateConvCache)
let _convCodesCache = null;
function _invalidateConvCache() { _convCodesCache = null; }
function _getConvCodes() {
  if (!_convCodesCache) {
    _convCodesCache = new Set();
    for (const c of G.conversations) for (const n of c.nations) _convCodesCache.add(n.code);
  }
  return _convCodesCache;
}

function getCC(code) {
  if (code === G.nationCode) return REL_COLORS.player;
  const rel = G.relations[code];
  if (G.modules?.brouillard) {
    if ((!rel || rel === 'neutral') && !_getConvCodes().has(code)) return '#060b12';
  }
  if (rel && rel !== 'neutral') return REL_COLORS[rel];
  if (_neutralColorCache[code]) return _neutralColorCache[code];
  const hue = Math.round((code * 137.508) % 360);
  const hueAdj = (hue >= 200 && hue <= 230) ? (hue + 40) % 360 : hue;
  const sat = 60 + (code % 5) * 8;
  const lig = 48 + (code % 5) * 6;
  const c = `hsl(${hueAdj},${sat}%,${lig}%)`;
  _neutralColorCache[code] = c;
  return c;
}

// Signature de l'état des guerres pour éviter les rebuilds inutiles
let _lastWarSignature = '';
function _warSignature() {
  const wp = G.warProgress || {};
  return Object.entries(wp).map(([k,v]) => `${k}:${v.attacker}:${v.progress}`).join('|');
}

function updateWarFronts() {
  if (!d3svg || !d3g || !d3countries.length) return;

  // Skip rebuild si l'état des guerres n'a pas changé
  const sig = _warSignature();
  if (sig === _lastWarSignature) return;
  _lastWarSignature = sig;

  d3svg.select('#war-defs').remove();
  const layer = d3g.select('.war-front-layer');
  if (layer.empty()) return;
  layer.selectAll('*').remove();

  const wars = Object.entries(G.warProgress || {});
  if (!wars.length) return;

  const svgDefs = d3svg.append('defs').attr('id','war-defs');

  wars.forEach(([defCode, wp]) => {
    const prog = Math.max(0, Math.min(100, wp.progress));
    const defFeat = d3countries.find(f => +f.id === +defCode);
    if (!defFeat) return;
    const atkCap = CAPITALS[wp.attacker], defCap = CAPITALS[+defCode];
    if (!atkCap || !defCap) return;

    const [atkX, atkY] = d3proj(atkCap);
    const [defX, defY] = d3proj(defCap);
    const dx = atkX - defX, dy = atkY - defY;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const nx = dx/len, ny = dy/len;
    const px = -ny, py = nx;

    const t = prog / 100;
    const fx = defX + dx * t, fy = defY + dy * t;

    // Half-plane clip: attacker's side of the front line
    const S = 4000;
    const pts = [
      [fx + px*S,        fy + py*S       ],
      [fx - px*S,        fy - py*S       ],
      [fx - px*S + nx*S, fy - py*S + ny*S],
      [fx + px*S + nx*S, fy + py*S + ny*S],
    ].map(p => p.join(',')).join(' ');

    const clipId = `wf-clip-${defCode}`;
    svgDefs.append('clipPath').attr('id', clipId)
      .append('polygon').attr('points', pts);

    // Front-line clip (country shape)
    const lineClipId = `wf-lclip-${defCode}`;
    svgDefs.append('clipPath').attr('id', lineClipId)
      .append('path').attr('d', d3path(defFeat));

    const atkColor = wp.attacker === G.nationCode ? REL_COLORS.player : '#cc0000';

    // Occupied territory — fully opaque so it reads as a genuine separate zone
    if (prog > 2) {
      layer.append('path')
        .datum(defFeat).attr('d', d3path)
        .attr('fill', atkColor).attr('fill-opacity', 0.78)
        .attr('stroke', 'none')
        .attr('clip-path', `url(#${clipId})`)
        .attr('pointer-events', 'none');
    }

    // Front line shadow (depth)
    layer.append('line')
      .attr('x1', fx + px*3000).attr('y1', fy + py*3000)
      .attr('x2', fx - px*3000).attr('y2', fy - py*3000)
      .attr('stroke', '#000').attr('stroke-width', 4)
      .attr('stroke-dasharray', '8,5').attr('opacity', 0.45)
      .attr('clip-path', `url(#${lineClipId})`)
      .attr('pointer-events', 'none');

    // Front line — bold ceasefire/battle line
    layer.append('line')
      .attr('x1', fx + px*3000).attr('y1', fy + py*3000)
      .attr('x2', fx - px*3000).attr('y2', fy - py*3000)
      .attr('stroke', '#ff4444').attr('stroke-width', 2)
      .attr('stroke-dasharray', '8,5').attr('opacity', 1)
      .attr('clip-path', `url(#${lineClipId})`)
      .attr('pointer-events', 'none');

    // ⚔ icon at front centroid
    layer.append('text')
      .attr('x', fx).attr('y', fy)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-size','7px').attr('filter','url(#map-txt-shadow)')
      .attr('opacity', 1).style('pointer-events','none').text('⚔');

    // Zone markers — small icons along the front, one per active zone
    (wp.zones || []).forEach((z, i) => {
      const offset = (i - (wp.zones.length-1)/2) * 9;
      const lx = fx + px*offset, ly = fy + py*offset + 9;
      layer.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-size','6px')
        .attr('filter','url(#map-txt-shadow)')
        .style('pointer-events','none')
        .text('💥');
    });
  });

  d3g.select('.country-borders').raise();
}

let _lastFactionSignature = '';
function updateFactionOverlays() {
  if (!d3svg || !d3g || !d3countries.length) return;

  const fSig = JSON.stringify(G.factions || {});
  if (fSig === _lastFactionSignature) return;
  _lastFactionSignature = fSig;

  d3svg.select('#faction-defs').remove();
  const layer = d3g.select('.faction-overlay-layer');
  if (layer.empty()) return;
  layer.selectAll('*').remove();

  if (!G.factions || !Object.keys(G.factions).length) return;

  const svgDefs = d3svg.append('defs').attr('id','faction-defs');

  Object.entries(G.factions).forEach(([nom, f], i) => {
    const feat = d3countries.find(c => +c.id === f.pays);
    if (!feat) return;
    const pid = `faction-pat-${i}`;
    svgDefs.append('pattern')
      .attr('id', pid).attr('width', 6).attr('height', 6)
      .attr('patternUnits','userSpaceOnUse').attr('patternTransform','rotate(45)')
      .append('rect')
        .attr('width', Math.max(1, f.intensite/3)).attr('height', 6)
        .attr('fill','#e74c3c');

    layer.append('path')
      .datum(feat).attr('d', d3path)
      .attr('fill', `url(#${pid})`).attr('fill-opacity', 0.55)
      .attr('stroke','#e74c3c').attr('stroke-width', 0.6)
      .attr('pointer-events','none');

    const c = d3centroids[f.pays];
    if (c && !isNaN(c[0])) {
      layer.append('text')
        .attr('x', c[0]).attr('y', c[1]+6)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-size','7px')
        .attr('filter','url(#map-txt-shadow)')
        .style('pointer-events','none')
        .text('✊');
    }
  });

  d3g.select('.country-borders').raise();
}

function endWar(defCode, atkCode, attackerWon) {
  const defName = NAMES[defCode] || String(defCode);
  const atkName = NAMES[atkCode] || String(atkCode);
  const isPlayerAtk = atkCode === G.nationCode;
  const isPlayerDef = defCode === G.nationCode;

  // Change relation
  const newRel = attackerWon ? (isPlayerAtk ? 'hostile' : 'hostile') : 'hostile';
  if (G.relations[defCode] === 'war') G.relations[defCode] = newRel;
  if (G.relations[atkCode] === 'war') G.relations[atkCode] = newRel;

  // Update world relations
  const wKey = Math.min(defCode,atkCode)+'-'+Math.max(defCode,atkCode);
  if (G.worldRels[wKey] === 'war') G.worldRels[wKey] = 'hostile';

  // Transfert de propriété provinciale (toutes les provinces du défenseur)
  if (!G.provinceOwnership) G.provinceOwnership = {};
  const defProvinceIds = countryToProvinces[defCode] || [];
  if (attackerWon) {
    defProvinceIds.forEach(pid => { G.provinceOwnership[pid] = atkCode; });
  } else {
    // Défenseur gagne — restaure ses provinces
    defProvinceIds.forEach(pid => { G.provinceOwnership[pid] = defCode; });
  }

  // Clear war progress
  delete G.warProgress[defCode];

  updateColors(); updateWarFronts(); updateCounters();
  triggerMapFX([{codeA: atkCode, codeB: defCode, type: newRel}]);

  // News card
  const titre = attackerWon
    ? `${FLAGS[atkCode]||''} ${atkName} remporte la guerre contre ${defName}`
    : `${FLAGS[defCode]||''} ${defName} repousse l'invasion de ${atkName}`;
  const texte = attackerWon
    ? `Capitulation de ${defName} — ${atkName} contrôle désormais le territoire. Un armistice est imposé.`
    : `L'offensive de ${atkName} est brisée. ${defName} a tenu ses lignes et force un cessez-le-feu.`;
  addWorldEvent({ lieu: defName, titre, texte });
  G.fullHistory.push({ type:'event', cat:'MILITAIRE', titre, texte, date:G.date, turn:G.turn });
  saveGame();
}

function checkWarEnd() {
  if (!G.warProgress) return;
  // Snapshot keys to avoid mutation during iteration
  Object.keys(G.warProgress).forEach(defCode => {
    const wp = G.warProgress[+defCode];
    if (!wp) return;
    if (wp.progress >= 95) endWar(+defCode, wp.attacker, true);
    else if (wp.progress <= 5) endWar(+defCode, wp.attacker, false);
  });
}

function updateColors() {
  if (!d3g) return;
  updateWarFronts();

  // Couche 1 : fond pays — couleur selon relations diplomatiques ou hash stable
  d3g.selectAll('.country-base')
    .attr('fill', d => getCC(+d.id))
    .classed('country-war', d => G.relations[+d.id] === 'war');

  // Couche 2 : provinces occupées
  if (_provinceLayer && G.provinceOwnership) {
    // Déterminer s'il y a des provinces occupées
    let hasOccupied = false;
    _provinceLayer.selectAll('.province')
      .attr('fill', d => {
        const owner = G.provinceOwnership[d._provinceId];
        if (!owner || owner === d._countryCode) return 'none';
        hasOccupied = true;
        return getCC(owner);
      });
    // Si provinces occupées, afficher la couche même hors zoom
    if (hasOccupied && !_provincesVisible) {
      _provinceLayer.attr('display', null);
    }
  }

  updateBordersMesh();
}

function updateCounters() {
  const c = {ally:0, tension:0, hostile:0, war:0};
  Object.values(G.relations).forEach(r => { if (c[r]!==undefined) c[r]++; });
  document.getElementById('cnt-a').textContent = c.ally;
  document.getElementById('cnt-t').textContent = c.tension;
  document.getElementById('cnt-h').textContent = c.hostile;
  document.getElementById('cnt-w').textContent = c.war;
}

function mzoom(f) { if(d3svg) d3svg.transition().duration(300).call(d3zoom.scaleBy,f); }
function mreset() { if(d3svg) d3svg.transition().duration(400).call(d3zoom.transform,d3.zoomIdentity); }

let _mapConvRAF = 0;
function updateMapConvState() {
  if (!d3g) return;
  cancelAnimationFrame(_mapConvRAF);
  _mapConvRAF = requestAnimationFrame(() => {
    const convCodes   = new Set();
    const unreadCodes = new Set();
    for (const c of G.conversations) {
      for (const n of c.nations) {
        if (n.code !== G.nationCode) {
          convCodes.add(n.code);
          if (c.unread) unreadCodes.add(n.code);
        }
      }
    }
    d3g.selectAll('.country-base')
      .classed('country-has-conv', d => convCodes.has(+d.id))
      .classed('country-unread',   d => unreadCodes.has(+d.id));
  });
}

function locateCountry(code) {
  if (!d3svg || !d3g || !d3zoom || !d3path) return;
  // Utilise les features pays (pas provinces) pour le bounding box du zoom
  const feat = d3countries.find(d => +d.id === code);
  if (!feat) return;
  const [[x0,y0],[x1,y1]] = d3path.bounds(feat);
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  const W=+d3svg.attr('width'), H=+d3svg.attr('height');
  const scale = Math.min(6, 0.85 / Math.max((x1-x0)/W, (y1-y0)/H));
  const t = d3.zoomIdentity.translate(W/2,H/2).scale(scale).translate(-cx,-cy);
  d3svg.transition().duration(750).call(d3zoom.transform, t);
}

// ══════════════════════════════════════════
// ── Resources ──
// ══════════════════════════════════════════
function updateResourceBars() {
  const r = G.ressources;
  ['tresorerie','stabilite','puissance'].forEach(k => {
    const v = Math.max(0, Math.min(100, r[k]||0));
    const fill = document.getElementById('rf-'+k);
    const num  = document.getElementById('rn-'+k);
    if (fill) fill.style.width = v + '%';
    if (num)  num.textContent  = v;
  });
}

function applyResourceDelta(delta) {
  if (!delta || !G.modules.ressources) return;
  ['tresorerie','stabilite','puissance'].forEach(k => {
    if (typeof delta[k] === 'number') {
      const d = delta[k];
      G.ressources[k] = Math.max(0, Math.min(100, (G.ressources[k]||50) + d));
      const dEl = document.getElementById('rd-'+k);
      if (dEl && d !== 0) {
        dEl.textContent = (d > 0 ? '+' : '') + d;
        dEl.className = 'res-delta show ' + (d > 0 ? 'pos' : 'neg');
        setTimeout(() => { dEl.classList.remove('show'); }, 4000);
      }
    }
  });
  updateResourceBars();
}

// ══════════════════════════════════════════
// ── Action ──
// ══════════════════════════════════════════
async function submitAction() {
  if (G._gameOver) return;
  const inp = document.getElementById('action-input');
  const action = inp.value.trim();
  if (!action) return;
  document.getElementById('action-err').textContent = '';
  const btn = document.getElementById('btn-exec');
  btn.disabled = true; inp.value = '';
  G.actionHistory.push({ turn: G.turn, action });

  addDecreeToFeed(action);
  const thinkEl = addThinking();
  try {
    const raw = await geminiActionCall(buildActionPrompt(action));
    thinkEl.remove();
    await resolveAction(raw);
  } catch(e) {
    thinkEl.remove();
    displayDebugError(e);
    document.getElementById('action-err').textContent = e.message;
  }
  btn.disabled = false;
}

async function consultStaff() {
  const draft = document.getElementById('action-input').value.trim();
  if (!draft) { document.getElementById('action-err').textContent = 'Rédigez d\'abord votre décret.'; return; }
  const panel = document.getElementById('staff-advice-panel');
  const btn = document.getElementById('btn-consult');
  btn.disabled = true; panel.style.display = 'block';
  panel.innerHTML = '<div class="advice-loading">⏳ Consultation de l\'état-major…</div>';

  const activeMembers = [
    ...(G.staff?.militaires||[]).filter(m=>m.active&&m.name),
    ...(G.staff?.ministres||[]).filter(m=>m.active&&m.name)
  ].slice(0, 4); // max 4 avis

  if (!activeMembers.length) {
    panel.innerHTML = '<div class="advice-empty">Aucun membre actif dans l\'état-major.</div>';
    btn.disabled = false; return;
  }

  const advices = await Promise.all(activeMembers.map(async m => {
    const rels = Object.entries(G.relations).filter(([,r])=>r!=='neutral').slice(0,5)
      .map(([c,r])=>`${NAMES[c]||c}:${REL_LABELS[r]}`).join(', ');
    const sys = `Tu es ${m.name||m.role}, ${m.role} de ${G.nation}. Date : ${G.date}. Relations : ${rels||'stables'}. Donne ton avis personnel et direct sur le décret suivant en 1-2 phrases. Sois concis, opinioné, reste dans ton rôle.`;
    try {
      const resp = await geminiCallFull(sys, [{role:'user',parts:[{text:`Décret proposé : "${draft}"`}]}], 300);
      return { member: m, text: cleanReply(resp) };
    } catch { return { member: m, text: '(indisponible)' }; }
  }));

  panel.innerHTML = advices.map(a =>
    `<div class="advice-item"><span class="advice-icon">${a.member.icon||'👤'}</span><div class="advice-body"><strong>${escHtml(a.member.name||a.member.role)}</strong><p>${escHtml(a.text)}</p></div></div>`
  ).join('') + '<button class="advice-close" onclick="document.getElementById(\'staff-advice-panel\').style.display=\'none\'">✕ Fermer</button>';
  btn.disabled = false;
}

async function skipTurn() {
  if (G._gameOver) return;
  const btn = document.getElementById('btn-skip');
  const execBtn = document.getElementById('btn-exec');
  btn.disabled = true; execBtn.disabled = true;
  const thinkEl = addThinking();
  try {
    const raw = await geminiActionCall(buildActionPrompt('__SKIP__'));
    thinkEl.remove();
    await resolveAction(raw);
  } catch(e) {
    thinkEl.remove();
    displayDebugError(e);
  }
  btn.disabled = false; execBtn.disabled = false;
}

function buildActionPrompt(action) {
  const rels = Object.entries(G.relations)
    .filter(([,r]) => r !== 'neutral')
    .map(([c,r]) => `${NAMES[c]||c}:${r[0]}`)
    .join(',');
  const hist = G.lastResume
    ? `T${G.turn-1}:${G.lastResume}`
    : (G.actionHistory.slice(-2).map(h=>`T${h.turn}:${h.action.slice(0,60)}`).join('|'));
  const RCODE = {ally:'a',tension:'t',hostile:'h',war:'w',neutral:'n'};
  const world = Object.entries(G.worldRels).slice(0,8)
    .map(([k,r])=>{ const [a,b]=k.split('-').map(Number); return `${NAMES[a]?.split(' ')[0]?.slice(0,4)||a}-${NAMES[b]?.split(' ')[0]?.slice(0,4)||b}:${RCODE[r]||'n'}`; })
    .join(',');

  // Difficulty tone
  const diffTones = {
    civil:     'IA COOPÉRATIVE : les nations privilégient la diplomatie et évitent les conflits.',
    diplomate: 'IA STANDARD : comportement diplomatique équilibré.',
    stratege:  'IA STRATÉGIQUE : les nations sont opportunistes, exploitent les faiblesses et forment des alliances calculées.',
    hardcore:  'IA AGRESSIVE : les nations cherchent l\'hégémonie, réagissent brutalement, crises fréquentes.'
  };
  const diffLine = diffTones[G.difficulty] || diffTones.diplomate;

  // Module-specific rules
  let moduleRules = '';
  if (G.modules.ressources)   moduleRules += ';RESSOURCES:retourne impact_ressources={tresorerie:entier-20à+20,stabilite:entier-15à+15,puissance:entier-10à+10}';
  if (G.modules.opinion)      moduleRules += ';OPINION:retourne opinion_publique={score:0-100,commentaire:"réaction du peuple en 1 phrase"}';
  if (G.modules.crises)       moduleRules += ';CRISES:si pertinent retourne evenement_crise={titre,effet,impact}(pandémie/krach/catastrophe)';
  if (G.modules.geopolitique) moduleRules += ';GÉOPOL:0-2 evolutions_mondiales si l\'action influence des relations entre pays tiers';

  const schema = '{"nouvelle_date":"Mois AAAA","resume_action":"10 mots max","evenements":[{"categorie":"DIPLOMATIQUE|MILITAIRE|ÉCONOMIQUE|POLITIQUE|HUMANITAIRE","titre":"...","texte":"2 phrases."}],"contacts_entrants":[{"code":840,"sujet":"...","message":"2 phrases."}],"conversations_auto":[{"codes":[643,156],"sujet":"...","message":"1 phrase précise."}],"relations_modifiees":[{"code":840,"statut":"ally|tension|hostile|war|neutral"}],"evolutions_mondiales":[{"paysA":840,"paysB":156,"nouveau_statut":"war","raison_courte":"1 phrase."}]}';

  // Faction context
  const factCtx = Object.entries(G.factions||{}).map(([nom,f])=>`${nom}(${NAMES[f.pays]||f.pays},intensité:${f.intensite}/10)`).join(';');

  // Inject war state so Gemini knows near-defeat situations
  const warCtx = Object.entries(G.warProgress||{}).map(([def,wp]) => {
    const prog = wp.progress;
    const status = prog >= 80 ? `QUASI-DÉFAITE(${prog}%)-négociation/capitulation imminente`
                : prog <= 20 ? `RÉSISTANCE(${prog}%)-attaquant épuisé`
                : `front(${prog}%)`;
    return `${NAMES[wp.attacker]||wp.attacker}→${NAMES[+def]||def}:${status}`;
  }).join(';');

  const scenCtx = G.scenarioContext ? `SCÉNARIO:"${G.scenarioContext.slice(0,200)}" ` : '';
  // Tous les 3 tours : monde actif — forcer des événements autonomes entre nations tierces
  const worldBoost = (G.turn % 3 === 0)
    ? '\nTOUR MONDE ACTIF : génère 2-3 evolutions_mondiales significatives entre nations tierces (élections, coups d\'État, traités, crises économiques, révolutions) indépendantes de l\'action du joueur.'
    : '';
  const isAutonomousTurn = action === '__SKIP__' || action === '__WORLD_EVENT__';
  const actionLine = isAutonomousTurn
    ? `Le joueur ne fait rien ce tour. Le monde continue d'évoluer sans intervention de ${G.nation}. Génère des événements mondiaux autonomes riches : élections dans des pays tiers, coups d'État, traités signés entre nations sans le joueur, crises économiques locales, mouvements populaires. Aucun contact entrant ciblant le joueur, aucune modification de ses relations sauf si un événement externe l'impose logiquement.`
    : `Action du joueur:"${action}"`;
  return `ORBIS géopol 2025. ${scenCtx}Joueur:${G.nation}|Style:${G.style}|Date:${G.date}|Tour:${G.turn}
${diffLine}
Rels(${rels||'aucune'}) Hist:${hist||'-'}
Monde(${world||'stable'})${warCtx?`\nGuerres:${warCtx}`:''}${factCtx?`\nInsurrections:${factCtx}`:''}
${actionLine}${worldBoost}
JSON STRICT uniquement (pas de texte), schéma:${schema}
RÈGLES ABSOLUES:
- Les événements décrivent UNIQUEMENT les réactions des autres nations et les conséquences mondiales de l'action du joueur. NE JAMAIS décrire ${G.nation} comme prenant des initiatives non spécifiées par le joueur.
- relations_modifiees = comment les autres nations réagissent envers ${G.nation} (leur perception), jamais une décision prise à la place du joueur.
- 3-5 événements variés;0-2 contacts_entrants;0-1 conv_auto;date+3à6mois;resume_action=résumé 10 mots
- evolutions_guerre:retourne 1 entrée par conflit actif. delta entre -20 et +20 (positif=attaquant avance). zone=nom précis de la ville ou région concernée (ex:"Donetsk","Oblast de Kharkiv","Crimée"). Si >=80% la nation vaincue négocie ou capitule. Si <=20% l'attaquant recule.
- nouvelles_factions:si des insurrections/rébellions émergent naturellement (guerre civile, séparatisme, révolution) ajoute 0-1 faction avec pays_hote=code ISO, nom=nom du mouvement, intensite=1-10. factions_terminees:liste des noms de factions résolues ce tour.
- evenements_mondiaux:OBLIGATOIRE 1-2 faits divers réalistes totalement indépendants de l'action du joueur (catastrophes naturelles, faits divers criminels, accidents, records économiques, scandales sportifs, pandémies locales, incidents sociaux, krachs boursiers, découvertes scientifiques…). Lieu précis, titre accrocheur, 2 phrases.${moduleRules}`;
}


async function resolveAction(raw) {
  const data = parseActionJson(raw); // throws GeminiError('JSON') if all strategies fail

  const newDate    = data.nouvelle_date || G.date;
  const events     = Array.isArray(data.evenements)         ? data.evenements         : [];
  const contacts   = Array.isArray(data.contacts_entrants)  ? data.contacts_entrants  : [];
  const autoConvs  = Array.isArray(data.conversations_auto) ? data.conversations_auto : [];
  const relChanges = Array.isArray(data.relations_modifiees)? data.relations_modifiees: [];

  // Collecte données pour le bilan de fin de tour
  const _bilan = { relChanges: [], resDelta: null, opinion: null, crisis: null };

  if (data.resume_action) G.lastResume = String(data.resume_action).slice(0, 80);

  addJumpSep(newDate);
  G.date = newDate;
  document.getElementById('hdr-date').textContent = G.date;

  for (const ev of events) {
    await sleep(380);
    addNewsEvent(ev);
    // Show contextual map icon based on event category and referenced countries
    const CAT_ICON = { MILITAIRE:'💥', DIPLOMATIQUE:'🤝', ÉCONOMIQUE:'📈', POLITIQUE:'⚡', HUMANITAIRE:'🆘', SOCIAL:'🏛', SCIENTIFIQUE:'🔬', ENVIRONNEMENT:'🌿', CULTUREL:'🎭', DIVERS:'📌' };
    const fullText = ev.titre + ev.texte;
    const keywordIcon = /congrès|sommet|accord|traité|forum|réunion|assemblée/i.test(fullText) ? '🏛'
                      : /catastrophe|séisme|inondation|ouragan|tremblement/i.test(fullText) ? '🌪'
                      : /élection|vote|référendum/i.test(fullText) ? '🗳'
                      : /scandale|corruption|arrestation/i.test(fullText) ? '⚠'
                      : /découverte|scientifique|recherche/i.test(fullText) ? '🔬'
                      : null;
    const icon = keywordIcon || CAT_ICON[ev.categorie];
    if (icon) {
      // Find country codes mentioned in event text
      Object.entries(NAMES).forEach(([code, name]) => {
        if (fullText.includes(name)) showMapIcon(+code, icon);
      });
    }
  }

  // Relations joueur
  const VALID_STATS = new Set(['ally','tension','hostile','war','neutral']);
  const fxChanges = [];
  checkRelationAlerts(relChanges, { ...G.relations });
  relChanges.forEach(r => {
    if (r.code && NAMES[r.code] && VALID_STATS.has(r.statut)) {
      const prev = G.relations[r.code];
      G.relations[r.code] = r.statut;
      if (r.statut !== 'neutral') _bilan.relChanges.push({ code: r.code, prev, next: r.statut });
      fxChanges.push({ codeA: G.nationCode, codeB: r.code, type: r.statut });
      // Init war progress when war starts
      if (!G.warProgress) G.warProgress = {};
      if (r.statut === 'war' && prev !== 'war') {
        G.warProgress[r.code] = { attacker: G.nationCode, progress: 50 };
      } else if (r.statut !== 'war') {
        delete G.warProgress[r.code];
      }
    }
  });
  if (fxChanges.length) setTimeout(() => triggerMapFX(fxChanges), 600);

  // Évolutions mondiales
  if (G.modules.geopolitique) {
    const MAJOR = new Set([840,156,643,250,276,826,356,76,392,792,364,682,804]);
    const worldEvos = Array.isArray(data.evolutions_mondiales) ? data.evolutions_mondiales : [];
    worldEvos.forEach(e => {
      const a=+e.paysA, b=+e.paysB;
      if (!NAMES[a]||!NAMES[b]||!VALID_STATS.has(e.nouveau_statut)) return;
      const key = a<b ? `${a}-${b}` : `${b}-${a}`;
      const oldStat = G.worldRels[key];
      G.worldRels[key] = e.nouveau_statut;
      if (MAJOR.has(a) && MAJOR.has(b) && e.nouveau_statut !== oldStat) {
        addBreakingNews(a, b, e.nouveau_statut, e.raison_courte||'');
        setTimeout(() => triggerMapFX([{codeA:a, codeB:b, type:e.nouveau_statut}]), 1200);
        if (e.nouveau_statut === 'war' && oldStat !== 'war') {
          G.warProgress[b] = { attacker: a, progress: 50 };
        } else if (e.nouveau_statut !== 'war') {
          delete G.warProgress[b]; delete G.warProgress[a];
        }
      }
    });
  }

  // Évolutions de guerre (progression des fronts)
  if (!G.warProgress) G.warProgress = {};
  if (Array.isArray(data.evolutions_guerre)) {
    for (const ev of data.evolutions_guerre) {
      const atk = +ev.attaquant, def = +ev.defenseur;
      if (!NAMES[atk] || !NAMES[def]) continue;
      const d = Math.max(-25, Math.min(25, +ev.delta || 0));
      if (!G.warProgress[def]) G.warProgress[def] = { attacker: atk, progress: 50, zones: [] };
      if (!G.warProgress[def].zones) G.warProgress[def].zones = [];
      G.warProgress[def].progress = Math.max(0, Math.min(100, G.warProgress[def].progress + d));

      // Transfert progressif de provinces selon la direction de l'avancée
      if (d3provinces.length && G.provinceOwnership) {
        if (d > 0) {
          // L'attaquant avance : transférer aléatoirement quelques provinces du défenseur
          const available = (countryToProvinces[def] || []).filter(pid =>
            (G.provinceOwnership[pid] ?? def) === def
          );
          const n = Math.max(1, Math.round(available.length * Math.abs(d) / 150));
          for (let t = 0; t < n && available.length; t++) {
            const idx = Math.floor(Math.random() * available.length);
            G.provinceOwnership[available.splice(idx, 1)[0]] = atk;
          }
        } else if (d < 0) {
          // Le défenseur recule : récupérer quelques provinces occupées
          const occupied = (countryToProvinces[def] || []).filter(pid =>
            G.provinceOwnership[pid] === atk
          );
          const n = Math.max(1, Math.round(occupied.length * Math.abs(d) / 150));
          for (let t = 0; t < n && occupied.length; t++) {
            const idx = Math.floor(Math.random() * occupied.length);
            G.provinceOwnership[occupied.splice(idx, 1)[0]] = def;
          }
        }
      }

      // Track named zones (cities/regions captured/contested)
      if (ev.zone && ev.zone.trim()) {
        const z = ev.zone.trim();
        if (d > 0) {
          if (!G.warProgress[def].zones.includes(z)) G.warProgress[def].zones.push(z);
        } else if (d < 0) {
          G.warProgress[def].zones = G.warProgress[def].zones.filter(x => x !== z);
        }
        if (G.warProgress[def].zones.length > 6) G.warProgress[def].zones.shift();
      }
      const prog = G.warProgress[def].progress;
      const atkName = NAMES[atk]||String(atk), defName = NAMES[def]||String(def);
      const label = prog > 65 ? `${atkName} avance` : prog < 35 ? `${defName} résiste` : 'Front stabilisé';
      const zoneLabel = ev.zone ? ` — <strong>${escHtml(ev.zone)}</strong>` : '';
      await sleep(220);
      const el = document.createElement('div');
      el.className = 'ne cat-mil';
      el.innerHTML = `
        <div class="ne-top"><span class="ne-cat cat-mil">⚔ FRONT DE GUERRE</span><span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span></div>
        <div class="ne-title">${FLAGS[atk]||''} ${escHtml(atkName)} vs ${FLAGS[def]||''} ${escHtml(defName)} — ${escHtml(label)}${zoneLabel}</div>
        <div class="ne-body">${escHtml(ev.raison_courte||'')} <em style="color:var(--text3)"> · Contrôle : ${prog}%</em></div>`;
      const feed = document.getElementById('news-feed');
      if (feed) { feed.appendChild(el); feed.scrollTop = feed.scrollHeight; }
    }
    updateWarFronts();
    checkWarEnd();
  }

  // Factions / insurrections
  if (!G.factions) G.factions = {};
  if (Array.isArray(data.nouvelles_factions)) {
    data.nouvelles_factions.forEach(f => {
      if (!f.nom || !NAMES[f.pays_hote]) return;
      G.factions[f.nom] = { pays: +f.pays_hote, intensite: Math.max(1, Math.min(10, +f.intensite||5)) };
      const titre = `✊ Insurrection : ${f.nom}`;
      const texte = `Un mouvement armé émerge en ${NAMES[f.pays_hote]}. Intensité : ${f.intensite}/10.`;
      addWorldEvent({ lieu: NAMES[f.pays_hote], titre, texte });
      showMapIcon(+f.pays_hote, '✊');
    });
  }
  if (Array.isArray(data.factions_terminees)) {
    data.factions_terminees.forEach(nom => { delete G.factions[nom]; });
  }
  if (Object.keys(G.factions).length) updateFactionOverlays();

  updateColors(); updateCounters();

  // Ressources
  if (G.modules.ressources && data.impact_ressources) {
    applyResourceDelta(data.impact_ressources);
    _bilan.resDelta = data.impact_ressources;
  }

  // Opinion publique
  if (G.modules.opinion && data.opinion_publique) {
    const op = data.opinion_publique;
    const score = Math.max(0, Math.min(100, +op.score||50));
    const prevOpinion = G.opinionScore;
    G.opinionScore = score;
    _bilan.opinion = { score, commentaire: data.opinion_publique.commentaire || '' };
    if (score < 20 && prevOpinion >= 20) {
      showAlertToast('😠', 'Popularité critique !', `Indice d'opinion à ${score}/100 — risque de révolte imminente.`, 'danger');
    } else if (score < 20) {
      showAlertToast('😠', `Popularité dangereuse : ${score}/100`, 'Le mécontentement populaire atteint un niveau critique.', 'danger');
    }
    const scoreIcon = score >= 70 ? '😊' : score >= 40 ? '😐' : '😠';
    await sleep(300);
    const el = document.createElement('div');
    el.className = 'ne cat-opinion';
    el.innerHTML = `
      <div class="ne-top">
        <span class="ne-cat cat-opinion">OPINION PUBLIQUE</span>
        <span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span>
      </div>
      <div class="ne-title">${scoreIcon} Indice de popularité : ${score}/100</div>
      <div class="ne-body">${escHtml(op.commentaire||'')}</div>
    `;
    const feed = document.getElementById('news-feed');
    feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
    G.fullHistory.push({ type:'event', cat:'OPINION', titre:`${scoreIcon} Popularité : ${score}/100`, texte: op.commentaire||'', date:G.date, turn:G.turn });
    if (G.fullHistory.length > 50) G.fullHistory.shift();
  }

  // Événement de crise
  if (G.modules.crises && data.evenement_crise) {
    const cr = data.evenement_crise;
    if (cr.titre) {
      _bilan.crisis = cr;
      await sleep(400);
      const el = document.createElement('div');
      el.className = 'ne cat-breaking';
      el.innerHTML = `
        <div class="ne-top">
          <span class="ne-cat cat-breaking">⚡ CRISE MONDIALE</span>
          <span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span>
        </div>
        <div class="ne-title">${escHtml(cr.titre)}</div>
        <div class="ne-body">${escHtml(cr.effet||'')}${cr.impact ? ' <em>Impact : ' + escHtml(cr.impact) + '</em>' : ''}</div>
      `;
      const feed = document.getElementById('news-feed');
      feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
      G.fullHistory.push({ type:'breaking', titre: escHtml(cr.titre), raison: cr.effet||'', date:G.date, turn:G.turn });
      if (G.fullHistory.length > 50) G.fullHistory.shift();
    }
  }

  // Contacts entrants — regroupés si même sujet ou si alliés naturels
  await sleep(500);
  const validContacts = contacts.filter(c => c.code && NAMES[+c.code]).map(c => ({ ...c, code: +c.code }));
  if (validContacts.length >= 2) {
    // Tenter de regrouper les contacts liés (même sujet racine, ou bloc naturel)
    const grouped = groupIncomingContacts(validContacts);
    for (const grp of grouped) {
      await sleep(350);
      if (grp.length === 1) {
        handleIncomingContact(grp[0]);
      } else {
        handleGroupedIncomingContacts(grp);
      }
    }
  } else {
    for (const c of validContacts) {
      await sleep(350);
      handleIncomingContact(c);
    }
  }

  // Auto-conversations (renseignement)
  for (const ac of autoConvs) {
    if (!Array.isArray(ac.codes) || ac.codes.length < 2) continue;
    ac.codes = ac.codes.map(Number);
    const n1=NAMES[ac.codes[0]], n2=NAMES[ac.codes[1]];
    if (!n1||!n2) continue;
    const f1=FLAGS[ac.codes[0]]||'🌐', f2=FLAGS[ac.codes[1]]||'🌐';
    await sleep(300);
    addIntelEvent(f1,n1,f2,n2,ac.sujet||'Contact diplomatique',ac.message||'');
  }

  // Événements mondiaux autonomes
  const mondiaux = Array.isArray(data.evenements_mondiaux) ? data.evenements_mondiaux : [];
  for (const ev of mondiaux) {
    if (!ev.titre) continue;
    await sleep(420);
    addWorldEvent(ev);
  }

  // Enregistrer le snapshot de tendances
  if (!G.trendsHistory) G.trendsHistory = [];
  G.trendsHistory.push({
    turn: G.turn, date: G.date,
    tresorerie: G.ressources.tresorerie, stabilite: G.ressources.stabilite,
    puissance: G.ressources.puissance, opinion: G.opinionScore
  });
  if (G.trendsHistory.length > 30) G.trendsHistory.shift();

  G.turn++;
  document.getElementById('hdr-turn').textContent = G.turn;
  checkTreatiesExpiry();
  saveGame();
  showBilan(_bilan, G.turn - 1, newDate);
  await checkEndConditions();
}

// ══════════════════════════════════════════
// ── End conditions (victory / defeat) ──
// ══════════════════════════════════════════
const END_TEXTS = {
  hegemonie:      { title: '🌐 HÉGÉMONIE MONDIALE',    sub: 'Vous dominez l\'ordre mondial' },
  domination_eco: { title: '💰 PUISSANCE ÉCONOMIQUE',  sub: 'Vous contrôlez l\'économie mondiale' },
  survie:         { title: '🛡 SURVIE',                sub: 'Vous avez traversé 25 ans de crises mondiales' }
};

async function checkEndConditions() {
  if (G._gameOver) return;
  let reason = null;

  // === VICTOIRES UNIQUEMENT ===
  const relVals = Object.values(G.relations);
  const allyCount    = relVals.filter(r => r === 'ally').length;
  const hostileCount = relVals.filter(r => r === 'hostile' || r === 'war').length;
  if (allyCount >= 10 && hostileCount === 0 && G.turn >= 15) reason = 'hegemonie';

  if (!reason && G.modules.ressources) {
    if (G.ressources.tresorerie >= 90) {
      G.highTreasuryTurns = (G.highTreasuryTurns || 0) + 1;
      if (G.highTreasuryTurns >= 3) reason = 'domination_eco';
    } else {
      G.highTreasuryTurns = 0;
    }
  }
  if (!reason && G.turn >= 26) reason = 'survie';

  if (reason) await triggerEnd(true, reason);
}

async function triggerEnd(_isVictory, reason) {
  G._gameOver = true;
  const info = END_TEXTS[reason] || END_TEXTS.survie;
  const ov   = document.getElementById('gameover-ov');
  ov.className        = 'victory';
  ov.style.display    = 'flex';
  document.getElementById('go-title').textContent    = info.title;
  document.getElementById('go-subtitle').textContent = info.sub;
  document.getElementById('go-narrative').textContent = 'Génération du bilan historique…';

  const relVals  = Object.values(G.relations);
  const allyC    = relVals.filter(r => r === 'ally').length;
  const warC     = relVals.filter(r => r === 'war').length;
  const hostC    = relVals.filter(r => r === 'hostile').length;
  const statsHtml = [
    `<div class="go-stat"><span>Tours</span><strong>${G.turn - 1}</strong></div>`,
    `<div class="go-stat"><span>Date finale</span><strong>${G.date}</strong></div>`,
    `<div class="go-stat"><span>Alliés</span><strong>${allyC}</strong></div>`,
    `<div class="go-stat"><span>Hostiles</span><strong>${hostC}</strong></div>`,
    `<div class="go-stat"><span>Guerres</span><strong>${warC}</strong></div>`,
    G.modules.ressources ? `<div class="go-stat"><span>Trésorerie</span><strong>${G.ressources.tresorerie}</strong></div>
    <div class="go-stat"><span>Stabilité</span><strong>${G.ressources.stabilite}</strong></div>
    <div class="go-stat"><span>Puissance</span><strong>${G.ressources.puissance}</strong></div>` : ''
  ].join('');
  document.getElementById('go-stats').innerHTML = statsHtml;

  document.getElementById('btn-exec').disabled   = true;
  document.getElementById('btn-skip').disabled   = true;
  document.getElementById('action-input').disabled = true;
  saveGame();

  try {
    const REASON_FR = {
      banqueroute:'banqueroute économique', coup_etat:'coup d\'État militaire',
      defaite_militaire:'défaite militaire face à l\'occupant', revolution:'révolution populaire',
      hegemonie:'hégémonie diplomatique mondiale', domination_eco:'domination économique mondiale',
      survie:'survie politique sur 25 ans de crises'
    };
    const decrees = G.fullHistory.filter(h => h.type === 'decree').slice(-5)
      .map(h => `Tour ${h.turn}: ${h.texte.slice(0, 100)}`).join('\n');
    const sys = 'Tu es un historien. Rédige un épitaphe dramatique et factuel de 3-4 phrases sur ce règne, style livre d\'histoire. En français.';
    const user = `Nation: ${G.nation}. Fin de règne: ${REASON_FR[reason]||reason}. Durée: ${G.turn-1} tours (date finale: ${G.date}).\nDernières décisions:\n${decrees||'Aucun décret enregistré.'}`;
    const text = await geminiCallFull(sys, [{ role:'user', parts:[{ text: user }] }], 400);
    document.getElementById('go-narrative').textContent = cleanReply(text);
  } catch {
    document.getElementById('go-narrative').textContent =
      `${G.nation} a terminé son règne en ${G.date} après ${G.turn-1} tours. ${info.sub}.`;
  }
}

// ══════════════════════════════════════════
// ── Module Renseignement actif ──
// ══════════════════════════════════════════
const INTEL_TIERS = [
  { id: 1, label: 'Tier 1 — Intentions', desc: 'Orientations politiques générales', cost: { tresorerie: -5,  stabilite: 0,  puissance: 0 }, scandalRisk: 0.1 },
  { id: 2, label: 'Tier 2 — Plans militaires', desc: 'Mouvements de troupes, alliances secrètes', cost: { tresorerie: -12, stabilite: -5, puissance: 0 }, scandalRisk: 0.25 },
  { id: 3, label: 'Tier 3 — Corruption interne', desc: 'Corruption, opposants, vulnérabilités', cost: { tresorerie: -20, stabilite: -10, puissance: 0 }, scandalRisk: 0.45 }
];

function openIntelModal() {
  if (!G.modules.renseignement) return;
  // Fill target select
  const sel = document.getElementById('intel-target');
  if (!sel) return;
  sel.innerHTML = Object.entries(NAMES)
    .filter(([c]) => +c !== G.nationCode)
    .sort((a,b) => a[1].localeCompare(b[1]))
    .map(([c, n]) => `<option value="${c}">${FLAGS[+c]||'🌐'} ${escHtml(n)}</option>`)
    .join('');
  // Fill tiers
  const tiersEl = document.getElementById('intel-tiers');
  if (tiersEl) {
    tiersEl.innerHTML = INTEL_TIERS.map(t => `
      <label style="display:flex;align-items:flex-start;gap:0.5rem;cursor:pointer;padding:0.4rem;background:var(--s2);border:1px solid var(--border);border-radius:3px">
        <input type="radio" name="intel-tier" value="${t.id}" ${t.id===1?'checked':''} style="margin-top:2px">
        <div>
          <div style="font-size:0.72rem;color:var(--text);font-weight:600">${escHtml(t.label)}</div>
          <div style="font-size:0.65rem;color:var(--text2)">${escHtml(t.desc)}</div>
          <div style="font-size:0.6rem;color:var(--text3);margin-top:0.1rem">Coût : 💰${Math.abs(t.cost.tresorerie)}${t.cost.stabilite ? ' 🏛'+Math.abs(t.cost.stabilite) : ''} · Risque scandale : ${Math.round(t.scandalRisk*100)}%</div>
        </div>
      </label>`).join('');
  }
  document.getElementById('intel-err').textContent = '';
  document.getElementById('intel-modal-ov').classList.add('on');
}

function closeIntelModal() {
  document.getElementById('intel-modal-ov').classList.remove('on');
}

async function launchIntelOp() {
  const targetCode = +document.getElementById('intel-target').value;
  const tierId = +document.querySelector('input[name="intel-tier"]:checked')?.value || 1;
  const tier = INTEL_TIERS.find(t => t.id === tierId);
  if (!tier) return;
  const targetName = NAMES[targetCode];
  if (!targetName) return;

  // Check resources
  if (G.modules.ressources) {
    if (G.ressources.tresorerie + tier.cost.tresorerie < 0) {
      document.getElementById('intel-err').textContent = 'Trésorerie insuffisante pour cette opération.';
      return;
    }
  }

  const btn = document.getElementById('intel-confirm-btn');
  btn.disabled = true; btn.textContent = '⏳ Opération en cours…';

  // Apply cost
  if (G.modules.ressources) applyResourceDelta(tier.cost);

  // Scandal risk
  const isScandal = Math.random() < tier.scandalRisk;

  try {
    const rel = G.relations[targetCode];
    const archetype = LEADER_ARCHETYPES[targetCode];
    const wr = Object.entries(G.worldRels)
      .filter(([k]) => k.includes(String(targetCode)))
      .map(([k,v]) => { const [a,b]=k.split('-'); const other=+a===targetCode?+b:+a; return `${NAMES[other]||other}:${v}`; }).join(',');
    const sys = `Tu es un analyste du renseignement. Fournis un rapport d'opération d'espionnage de niveau ${tier.id} sur ${targetName}. ${isScandal ? 'ATTENTION : l\'opération a été compromise — fournis des infos partielles et mentionne le risque d\'incident diplomatique.' : ''} Réponds en français, style rapport classifié, 3-4 phrases.`;
    const user = `Cible: ${FLAGS[targetCode]||''} ${targetName}. Relation actuelle: ${REL_LABELS[rel]||'Neutre'}. Archétype dirigeant: ${archetype?.type||'Inconnu'} (${archetype?.trait||''}). Relations clés de la cible: ${wr||'aucune'}. Niveau de l'opération: ${tier.label}. Tour: ${G.turn}, Date: ${G.date}.`;
    const raw = await geminiCallFull(sys, [{ role:'user', parts:[{ text:user }] }], 500);
    const report = cleanReply(raw);

    // Display in news feed
    const el = document.createElement('div');
    el.className = 'ne cat-intel';
    el.innerHTML = `
      <div class="ne-top">
        <span class="ne-cat cat-intel">🕵 RENSEIGNEMENT ${isScandal ? '⚠ COMPROMIS' : 'CLASSIFIÉ'}</span>
        <span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span>
      </div>
      <div class="ne-title">${FLAGS[targetCode]||'🌐'} ${escHtml(targetName)} — ${tier.label}</div>
      <div class="ne-intel-leak">${escHtml(report)}</div>
      ${isScandal ? `<div style="color:#f59e0b;font-size:0.65rem;margin-top:0.3rem">⚠ L'opération a été partiellement découverte — risque d'incident diplomatique.</div>` : ''}
    `;
    const feed = document.getElementById('news-feed');
    if (feed) { feed.appendChild(el); feed.scrollTop = feed.scrollHeight; }
    G.fullHistory.push({ type:'intel', f1:FLAGS[G.nationCode]||'🌐', n1:G.nation, f2:FLAGS[targetCode]||'🌐', n2:targetName, sujet:tier.label, message:report, date:G.date, turn:G.turn });
    if (isScandal) {
      showAlertToast('⚠', 'Opération compromise !', `L'espionnage de ${targetName} a été partiellement découvert.`, 'danger');
      // Degrade relation slightly
      if (rel === 'ally') G.relations[targetCode] = 'tension';
      else if (rel === 'neutral' || !rel) G.relations[targetCode] = 'tension';
      updateColors(); updateCounters();
    }
    saveGame();
  } catch(e) {
    document.getElementById('intel-err').textContent = 'Erreur : ' + e.message;
  }
  btn.disabled = false; btn.textContent = 'Lancer l\'opération';
  closeIntelModal();
}

// ══════════════════════════════════════════
// ── Traités formels ──
// ══════════════════════════════════════════
const TREATY_LABELS = {
  non_agression:         '📜 Non-Agression',
  commercial:            '💹 Commercial',
  alliance_defensive:    '🛡 Alliance Défensive',
  cooperation_militaire: '⚔ Coopération Militaire',
  aide_humanitaire:      '🤝 Aide Humanitaire'
};

let _treatyTargetConvId = null;

function openTreatyModal(convId) {
  _treatyTargetConvId = convId;
  document.getElementById('treaty-modal-ov').classList.add('on');
}
function closeTreatyModal() {
  document.getElementById('treaty-modal-ov').classList.remove('on');
  _treatyTargetConvId = null;
}

function signTreaty() {
  const conv = _treatyTargetConvId !== null ? G.conversations.find(c => c.id === _treatyTargetConvId) : null;
  const type     = document.getElementById('treaty-type').value;
  const clauses  = document.getElementById('treaty-clauses').value.trim();
  const duration = parseInt(document.getElementById('treaty-duration').value, 10);
  const parties  = conv ? conv.nations.filter(n => n.code !== G.nationCode) : [];
  if (!parties.length && !conv) { closeTreatyModal(); return; }

  const treaty = {
    id: Date.now(),
    type,
    label: TREATY_LABELS[type] || type,
    parties: conv ? conv.nations.map(n => ({ code: n.code, name: n.name })) : [{ code: G.nationCode, name: G.nation }],
    clauses: clauses || null,
    signedTurn: G.turn,
    signedDate: G.date,
    expiresOnTurn: duration > 0 ? G.turn + duration : 0,
    active: true
  };

  if (!G.treaties) G.treaties = [];
  G.treaties.push(treaty);

  // Add news event
  const partiesStr = parties.map(p => (FLAGS[p.code]||'🌐')+' '+p.name).join(', ') || G.nation;
  const el = document.createElement('div');
  el.className = 'ne cat-diplo';
  el.innerHTML = `
    <div class="ne-top"><span class="ne-cat cat-diplo">TRAITÉ SIGNÉ</span><span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span></div>
    <div class="ne-title">${treaty.label} — ${escHtml(partiesStr)}</div>
    ${clauses ? `<div class="ne-body">${escHtml(clauses)}</div>` : ''}
    <div class="ne-body" style="color:var(--text3)">Expire dans : ${duration > 0 ? duration + ' tours' : 'durée indéterminée'}</div>
  `;
  const feed = document.getElementById('news-feed');
  if (feed) { feed.appendChild(el); feed.scrollTop = feed.scrollHeight; }
  G.fullHistory.push({ type:'event', cat:'DIPLOMATIQUE', titre:`${treaty.label} signé avec ${partiesStr}`, texte:clauses||'', date:G.date, turn:G.turn });

  updateTreatiesCount();
  saveGame();
  closeTreatyModal();
  renderTreatiesPanel();
}

function breachTreaty(id) {
  if (!confirm('Violer ce traité ? Cela aura des conséquences diplomatiques.')) return;
  const treaty = G.treaties?.find(t => t.id === id);
  if (!treaty) return;
  treaty.active = false;
  const parties = treaty.parties.filter(p => p.code !== G.nationCode);
  parties.forEach(p => {
    if (G.relations[p.code] === 'ally') G.relations[p.code] = 'tension';
    else if (G.relations[p.code] === 'tension') G.relations[p.code] = 'hostile';
  });
  updateColors(); updateCounters();
  const partiesStr = parties.map(p => (FLAGS[p.code]||'🌐')+' '+p.name).join(', ');
  showAlertToast('⚠', 'Traité violé', `${escHtml(partiesStr)} réagit à la violation du ${treaty.label}.`, 'danger');
  const el = document.createElement('div');
  el.className = 'ne cat-breaking';
  el.innerHTML = `
    <div class="ne-top"><span class="ne-cat cat-breaking">⚠ TRAITÉ VIOLÉ</span><span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span></div>
    <div class="ne-title">${treaty.label} — ${escHtml(partiesStr)}</div>
    <div class="ne-body">La violation unilatérale de cet accord entraîne une dégradation des relations.</div>
  `;
  const feed = document.getElementById('news-feed');
  if (feed) { feed.appendChild(el); feed.scrollTop = feed.scrollHeight; }
  saveGame();
  renderTreatiesPanel();
}

function checkTreatiesExpiry() {
  if (!G.treaties?.length) return;
  G.treaties.forEach(t => {
    if (!t.active || t.expiresOnTurn === 0) return;
    if (G.turn >= t.expiresOnTurn) {
      t.active = false;
      const parties = t.parties.filter(p => p.code !== G.nationCode).map(p => p.name).join(', ');
      showAlertToast('📜', 'Traité expiré', `${t.label} avec ${parties} est arrivé à expiration.`, 'warn');
    }
  });
  updateTreatiesCount();
}

function updateTreatiesCount() {
  const active = G.treaties?.filter(t => t.active).length || 0;
  const countEl = document.getElementById('treaties-count');
  if (!countEl) return;
  if (active > 0) { countEl.textContent = active; countEl.style.display = 'inline'; }
  else countEl.style.display = 'none';
}

function showTreatiesPanel() {
  const panel = document.getElementById('treaties-panel');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderTreatiesPanel();
}
function hideTreatiesPanel() {
  document.getElementById('treaties-panel')?.classList.remove('open');
}

function renderTreatiesPanel() {
  const content = document.getElementById('treaties-content');
  if (!content) return;
  const treaties = G.treaties || [];
  if (!treaties.length) {
    content.innerHTML = '<div class="treaties-empty">Aucun traité formel signé.<br>Utilisez ⚖ Conclure dans une conversation pour en signer un.</div>';
    return;
  }
  const active   = treaties.filter(t => t.active);
  const inactive = treaties.filter(t => !t.active);
  let html = '';
  [...active, ...inactive].forEach(t => {
    const parties = t.parties.filter(p => p.code !== G.nationCode).map(p => (FLAGS[p.code]||'🌐')+' '+p.name).join(', ');
    const turnsLeft = t.expiresOnTurn > 0 ? t.expiresOnTurn - G.turn : null;
    const soonCls = turnsLeft !== null && turnsLeft <= 3 ? ' soon' : '';
    html += `<div class="treaty-card${t.active ? '' : ' expired'}">
      <div class="treaty-header">
        <span class="treaty-type-badge">${t.label}</span>
        ${t.active ? '' : '<span style="font-size:0.58rem;color:var(--text3)">EXPIRÉ/ROMPU</span>'}
      </div>
      <div class="treaty-parties">${escHtml(parties) || '—'}</div>
      ${t.clauses ? `<div class="treaty-clauses">${escHtml(t.clauses)}</div>` : ''}
      <div class="treaty-expires${soonCls}">
        Signé : Tour ${t.signedTurn} · ${escHtml(t.signedDate)}
        ${t.expiresOnTurn > 0 ? ` · Expire Tour ${t.expiresOnTurn}${turnsLeft !== null ? ` (dans ${turnsLeft} tours)` : ''}` : ' · Durée indéterminée'}
      </div>
      ${t.active ? `<button class="treaty-breach-btn" onclick="breachTreaty(${t.id})">Violer le traité</button>` : ''}
    </div>`;
  });
  content.innerHTML = html;
}

// ══════════════════════════════════════════
// ── Bilan de fin de tour ──
// ══════════════════════════════════════════
function showBilan(bilan, turn, date) {
  const hasAnything = bilan.relChanges.length || bilan.resDelta || bilan.opinion || bilan.crisis;
  if (!hasAnything) return;
  const ov = document.getElementById('bilan-ov');
  if (!ov) return;
  document.getElementById('bilan-turn').textContent = turn;
  document.getElementById('bilan-date').textContent = date;

  let html = '';

  // Relations modifiées
  if (bilan.relChanges.length) {
    html += '<div class="bilan-section"><div class="bilan-section-title">Relations modifiées</div>';
    bilan.relChanges.forEach(r => {
      const flag = FLAGS[r.code] || '🌐';
      const name = NAMES[r.code] || r.code;
      html += `<div class="bilan-rel-row">
        <span class="bilan-rel-from">${flag} ${escHtml(name)}</span>
        <span class="bilan-rel-badge ${r.next}">${REL_LABELS[r.next] || r.next}</span>
      </div>`;
    });
    html += '</div>';
  }

  // Ressources
  if (bilan.resDelta) {
    const d = bilan.resDelta;
    const r = G.ressources;
    html += '<div class="bilan-section"><div class="bilan-section-title">Impact Ressources</div><div class="bilan-res-grid">';
    [['tresorerie','💰 Trésorerie'], ['stabilite','🏛 Stabilité'], ['puissance','⚔ Puissance']].forEach(([k, lbl]) => {
      const delta = d[k] || 0;
      const val = r[k] || 0;
      const dCls = delta > 0 ? 'pos' : delta < 0 ? 'neg' : '';
      const dStr = delta > 0 ? '+' + delta : delta < 0 ? String(delta) : '±0';
      html += `<div class="bilan-res-cell">
        <span class="bilan-res-lbl">${lbl}</span>
        <span class="bilan-res-val">${val}</span>
        ${delta !== 0 ? `<span class="bilan-res-delta ${dCls}">${dStr}</span>` : ''}
      </div>`;
    });
    html += '</div></div>';
  }

  // Opinion
  if (bilan.opinion) {
    const s = bilan.opinion.score;
    const icon = s >= 70 ? '😊' : s >= 40 ? '😐' : '😠';
    html += `<div class="bilan-section"><div class="bilan-section-title">Opinion Publique</div>
      <div class="bilan-opinion-row">${icon} <span class="bilan-opinion-score">${s}/100</span> <span style="color:var(--text2);font-size:0.72rem">${escHtml(bilan.opinion.commentaire)}</span></div>
    </div>`;
  }

  // Crise
  if (bilan.crisis) {
    html += `<div class="bilan-section"><div class="bilan-section-title">Crise mondiale</div>
      <div class="bilan-crisis"><strong>⚡ ${escHtml(bilan.crisis.titre)}</strong><br>${escHtml(bilan.crisis.effet||'')}${bilan.crisis.impact ? ' — ' + escHtml(bilan.crisis.impact) : ''}</div>
    </div>`;
  }

  document.getElementById('bilan-body').innerHTML = html;
  ov.style.display = 'flex';
}

function closeBilan() {
  const ov = document.getElementById('bilan-ov');
  if (ov) ov.style.display = 'none';
}

// ══════════════════════════════════════════
// ── Alert toasts ──
// ══════════════════════════════════════════
let _alertQueue = [];
let _alertShowing = false;

function showAlertToast(icon, title, body, type = 'warn') {
  _alertQueue.push({ icon, title, body, type });
  if (!_alertShowing) _nextAlert();
}

function _nextAlert() {
  if (!_alertQueue.length) { _alertShowing = false; return; }
  _alertShowing = true;
  const { icon, title, body, type } = _alertQueue.shift();
  const el = document.createElement('div');
  el.className = 'alert-toast ' + type;
  el.innerHTML = `<span class="alert-toast-icon">${icon}</span><span class="alert-toast-title">${escHtml(title)}</span><div class="alert-toast-body">${escHtml(body)}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.remove(); _nextAlert(); }, 350);
  }, 4500);
}

const REL_ORDER = { ally: 4, tension: 3, neutral: 2, hostile: 1, war: 0 };

function checkRelationAlerts(relChanges, prevRelations) {
  relChanges.forEach(r => {
    if (!r.code || !NAMES[r.code]) return;
    const prev = prevRelations[r.code] || 'neutral';
    const next = r.statut;
    const delta = (REL_ORDER[prev] || 2) - (REL_ORDER[next] || 2);
    if (delta >= 2) {
      const flag = FLAGS[r.code] || '🌐';
      const name = NAMES[r.code];
      const label = REL_LABELS[next] || next;
      showAlertToast('📉', `Dégradation : ${name}`, `${flag} ${name} est maintenant ${label.toUpperCase()} (-${delta} niveaux)`, delta >= 3 ? 'danger' : 'warn');
    }
  });
}

// ══════════════════════════════════════════
// ── News helpers ──
// ══════════════════════════════════════════
function addJumpSep(date) {
  const feed = document.getElementById('news-feed');
  const ph = feed.querySelector('[style*="font-style:italic"]');
  if (ph) ph.remove();
  const el = document.createElement('div');
  el.className = 't-jump';
  el.innerHTML = `<span class="tj-line"></span>SAUT TEMPOREL<span class="tj-date">→ ${escHtml(date)}</span><span class="tj-line"></span>`;
  feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
  G.fullHistory.push({ type:'jump', date });
  if (G.fullHistory.length > 50) G.fullHistory.shift();
}

function addNewsEvent(ev) {
  const cat = (ev.categorie||'DIVERS').toUpperCase();
  const cls = CAT_CLASS[cat] || 'cat-misc';
  const el = document.createElement('div');
  el.className = 'ne ' + cls;
  el.innerHTML = `
    <div class="ne-top">
      <span class="ne-cat ${cls}">${cat}</span>
      <span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span>
    </div>
    <div class="ne-title">${escHtml(ev.titre||'Événement')}</div>
    <div class="ne-body">${escHtml(ev.texte||'')}</div>
  `;
  const feed = document.getElementById('news-feed');
  feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
  G.fullHistory.push({ type:'event', cat, titre:ev.titre||'Événement', texte:ev.texte||'', date:G.date, turn:G.turn });
  if (G.fullHistory.length > 50) G.fullHistory.shift();
}

function addWorldEvent(ev) {
  const el = document.createElement('div');
  el.className = 'ne cat-monde';
  el.innerHTML = `
    <div class="ne-top">
      <span class="ne-cat cat-monde">🌍 MONDE · ${escHtml(ev.lieu||'—')}</span>
      <span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span>
    </div>
    <div class="ne-title">${escHtml(ev.titre)}</div>
    <div class="ne-body">${escHtml(ev.texte||'')}</div>
  `;
  const feed = document.getElementById('news-feed');
  feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
  G.fullHistory.push({ type:'event', cat:'MONDE', titre:ev.titre, texte:ev.texte||'', date:G.date, turn:G.turn });
  if (G.fullHistory.length > 80) G.fullHistory.shift();
}

function addDecreeToFeed(action) {
  const el = document.createElement('div');
  el.className = 'ne decree-card';
  el.innerHTML = `
    <div class="ne-top">
      <span class="ne-cat decree-cat">📜 DÉCRET · ${escHtml(FLAGS[G.nationCode]||'')} ${escHtml(G.nation)}</span>
      <span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span>
    </div>
    <div class="ne-body decree-body">${escHtml(action)}</div>
  `;
  const feed = document.getElementById('news-feed');
  feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
  G.fullHistory.push({ type:'decree', texte:action, date:G.date, turn:G.turn });
  if (G.fullHistory.length > 80) G.fullHistory.shift();
}

function addThinking() {
  const el = document.createElement('div');
  el.className = 'thinking-row';
  el.innerHTML = `Analyse géopolitique en cours<span class="tdots"><span>.</span><span>.</span><span>.</span></span>`;
  const feed = document.getElementById('news-feed');
  feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
  return el;
}

function addIntelEvent(f1, n1, f2, n2, sujet, message) {
  const el = document.createElement('div');
  el.className = 'ne cat-intel';
  el.innerHTML = `
    <div class="ne-top">
      <span class="ne-cat cat-intel">RENSEIGNEMENT</span>
      <span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span>
    </div>
    <div class="ne-title">${f1} ${escHtml(n1)} — ${f2} ${escHtml(n2)}</div>
    <div class="ne-intel-pub">Sommet bilatéral : ${escHtml(sujet)}</div>
    ${message ? `<div class="ne-intel-leak">⚠ Source anonyme : ${escHtml(message)}</div>` : ''}
  `;
  const feed = document.getElementById('news-feed');
  feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
  G.fullHistory.push({ type:'intel', f1, n1, f2, n2, sujet, message, date:G.date, turn:G.turn });
  if (G.fullHistory.length > 50) G.fullHistory.shift();
}

function addBreakingNews(codeA, codeB, statut, raison) {
  const fa=FLAGS[codeA]||'🌐', fb=FLAGS[codeB]||'🌐';
  const na=NAMES[codeA]||codeA, nb=NAMES[codeB]||codeB;
  const statLabel = (REL_LABELS[statut]||statut).toUpperCase();
  const titre = `${fa} ${na} — ${fb} ${nb} : ${statLabel}`;
  const el = document.createElement('div');
  el.className = 'ne cat-breaking';
  el.innerHTML = `
    <div class="ne-top">
      <span class="ne-cat cat-breaking">⚡ BREAKING</span>
      <span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span>
    </div>
    <div class="ne-title">${fa} ${escHtml(na)} — ${fb} ${escHtml(nb)} : ${statLabel}</div>
    <div class="ne-body">${escHtml(raison)}</div>
  `;
  const feed = document.getElementById('news-feed');
  feed.appendChild(el); feed.scrollTop = feed.scrollHeight;
  G.fullHistory.push({ type:'breaking', titre, raison, date:G.date, turn:G.turn });
  if (G.fullHistory.length > 50) G.fullHistory.shift();
}

// ── History restore ──
function restoreHistory() {
  const feed = document.getElementById('news-feed');
  feed.innerHTML = '';
  if (!G.fullHistory || !G.fullHistory.length) {
    feed.innerHTML = '<div style="padding:0.6rem;color:var(--text3);font-style:italic;font-size:0.75rem;">Partie reprise. Continuez votre campagne.</div>';
    return;
  }
  G.fullHistory.forEach(h => {
    const el = document.createElement('div');
    if (h.type === 'jump') {
      el.className = 't-jump';
      el.innerHTML = `<span class="tj-line"></span>SAUT TEMPOREL<span class="tj-date">→ ${escHtml(h.date)}</span><span class="tj-line"></span>`;
    } else if (h.type === 'event') {
      const cls = CAT_CLASS[h.cat] || 'cat-misc';
      el.className = 'ne ' + cls;
      el.innerHTML = `
        <div class="ne-top"><span class="ne-cat ${cls}">${h.cat}</span><span class="ne-time">${escHtml(h.date)} · Tour ${h.turn}</span></div>
        <div class="ne-title">${escHtml(h.titre)}</div>
        <div class="ne-body">${escHtml(h.texte)}</div>`;
    } else if (h.type === 'intel') {
      el.className = 'ne cat-intel';
      el.innerHTML = `
        <div class="ne-top"><span class="ne-cat cat-intel">RENSEIGNEMENT</span><span class="ne-time">${escHtml(h.date)} · Tour ${h.turn}</span></div>
        <div class="ne-title">${h.f1} ${escHtml(h.n1)} — ${h.f2} ${escHtml(h.n2)}</div>
        <div class="ne-intel-pub">Sommet bilatéral : ${escHtml(h.sujet)}</div>
        ${h.message ? `<div class="ne-intel-leak">⚠ Source anonyme : ${escHtml(h.message)}</div>` : ''}`;
    } else if (h.type === 'breaking') {
      el.className = 'ne cat-breaking';
      el.innerHTML = `
        <div class="ne-top"><span class="ne-cat cat-breaking">⚡ BREAKING</span><span class="ne-time">${escHtml(h.date)} · Tour ${h.turn}</span></div>
        <div class="ne-title">${h.titre}</div>
        <div class="ne-body">${escHtml(h.raison)}</div>`;
    }
    feed.appendChild(el);
  });
  feed.scrollTop = feed.scrollHeight;
}

// ══════════════════════════════════════════
// ── Groupement des contacts entrants ──
// ══════════════════════════════════════════
// Blocs géopolitiques naturels pour regroupement automatique
const BLOC_OTAN = new Set([840,826,250,276,380,724,616,246,752,528,56,40,203,642,300,208,578,372,428,440,442,352,705,703,348,191,8,499,807]);
const BLOC_UE   = new Set([250,276,380,724,616,246,752,528,56,40,203,642,300,208,372,428,440,442,705,703,348,191,499,807,196,470,620,682,234,250]);
const BLOC_SCO  = new Set([156,643,356,398,364,586,417,762,860]);
const BLOC_GOLF = new Set([682,784,414,634,48,512]);

function getBloc(code) {
  if (BLOC_OTAN.has(code)) return 'OTAN';
  if (BLOC_UE.has(code))   return 'UE';
  if (BLOC_SCO.has(code))  return 'OCS';
  if (BLOC_GOLF.has(code)) return 'CCG';
  return null;
}

function normalizeSubject(subj) {
  // Retirer le nom du pays du sujet pour comparer
  return (subj || '').toLowerCase()
    .replace(/\b(accord|contact|réponse|proposition|réaction|concernant|avec)\b/gi, '')
    .trim().slice(0, 40);
}

function groupIncomingContacts(contacts) {
  // Grouper par: même bloc ET sujet similaire, ou même sujet exact
  const groups = [];
  const used = new Set();

  contacts.forEach((c, i) => {
    if (used.has(i)) return;
    const group = [c];
    used.add(i);
    const cBloc  = getBloc(c.code);
    const cSubjN = normalizeSubject(c.sujet);
    contacts.forEach((d, j) => {
      if (used.has(j) || i === j) return;
      const dBloc = getBloc(d.code);
      const dSubjN = normalizeSubject(d.sujet);
      // Même bloc (OTAN/UE/OCS) ET sujets similaires (≥50% de chars communs)
      const sameBloc = cBloc && cBloc === dBloc;
      const similarSubj = cSubjN.length > 5 && dSubjN.length > 5 &&
        (cSubjN.includes(dSubjN.slice(0,15)) || dSubjN.includes(cSubjN.slice(0,15)));
      if (sameBloc || similarSubj) {
        group.push(d);
        used.add(j);
      }
    });
    groups.push(group);
  });
  return groups;
}

function handleGroupedIncomingContacts(contacts) {
  const codes   = contacts.map(c => c.code);
  const names   = contacts.map(c => NAMES[c.code] || String(c.code));
  const firstC  = contacts[0];
  const subj    = firstC.sujet || `Contact diplomatique groupé`;
  const blocName = getBloc(firstC.code);
  const groupSubj = blocName
    ? `[${blocName}] ${subj}`
    : `Réaction commune : ${names.slice(0,2).join(', ')}${names.length > 2 ? '…' : ''}`;

  const nations = [{ code: G.nationCode, name: G.nation },
    ...contacts.map(c => ({ code: c.code, name: NAMES[c.code] || String(c.code) }))];

  // Vérifier si une conv groupée similaire existe
  const ex = G.conversations.find(conv =>
    codes.every(code => conv.nations.some(n => n.code === code)) &&
    conv.nations.some(n => n.code === G.nationCode)
  );

  if (ex) {
    contacts.forEach(c => addMsg(ex.id, NAMES[c.code] || String(c.code), c.code, c.message || '...'));
    markUnread(ex.id);
  } else {
    const conv = createConv(nations, groupSubj, false, true);
    contacts.forEach(c => addMsg(conv.id, NAMES[c.code] || String(c.code), c.code, c.message || '...'));
  }

  // Notification groupée
  const flag1 = FLAGS[firstC.code] || '🌐';
  showIncomingNotif(firstC.code, `${flag1} ${names[0]}${names.length > 1 ? ` + ${names.length - 1} autres` : ''}`, groupSubj);
}

// ══════════════════════════════════════════
// ── Incoming contact ──
// ══════════════════════════════════════════
function handleIncomingContact(contact) {
  const code = contact.code;
  const name = NAMES[code] || String(code);
  const nations = [{code:G.nationCode,name:G.nation},{code,name}];
  const ex = G.conversations.find(c=>c.nations.some(n=>n.code===code)&&c.nations.some(n=>n.code===G.nationCode));
  if (ex) {
    addMsg(ex.id, name, code, contact.message||'...');
    markUnread(ex.id);
  } else {
    const conv = createConv(nations, contact.sujet, false, true);
    addMsg(conv.id, name, code, contact.message||'...');
  }
  showIncomingNotif(code, name, contact.sujet);
}

function showIncomingNotif(code, name, subj) {
  const el = document.createElement('div');
  el.className = 'incoming-notif';
  el.innerHTML = `
    <div class="in-top">Contact entrant</div>
    <div class="in-who">${FLAGS[code]||'🌐'} ${escHtml(name)}</div>
    <div class="in-sub">${escHtml(subj||'')}</div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>el.classList.add('show')); });
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),350); }, 5000);
}

// ══════════════════════════════════════════
// ── Conversations ──
// ══════════════════════════════════════════
function openConvWith(code, name) {
  const ex = G.conversations.find(c=>c.nations.some(n=>n.code===code)&&c.nations.some(n=>n.code===G.nationCode));
  if (ex) { setActive(ex.id); return; }
  const rel = G.relations[code];
  const subj = rel==='hostile'?`Désescalade des tensions avec ${name}`:rel==='ally'?`Coordination stratégique avec ${name}`:`Contact diplomatique avec ${name}`;
  createConv([{code:G.nationCode,name:G.nation},{code,name}],subj,false);
}

function createConv(nations, subj, isAuto, isIncoming=false) {
  const id = Date.now() + Math.random();
  const conv = {id, nations, subject:subj, messages:[], isAuto, unread:isAuto||isIncoming};
  G.conversations.push(conv);
  _invalidateConvCache();
  renderConvItem(conv);
  if (!isAuto && !isIncoming) setActive(id);
  updateDiploBadge();
  updateMapConvState();
  return conv;
}

function renderConvItem(conv) {
  const list = document.getElementById('conv-list');
  const btn = list.querySelector('.btn-newconv');
  const others = conv.nations.filter(n => n.code !== G.nationCode);
  const isGroup = others.length > 1;
  const item = document.createElement('div');
  item.className = 'ci' + (G.activeConvId===conv.id ? ' active' : '');
  item.id = 'ci-'+conv.id;
  if (isGroup) {
    const flags = others.slice(0,3).map(n => FLAGS[n.code]||'🌐').join('');
    item.innerHTML = `
      <span class="ci-flags">${flags}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:0.3rem">
          <div class="ci-name">${others.slice(0,2).map(n=>n.name).join(', ')}${others.length>2?'…':''}</div>
          <span class="ci-group-badge">GROUPE</span>
        </div>
        <div class="ci-prev">${escHtml(conv.subject)}</div>
      </div>
      ${conv.unread ? '<div class="ci-dot"></div>' : ''}
    `;
  } else {
    const other = others[0] || conv.nations[0];
    item.innerHTML = `
      <span class="ci-flag">${FLAGS[other.code]||'🌐'}</span>
      <div class="ci-name">${other.name}</div>
      <div class="ci-prev">${escHtml(conv.subject)}</div>
      ${conv.unread ? '<div class="ci-dot"></div>' : ''}
      <button class="btn-locate" onclick="event.stopPropagation();locateCountry(${other.code})" title="Localiser sur la carte">⌖</button>
    `;
  }
  item.onclick = () => setActive(conv.id);
  if (btn) list.insertBefore(item, btn);
  else list.appendChild(item);
}

function setActive(id) {
  G.activeConvId = id;
  const conv = G.conversations.find(c=>c.id===id);
  if (!conv) return;
  conv.unread = false;
  updateDiploBadge();
  document.querySelectorAll('.ci').forEach(e=>e.classList.remove('active'));
  const item = document.getElementById('ci-'+id);
  if (item) { item.classList.add('active'); item.querySelector('.ci-dot')?.remove(); }
  const headerN = conv.nations.map(n=>(FLAGS[n.code]||'🌐')+' '+n.name).join(' ↔ ');
  const others = conv.nations.filter(n => n.code !== G.nationCode);
  const archetypeBadges = others.map(n => {
    const a = LEADER_ARCHETYPES[n.code];
    return a ? `<span class="archetype-badge" title="${escHtml(a.trait)}">${a.emoji} ${escHtml(a.type)}</span>` : '';
  }).join('');
  document.getElementById('conv-chat').innerHTML = `
    <div class="cch">
      <div class="cch-n">${headerN}</div>
      <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
        <div class="cch-s">${escHtml(conv.subject)}</div>
        ${archetypeBadges}
      </div>
      <button class="btn-conclude" id="conclude-${id}" onclick="concludeNegotiation(${id})" title="Formaliser les accords issus de cette conversation">⚖ Conclure</button>
      <button class="btn-conclude" style="background:rgba(45,130,183,0.15);border-color:rgba(45,130,183,0.4)" onclick="openTreatyModal(${id})" title="Proposer un traité formel">📜 Traité</button>
    </div>
    <div class="chat-msgs" id="msgs-${id}"></div>
    <div class="chat-in">
      <textarea placeholder="Votre message..." id="cin-${id}"></textarea>
      <button class="btn-send" id="csend-${id}" onclick="sendMsg(${id})">→</button>
    </div>
  `;
  document.getElementById('cin-'+id).addEventListener('keydown', e=>{
    if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMsg(id); }
  });
  conv.messages.forEach(m=>renderMsg(id,m));
  scrollChat(id);
}

function addMsg(convId, fromName, fromCode, text) {
  const conv = G.conversations.find(c=>c.id===convId);
  if (!conv) return;
  const m = {from:fromName, code:fromCode, text, isPlayer:fromCode===G.nationCode};
  conv.messages.push(m);
  if (G.activeConvId===convId) { renderMsg(convId,m); scrollChat(convId); }
  else markUnread(convId);
}

function markUnread(convId) {
  const conv = G.conversations.find(c=>c.id===convId);
  if (!conv) return;
  conv.unread = true;
  updateDiploBadge();
  const item = document.getElementById('ci-'+convId);
  if (item && !item.querySelector('.ci-dot')) {
    const d=document.createElement('div'); d.className='ci-dot'; item.appendChild(d);
  }
}

function updateDiploBadge() {
  const n = G.conversations.filter(c=>c.unread).length;
  const b = document.getElementById('diplo-badge');
  b.textContent=n; n>0?b.classList.add('on'):b.classList.remove('on');
  updateMapConvState();
}

function renderMsg(convId, msg) {
  const el = document.createElement('div');
  el.className = 'msg'+(msg.isPlayer?' mep':'');
  el.innerHTML = `<div class="mf">${FLAGS[msg.code]||'🌐'} ${escHtml(msg.from)}</div><div class="mt">${escHtml(msg.text)}</div>`;
  document.getElementById('msgs-'+convId)?.appendChild(el);
}

function scrollChat(id) {
  const el = document.getElementById('msgs-'+id);
  if(el) el.scrollTop = el.scrollHeight;
}

async function sendMsg(convId) {
  const conv = G.conversations.find(c=>c.id===convId);
  if (!conv) return;
  const ta = document.getElementById('cin-'+convId);
  const text = ta?.value.trim(); if (!text) return;
  ta.value='';
  const btn = document.getElementById('csend-'+convId);
  if(btn) btn.disabled = true;
  addMsg(convId, G.nation, G.nationCode, text);
  const respondents = conv.nations.filter(n => n.code !== G.nationCode);
  for (const other of respondents) {
    try { addMsg(convId, other.name, other.code, await convGemini(conv, other)); }
    catch(e) { addMsg(convId, 'Système', 0, `[${other.name}] Erreur : ${e.message}`); }
  }
  saveGame();
  if(btn) btn.disabled = false;
}

async function convGemini(conv, responder) {
  const others = conv.nations.filter(n => n.code !== G.nationCode);
  const isGroup = others.length > 1;
  const participants = conv.nations.map(n => n.name).join(', ');
  const hist = conv.messages.slice(-6).map(m=>`${m.from.slice(0,14)}: ${m.text.slice(0,120)}`).join('\n');
  const rel = G.relations[responder.code];
  const relLabel = rel ? REL_LABELS[rel] : 'Neutre';
  const groupCtx = isGroup ? ` Participants : ${participants}. C'est une réunion multilatérale.` : '';
  // Full game memory so the foreign leader knows what the player has done
  const allDecrees = G.fullHistory.filter(h=>h.type==='decree')
    .map(h=>`[Tour ${h.turn} — ${h.date}] ${h.texte.slice(0,250)}`).join('\n');
  const allEvents = G.fullHistory.filter(h=>h.type==='event'||h.type==='breaking')
    .map(h=>`[Tour ${h.turn}] ${h.titre}${h.texte?' : '+h.texte.slice(0,100):''}`).join('\n');
  const gameMemory = [
    G.lastResume ? `Résumé récent : ${G.lastResume}` : '',
    allDecrees ? `Décrets du chef d'État de ${G.nation} :\n${allDecrees}` : '',
    allEvents ? `Événements mondiaux :\n${allEvents}` : ''
  ].filter(Boolean).join('\n\n');
  // Persona lookup — historical/contemporary leaders by nation code
  const LEADERS = {
    840:'Donald Trump, Président des États-Unis',
    156:'Xi Jinping, Secrétaire Général du Parti Communiste et Président de la République Populaire de Chine',
    643:'Vladimir Poutine, Président de la Fédération de Russie',
    250:'Emmanuel Macron, Président de la République Française',
    276:'Olaf Scholz, Chancelier Fédéral d\'Allemagne',
    826:'Keir Starmer, Premier ministre du Royaume-Uni',
    356:'Narendra Modi, Premier ministre de l\'Inde',
    76:'Luiz Inácio Lula da Silva, Président du Brésil',
    392:'Fumio Kishida, Premier ministre du Japon',
    792:'Recep Tayyip Erdoğan, Président de la Turquie',
    364:'Ali Khamenei, Guide Suprême de la République Islamique d\'Iran',
    682:'Mohammed ben Salmane, Prince héritier et Premier ministre d\'Arabie Saoudite',
    804:'Volodymyr Zelensky, Président de l\'Ukraine',
    275:'Mahmoud Abbas, Président de l\'Autorité Palestinienne',
    376:'Benjamin Netanyahu, Premier ministre d\'Israël',
    400:'Abdallah II, Roi de Jordanie',
    422:'Joseph Aoun, Président de la République Libanaise',
    818:'Abdel Fattah el-Sissi, Président de l\'Égypte',
  };
  const persona = LEADERS[responder.code] || `chef d'État de ${responder.name}`;
  const archetype = LEADER_ARCHETYPES[responder.code];
  const archetypeLine = archetype ? ` Ton archétype de gouvernance : ${archetype.type} — "${archetype.trait}" Laisse cet archétype influencer ton ton, tes concessions et tes lignes rouges.` : '';
  const sys = `Tu es ${persona}.${groupCtx} Date : ${G.date}. Sujet : ${conv.subject}. Ta relation avec ${G.nation} : ${relLabel}.${archetypeLine}\n\n${gameMemory}\n\nIncarne ce personnage avec son style propre, ses intérêts nationaux, sa rhétorique réelle. Référence-toi précisément aux événements historiques ci-dessus si pertinent. Réponds en français, 2-3 phrases, uniquement le message diplomatique, aucune introduction ni méta-commentaire.`;
  const userMsg = hist
    ? `Échanges :\n${hist}\n\nRéponds en tant que ${responder.name} :`
    : `Envoie ton premier message en tant que ${responder.name} concernant : ${conv.subject}`;
  return cleanReply(await geminiCallFull(sys, [{role:'user',parts:[{text:userMsg}]}], 1500));
}

async function concludeNegotiation(convId) {
  const conv = G.conversations.find(c=>c.id===convId);
  if (!conv || conv.messages.length < 2) return;
  const btn = document.getElementById('conclude-'+convId);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse…'; }

  const others = conv.nations.filter(n=>n.code!==G.nationCode);
  const hist = conv.messages.slice(-12).map(m=>`${m.from}: ${m.text.slice(0,120)}`).join('\n');
  const sys = `Tu es un expert en droit international. Analyse cette conversation diplomatique et détermine les conséquences concrètes. Réponds UNIQUEMENT en JSON valide :
{"relation_changee":{"code":0,"statut":"ally|tension|hostile|war|neutral"},"tresorerie":0,"stabilite":0,"puissance":0,"event_titre":"","event_texte":"","resume":""}
- relation_changee.code = code ISO du pays concerné (0 si pas de changement de relation)
- entiers -20 à +20 pour les ressources (0 si pas d'impact)
- event_titre et event_texte : résultat concret de la négociation (accord, traité, rupture…)
- resume : résumé en 1 phrase de ce qui a été acté`;
  const user = `Conversation entre ${conv.nations.map(n=>n.name).join(', ')} — Sujet : ${conv.subject}\n\n${hist}`;

  try {
    const raw = await geminiCallFull(sys, [{role:'user',parts:[{text:user}]}], 600);
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON');
    const res = JSON.parse(m[0]);

    // Apply relation change
    const VALID_S = new Set(['ally','tension','hostile','war','neutral']);
    if (res.relation_changee?.code && VALID_S.has(res.relation_changee.statut)) {
      G.relations[res.relation_changee.code] = res.relation_changee.statut;
      updateColors(); updateCounters();
      triggerMapFX([{codeA:G.nationCode, codeB:res.relation_changee.code, type:res.relation_changee.statut}]);
    }

    // Apply resources
    if (G.modules?.ressources) {
      const delta = { tresorerie:res.tresorerie||0, stabilite:res.stabilite||0, puissance:res.puissance||0 };
      if (Object.values(delta).some(v=>v!==0)) applyResourceDelta(delta);
    }

    // News event
    if (res.event_titre) {
      const el = document.createElement('div');
      el.className = 'ne cat-diplo';
      el.innerHTML = `
        <div class="ne-top"><span class="ne-cat cat-diplo">ACCORD DIPLOMATIQUE</span><span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span></div>
        <div class="ne-title">${escHtml(res.event_titre)}</div>
        <div class="ne-body">${escHtml(res.event_texte||'')}${res.resume?`<br><em style="color:var(--text3)">${escHtml(res.resume)}</em>`:''}`;
      el.innerHTML += '</div>';
      const feed = document.getElementById('news-feed');
      if (feed) { feed.appendChild(el); feed.scrollTop = feed.scrollHeight; }
      G.fullHistory.push({ type:'event', cat:'DIPLOMATIQUE', titre:res.event_titre, texte:res.event_texte||'', date:G.date, turn:G.turn });
    }

    // Add summary message to conv
    if (res.resume) addMsg(convId, 'Accord conclu', 0, `✅ ${res.resume}`);
    saveGame();
  } catch(e) {
    addMsg(convId, 'Système', 0, 'Impossible d\'analyser la négociation : '+e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '⚖ Conclure'; }
}

function cleanReply(text) {
  return text
    .replace(/^\s*\(.*?\)\s*[:*]+\s*/g,'')
    .replace(/^\s*\*+\s*/g,'')
    .replace(/\*\*(.*?)\*\*/g,'$1')
    .replace(/^\s*[→\-–—:]\s*/g,'')
    .replace(/^(Réponse|Répondre|Message)\s*[:*]+\s*/gi,'')
    .trim();
}

// ── Modal multi-nation ──
function fillModalSelect() {
  const list = document.getElementById('modal-nation-list');
  list.innerHTML = '';
  Object.entries(NAMES).filter(([c]) => +c !== G.nationCode)
    .sort((a,b) => a[1].localeCompare(b[1]))
    .forEach(([c, n]) => {
      const item = document.createElement('label');
      item.className = 'mnl-item';
      item.dataset.code = c;
      item.dataset.name = n.toLowerCase();
      item.innerHTML = `
        <input type="checkbox" value="${c}" onchange="mnlToggle(${c},'${escHtml(n)}')">
        <span class="mnl-item-flag">${FLAGS[+c]||'🌐'}</span>
        <span class="mnl-item-name">${escHtml(n)}</span>
      `;
      list.appendChild(item);
    });
}

function mnlToggle(code, name) {
  const item = document.querySelector(`.mnl-item[data-code="${code}"]`);
  const checked = item?.querySelector('input')?.checked;
  item?.classList.toggle('checked', checked);
  renderMnlTags();
}

function renderMnlTags() {
  const sel = document.getElementById('mnl-selected');
  sel.innerHTML = '';
  document.querySelectorAll('.mnl-item.checked').forEach(item => {
    const code = item.dataset.code;
    const name = item.querySelector('.mnl-item-name').textContent;
    const tag = document.createElement('div');
    tag.className = 'mnl-tag';
    tag.innerHTML = `${FLAGS[+code]||'🌐'} ${escHtml(name)} <span class="mnl-tag-rm" onclick="mnlUncheck(${code})">✕</span>`;
    sel.appendChild(tag);
  });
}

function mnlUncheck(code) {
  const item = document.querySelector(`.mnl-item[data-code="${code}"]`);
  if (item) { item.querySelector('input').checked = false; item.classList.remove('checked'); }
  renderMnlTags();
}

function filterModalNations(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.mnl-item').forEach(item => {
    item.classList.toggle('hidden', q && !item.dataset.name.includes(q));
  });
}

function openModal() {
  document.getElementById('modal-ov').classList.add('on');
  document.getElementById('mnl-search').value = '';
  filterModalNations('');
  document.querySelectorAll('.mnl-item').forEach(i => { i.classList.remove('checked'); i.querySelector('input').checked = false; });
  renderMnlTags();
}
function closeModal() { document.getElementById('modal-ov').classList.remove('on'); }

function createConvModal() {
  const checked = [...document.querySelectorAll('.mnl-item.checked')];
  if (!checked.length) return;
  const nations = [{code:G.nationCode, name:G.nation},
    ...checked.map(i => ({code:+i.dataset.code, name:i.querySelector('.mnl-item-name').textContent}))];
  const defaultSubj = nations.length > 2
    ? `Sommet multilatéral — ${nations.slice(1).map(n=>n.name).join(', ')}`
    : `Contact diplomatique avec ${nations[1].name}`;
  const subj = document.getElementById('modal-subj').value.trim() || defaultSubj;
  createConv(nations, subj, false);
  document.getElementById('modal-subj').value = '';
  closeModal();
}

// geminiActionCall, geminiCallFull, parseActionJson, displayDebugError → api.js

// ══════════════════════════════════════════
// ── Map FX : arcs + icons ──
// ══════════════════════════════════════════
function drawRelationArc(codeA, codeB, type) {
  if (!d3proj || !d3g) return;
  const capA = CAPITALS[codeA], capB = CAPITALS[codeB];
  if (!capA || !capB) return;
  const pa = d3proj(capA), pb = d3proj(capB);
  if (!pa || !pb || isNaN(pa[0]) || isNaN(pb[0])) return;
  const [x1,y1]=pa, [x2,y2]=pb;
  const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
  if (len < 1) return;
  const offset = Math.min(len*0.3, 70);
  const cpx = (x1+x2)/2 - dy/len*offset;
  const cpy = (y1+y2)/2 + dx/len*offset;
  const colors = {ally:'#d4920a', tension:'#9a6210', hostile:'#8a1a1a', war:'#cc0000', neutral:'#3a5a7a'};
  const color = colors[type] || '#3a5a7a';
  const isHard = type==='hostile'||type==='war'||type==='tension';

  const arc = d3g.append('path')
    .attr('d',`M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`)
    .attr('fill','none').attr('stroke',color)
    .attr('stroke-width', type==='war'?2:1.4)
    .attr('opacity',0).style('pointer-events','none');

  if (!isHard) {
    const L = arc.node().getTotalLength();
    arc.attr('stroke-dasharray',`${L} ${L}`).attr('stroke-dashoffset',L)
      .transition().duration(700).attr('stroke-dashoffset',0).attr('opacity',0.75)
      .transition().delay(2000).duration(900).attr('opacity',0)
      .on('end',()=>arc.remove());
  } else {
    arc.attr('stroke-dasharray','5,3')
      .transition().duration(400).attr('opacity',0.65)
      .transition().delay(2200).duration(900).attr('opacity',0)
      .on('end',()=>arc.remove());
  }
  [pa,pb].forEach(p => {
    const dot = d3g.append('circle').attr('cx',p[0]).attr('cy',p[1]).attr('r',2.5)
      .attr('fill',color).attr('opacity',0).style('pointer-events','none');
    dot.transition().duration(300).attr('opacity',1)
      .transition().delay(2600).duration(700).attr('opacity',0)
      .on('end',()=>dot.remove());
  });
}

function showMapIcon(code, icon) {
  if (!d3g) return;
  const c = d3centroids[code];
  if (!c || isNaN(c[0])) return;
  const g = d3g.append('g').style('pointer-events','none');
  // Background circle for readability
  g.append('circle')
    .attr('cx', c[0]).attr('cy', c[1]-5)
    .attr('r', 6).attr('fill','#0a1628').attr('fill-opacity', 0.7)
    .attr('opacity', 0);
  const el = g.append('text')
    .attr('x',c[0]).attr('y',c[1]-2)
    .attr('text-anchor','middle').attr('font-size','8px')
    .text(icon).attr('opacity',0);
  g.selectAll('*').transition().duration(400).attr('opacity',1)
    .transition().delay(5000).duration(1000).attr('opacity',0)
    .on('end', function(){ if(this===el.node()) g.remove(); });
}

const REL_ICONS = {ally:'✦', tension:'!', hostile:'✕', war:'⚔', neutral:'·'};

function triggerMapFX(changes) {
  // changes: array of {codeA, codeB, type} or {code, type}
  changes.forEach(ch => {
    const icon = REL_ICONS[ch.type] || '·';
    if (ch.codeB !== undefined) {
      drawRelationArc(ch.codeA, ch.codeB, ch.type);
      showMapIcon(ch.codeA, icon);
      showMapIcon(ch.codeB, icon);
    } else {
      showMapIcon(ch.code, icon);
    }
  });
}

// ══════════════════════════════════════════
// ── Staff / Gouvernement ──
// ══════════════════════════════════════════
let _staffTab = 'militaires';
let _staffChatId = null;

const STAFF_DEFAULTS = {
  militaires: [
    { id:'m0', role:'Chef d\'État-Major des Armées',      icon:'⭐' },
    { id:'m1', role:'Commandant des Forces Terrestres',   icon:'🎖' },
    { id:'m2', role:'Amiral en Chef des Forces Navales',  icon:'⚓' },
    { id:'m3', role:'Général des Forces Aériennes',       icon:'✈' },
    { id:'m4', role:'Chef du Renseignement Militaire',    icon:'🔭' },
  ],
  ministres: [
    { id:'p0', role:'Premier Ministre',                         icon:'🏛' },
    { id:'p1', role:'Ministre des Affaires Étrangères',         icon:'🌐' },
    { id:'p2', role:'Ministre de l\'Économie et des Finances',  icon:'📊' },
    { id:'p3', role:'Ministre de la Défense',                   icon:'🛡' },
    { id:'p4', role:'Ministre de l\'Intérieur',                 icon:'🔑' },
    { id:'p5', role:'Directeur Général du Renseignement',       icon:'🕵' },
  ]
};

function initStaff() {
  if (G.staff?.militaires?.length) return; // already loaded (from save)
  G.staff = {
    militaires: STAFF_DEFAULTS.militaires.map(m => ({ ...m, name:'', active:true, messages:[] })),
    ministres:  STAFF_DEFAULTS.ministres.map(m  => ({ ...m, name:'', active:true, messages:[] }))
  };
  generateStaffNames();
}

async function generateStaffNames() {
  if (!G.apiKey) return;
  const allRoles = [...G.staff.militaires, ...G.staff.ministres].map(m => m.role).join('|');
  const sys = `Génère des noms réalistes et culturellement appropriés pour les membres du gouvernement de ${G.nation}. Réponds UNIQUEMENT en JSON : {"noms":["nom1","nom2",...]} — même ordre que les rôles fournis.`;
  const user = `Rôles (dans l'ordre) : ${allRoles}`;
  try {
    const raw = await geminiCallFull(sys, [{role:'user',parts:[{text:user}]}], 300);
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return;
    const data = JSON.parse(m[0]);
    if (!Array.isArray(data.noms)) return;
    const all = [...G.staff.militaires, ...G.staff.ministres];
    data.noms.forEach((n, i) => { if (all[i] && n) all[i].name = n; });
    saveGame();
    if (document.getElementById('staff-panel')?.classList.contains('open')) renderStaffList(_staffTab);
  } catch {}
}

function toggleStaffPanel() {
  const panel = document.getElementById('staff-panel');
  const btn = document.getElementById('btn-gov');
  const isOpen = panel.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  if (isOpen) { _staffChatId = null; renderStaffList(_staffTab); }
}

function switchStaffTab(tab) {
  _staffTab = tab;
  _staffChatId = null;
  document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.id === 'stab-'+tab));
  renderStaffList(tab);
}

function getStaffMember(id) {
  return [...G.staff.militaires, ...G.staff.ministres].find(m => m.id === id);
}

function renderStaffList(tab) {
  const content = document.getElementById('staff-content');
  if (!content) return;
  const members = G.staff[tab] || [];
  let html = '<div class="staff-list">';
  members.forEach(m => {
    if (!m.active) {
      html += `
        <div class="staff-member fired">
          <div class="sm-icon">${m.icon}</div>
          <div class="sm-info">
            <div class="sm-name"><span class="sm-fired-lbl">RELEVÉ</span></div>
            <div class="sm-role">${escHtml(m.role)}</div>
          </div>
        </div>
        <div class="sm-hire-row">
          <div class="sm-hire-label">Nommer un remplaçant</div>
          <div class="sm-hire-inputs">
            <input class="sm-hire-input" id="hire-input-${m.id}" placeholder="Nom du successeur…">
            <button class="sm-btn-hire" onclick="hireMember('${m.id}')">Nommer</button>
          </div>
        </div>`;
    } else {
      const displayName = m.name || '<span style="color:var(--text3);font-style:italic">En attente…</span>';
      html += `
        <div class="staff-member" onclick="openStaffChat('${m.id}')">
          <div class="sm-icon">${m.icon}</div>
          <div class="sm-info">
            <div class="sm-name">${m.name ? escHtml(m.name) : displayName}</div>
            <div class="sm-role">${escHtml(m.role)}</div>
          </div>
          <div class="sm-actions" onclick="event.stopPropagation()">
            <button class="sm-btn sm-btn-talk" onclick="openStaffChat('${m.id}')">Ordonner</button>
            <button class="sm-btn sm-btn-fire" onclick="fireMember('${m.id}')">Renvoyer</button>
          </div>
        </div>`;
    }
  });
  html += '</div>';
  content.innerHTML = html;
}

function openStaffChat(id) {
  _staffChatId = id;
  const m = getStaffMember(id);
  if (!m) return;
  const content = document.getElementById('staff-content');
  content.innerHTML = `
    <div class="staff-chat" id="staff-chat-${id}">
      <div class="staff-chat-hdr">
        <button class="staff-chat-back" onclick="_staffChatId=null;renderStaffList(_staffTab)">← Retour</button>
        <div class="staff-chat-icon">${m.icon}</div>
        <div class="staff-chat-info">
          <div class="staff-chat-name">${escHtml(m.name||m.role)}</div>
          <div class="staff-chat-role">${escHtml(m.name?m.role:'')}</div>
        </div>
      </div>
      <div class="staff-msgs" id="smsgs-${id}"></div>
      <div class="staff-input-row">
        <textarea id="sinput-${id}" placeholder="Votre ordre ou question…" onkeydown="staffInputKey(event,'${id}')"></textarea>
        <button class="staff-send-btn" id="ssend-${id}" onclick="sendStaffMsg('${id}')">→</button>
      </div>
    </div>`;
  (m.messages || []).forEach(msg => renderStaffMsg(id, msg));
  scrollStaffChat(id);
}

function renderStaffMsg(id, msg) {
  const el = document.createElement('div');
  el.className = 'smsg ' + (msg.isPlayer ? 'smsg-player' : 'smsg-advisor');
  if (!msg.isPlayer) el.innerHTML = `<div class="smsg-from">${escHtml(msg.from)}</div>`;
  el.innerHTML += escHtml(msg.text).replace(/\n/g,'<br>');
  document.getElementById('smsgs-'+id)?.appendChild(el);
}

function scrollStaffChat(id) {
  const el = document.getElementById('smsgs-'+id);
  if (el) el.scrollTop = el.scrollHeight;
}

function staffInputKey(e, id) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendStaffMsg(id); }
}

async function sendStaffMsg(id) {
  const m = getStaffMember(id);
  if (!m) return;
  const ta = document.getElementById('sinput-'+id);
  const btn = document.getElementById('ssend-'+id);
  const text = ta?.value.trim(); if (!text) return;
  ta.value = '';
  if (btn) btn.disabled = true;
  const playerMsg = { isPlayer:true, from:G.nation, text };
  if (!m.messages) m.messages = [];
  m.messages.push(playerMsg);
  renderStaffMsg(id, playerMsg);
  scrollStaffChat(id);

  // Thinking indicator
  const thinkEl = document.createElement('div');
  thinkEl.className = 'staff-thinking';
  thinkEl.innerHTML = `${m.icon} ${m.name||m.role} réfléchit<span class="tdots"><span>.</span><span>.</span><span>.</span></span>`;
  document.getElementById('smsgs-'+id)?.appendChild(thinkEl);
  scrollStaffChat(id);

  try {
    const response = await staffGemini(m, text);
    thinkEl.remove();
    const advMsg = { isPlayer:false, from: m.name||m.role, text: response };
    m.messages.push(advMsg);
    renderStaffMsg(id, advMsg);
    scrollStaffChat(id);
    if (m.messages.length > 40) m.messages = m.messages.slice(-40);
    saveGame();
  } catch(e) {
    thinkEl.remove();
    const errMsg = { isPlayer:false, from:'Système', text:'Erreur : '+e.message };
    m.messages.push(errMsg);
    renderStaffMsg(id, errMsg);
  }
  if (btn) btn.disabled = false;
}

async function staffGemini(member, userText) {
  const hist = (member.messages || []).slice(-6)
    .map(msg => `${msg.isPlayer ? G.nation : (member.name||member.role)}: ${msg.text.slice(0,150)}`).join('\n');
  const rels = Object.entries(G.relations).filter(([,r])=>r!=='neutral').slice(0,6)
    .map(([c,r])=>`${NAMES[c]||c}:${REL_LABELS[r]||r}`).join(', ');
  const modRes = G.modules?.ressources ? `Ressources actuelles — Trésorerie:${G.ressources.tresorerie} Stabilité:${G.ressources.stabilite} Puissance:${G.ressources.puissance}.` : '';
  // Full game memory: all decrees + all notable events
  const allDecrees = G.fullHistory.filter(h=>h.type==='decree')
    .map(h=>`[Tour ${h.turn} — ${h.date}] DÉCRET : ${h.texte.slice(0,300)}`).join('\n');
  const allEvents = G.fullHistory.filter(h=>h.type==='event'||h.type==='breaking')
    .map(h=>`[Tour ${h.turn} — ${h.cat||''}] ${h.titre}${h.texte?' : '+h.texte.slice(0,120):''}`).join('\n');
  const gameCtx = [
    G.lastResume ? `Résumé du dernier tour : ${G.lastResume}` : '',
    allDecrees ? `=== HISTORIQUE COMPLET DES DÉCRETS DU CHEF D'ÉTAT ===\n${allDecrees}` : '',
    allEvents ? `=== ÉVÉNEMENTS SURVENUS DEPUIS LE DÉBUT DE LA PARTIE ===\n${allEvents}` : ''
  ].filter(Boolean).join('\n\n');
  const sys = `Tu es ${member.name||member.role} de ${G.nation}, ${member.role}. Date : ${G.date}, Tour ${G.turn}. Relations clés : ${rels||'stables'}. ${modRes} ${G.scenarioContext?'Contexte : '+G.scenarioContext.slice(0,150)+'.':''}\n${gameCtx}\nTu as accès à tout l'historique des décisions du chef d'État ci-dessus et tu dois y faire référence précisément quand c'est pertinent. Tu conseilles directement le chef d'État. Réponds en français, 3-5 phrases, de façon experte et directe. Si l'ordre implique une action concrète avec impact mesurable, ajoute OBLIGATOIREMENT sur une nouvelle ligne à la fin : ##IMPACT##{"tresorerie":0,"stabilite":0,"puissance":0,"event":""} (entiers -15 à +15, event = titre bref si événement notable sinon chaîne vide).`;
  const userMsg = hist
    ? `Échanges récents :\n${hist}\n\nNouveau message : ${userText}`
    : userText;
  const raw = (await geminiCallFull(sys, [{role:'user',parts:[{text:userMsg}]}], 1500)).trim();
  // Parse impact
  const impactMatch = raw.match(/##IMPACT##(\{[^}]+\})/);
  const cleanResponse = raw.replace(/##IMPACT##\{[^}]+\}/, '').trim();
  if (impactMatch) {
    try {
      const imp = JSON.parse(impactMatch[1]);
      applyStaffImpact(imp, member);
    } catch {}
  }
  return cleanResponse;
}

function applyStaffImpact(imp, member) {
  let changed = false;
  if (G.modules?.ressources) {
    ['tresorerie','stabilite','puissance'].forEach(k => {
      if (imp[k] && imp[k] !== 0) { applyResourceDelta({ [k]: imp[k] }); changed = true; }
    });
  }
  if (imp.event) {
    const el = document.createElement('div');
    el.className = 'ne cat-pol';
    el.innerHTML = `
      <div class="ne-top"><span class="ne-cat cat-pol">DÉCISION GOUVERNEMENTALE</span><span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span></div>
      <div class="ne-title">${escHtml(imp.event)}</div>
      <div class="ne-body">Sur ordre de ${escHtml(member.name||member.role)}.</div>`;
    const feed = document.getElementById('news-feed');
    if (feed) { feed.appendChild(el); feed.scrollTop = feed.scrollHeight; }
    G.fullHistory.push({ type:'event', cat:'POLITIQUE', titre:imp.event, texte:`Décision de ${member.name||member.role}`, date:G.date, turn:G.turn });
  }
  if (changed) saveGame();
}

function fireMember(id) {
  if (!confirm('Confirmer le renvoi de ce membre ?')) return;
  const m = getStaffMember(id);
  if (m) { m.active = false; m.messages = []; }
  _staffChatId = null;
  renderStaffList(_staffTab);
  saveGame();
}

function hireMember(id) {
  const input = document.getElementById('hire-input-'+id);
  const name = input?.value.trim();
  if (!name) { input?.focus(); return; }
  const m = getStaffMember(id);
  if (m) { m.name = name; m.active = true; m.messages = []; }
  renderStaffList(_staffTab);
  saveGame();
}

// ══════════════════════════════════════════
// ── Archives screen ──
// ══════════════════════════════════════════
function renderArchivesScreen() {
  const body = document.getElementById('arc-body');
  const title = document.getElementById('arc-title');
  const sub = document.getElementById('arc-sub');
  if (!body) return;
  title.textContent = `Archives — ${G.nation}`;
  sub.textContent = G.scenarioTitle ? `Scénario : ${G.scenarioTitle}` : '';
  body.innerHTML = '';

  // Graphiques de tendances
  if (G.trendsHistory && G.trendsHistory.length >= 2) {
    const chartSection = document.createElement('div');
    chartSection.className = 'arc-trends-section';
    chartSection.innerHTML = `<div class="arc-trends-title">Tendances historiques</div>`;
    const grid = document.createElement('div');
    grid.className = 'arc-trends-grid';

    const trendLines = [
      { key: 'tresorerie', label: '💰 Trésorerie', color: '#d4920a' },
      { key: 'stabilite',  label: '🏛 Stabilité',  color: '#4ade80' },
      { key: 'puissance',  label: '⚔ Puissance',   color: '#60a5fa' },
      { key: 'opinion',    label: '📢 Opinion',     color: '#c084fc' }
    ];

    trendLines.forEach(({ key, label, color }) => {
      const vals = G.trendsHistory.map(p => p[key]).filter(v => v !== undefined && v !== null);
      if (!vals.length) return;
      const wrap = document.createElement('div');
      wrap.className = 'arc-trend-card';
      const current = vals[vals.length - 1];
      const first = vals[0];
      const delta = current - first;
      wrap.innerHTML = `<div class="arc-trend-label">${label} <span class="arc-trend-current">${current}</span> <span class="arc-trend-delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : ''}${delta}</span></div>`;
      const canvas = document.createElement('canvas');
      canvas.width = 200; canvas.height = 50;
      canvas.className = 'arc-trend-canvas';
      wrap.appendChild(canvas);
      grid.appendChild(wrap);

      // Draw sparkline after DOM insertion
      requestAnimationFrame(() => {
        const ctx = canvas.getContext('2d');
        const W = 200, H = 50, pad = 4;
        const min = Math.min(...vals), max = Math.max(...vals);
        const range = max - min || 1;
        ctx.clearRect(0, 0, W, H);
        // Grid line at 50
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        const y50 = H - pad - ((50 - min) / range) * (H - pad * 2);
        ctx.beginPath(); ctx.moveTo(0, y50); ctx.lineTo(W, y50); ctx.stroke();
        // Sparkline
        ctx.strokeStyle = color; ctx.lineWidth = 1.8;
        ctx.beginPath();
        vals.forEach((v, i) => {
          const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
          const y = H - pad - ((v - min) / range) * (H - pad * 2);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        // Last point dot
        const lx = W - pad, lv = vals[vals.length - 1];
        const ly = H - pad - ((lv - min) / range) * (H - pad * 2);
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill();
      });
    });

    chartSection.appendChild(grid);
    body.appendChild(chartSection);
  }

  if (!G.fullHistory || !G.fullHistory.length) {
    body.innerHTML += '<div class="arc-empty">Aucune entrée dans les archives. Lancez votre première action.</div>';
    return;
  }

  // Group by date/turn
  const chapters = new Map();
  G.fullHistory.forEach(h => {
    const key = h.date || '—';
    if (!chapters.has(key)) chapters.set(key, { turn: h.turn, entries: [] });
    chapters.get(key).entries.push(h);
  });

  chapters.forEach((ch, date) => {
    const sep = document.createElement('div');
    sep.className = 'arc-chapter';
    sep.innerHTML = `<div class="arc-chapter-date">${escHtml(date)}</div><div class="arc-chapter-line"></div><div class="arc-chapter-turn">Tour ${ch.turn||'—'}</div>`;
    body.appendChild(sep);

    ch.entries.forEach(h => {
      const el = document.createElement('div');
      if (h.type === 'jump') return;

      if (h.type === 'decree') {
        el.className = 'arc-decree';
        el.innerHTML = `<div class="arc-decree-lbl">📜 Décret National</div><div class="arc-decree-text">${escHtml(h.texte||'')}</div>`;
      } else if (h.type === 'intel') {
        el.className = 'arc-intel';
        el.innerHTML = `<div class="arc-intel-pub">${escHtml(h.n1||'')} — ${escHtml(h.n2||'')} : ${escHtml(h.sujet||'')}</div>${h.message?`<div class="arc-intel-leak">⚠ ${escHtml(h.message)}</div>`:''}`;
      } else if (h.type === 'breaking') {
        el.className = 'arc-breaking';
        el.innerHTML = `<div class="arc-breaking-lbl">⚡ BREAKING</div><div class="arc-entry-title">${escHtml(h.titre||'')}</div><div class="arc-entry-body">${escHtml(h.raison||'')}</div>`;
      } else {
        const catCls = CAT_CLASS[h.cat] || '';
        el.className = 'arc-entry';
        el.innerHTML = `<div class="arc-entry-cat ${catCls}">${escHtml(h.cat||'DIVERS')}</div><div class="arc-entry-title">${escHtml(h.titre||'')}</div><div class="arc-entry-body">${escHtml(h.texte||'')}</div>`;
      }
      body.appendChild(el);
    });
  });
}

// ══════════════════════════════════════════
// ── Tutoriel interactif ──
// ══════════════════════════════════════════
const TUTORIAL_STEPS = [
  '🗺 <strong>Bienvenue dans ORBIS !</strong><br>Vous voyez la carte mondiale. Chaque couleur représente une relation : or = vous, vert = alliés, rouge = ennemis.',
  '📜 <strong>Le Décret National</strong><br>En bas de l\'écran, tapez l\'action de votre nation et appuyez sur <kbd>Entrée</kbd>. Ex : "Proposer une alliance militaire à la Chine".',
  '🌐 <strong>Diplomatie directe</strong><br>Cliquez sur n\'importe quel pays sur la carte pour ouvrir un canal diplomatique et parler directement à son chef d\'État.',
  '📊 <strong>Flux d\'actualités</strong><br>Le panneau de droite (haut) affiche tous les événements géopolitiques en temps réel après chaque décret.',
  '🏛 <strong>Gouvernement</strong><br>Cliquez sur "Gouvernement" en haut pour consulter votre état-major. Utilisez "Consulter" pour recueillir leur avis avant d\'agir.',
  '💾 <strong>Sauvegarde automatique</strong><br>La partie est sauvegardée après chaque action. Vous pouvez quitter et reprendre à tout moment depuis le menu principal.',
  '🎯 <strong>Prêt à gouverner !</strong><br>Rédigez votre premier décret. Le monde attend votre décision.'
];

let _tutorialStep = 0;

function startTutorial() {
  if (localStorage.getItem('orbis_tutorial_done') === '1') return;
  _tutorialStep = 0;
  showTutorialStep();
  document.getElementById('tutorial-ov').style.display = 'flex';
}

function showTutorialStep() {
  const stepEl = document.getElementById('tutorial-step-text');
  const indEl  = document.getElementById('tutorial-indicator');
  const nextBtn = document.getElementById('btn-tuto-next');
  if (!stepEl || !indEl) return;
  stepEl.innerHTML = TUTORIAL_STEPS[_tutorialStep] || '';
  indEl.innerHTML = TUTORIAL_STEPS.map((_, i) => `<div class="tuto-dot${i===_tutorialStep?' active':''}"></div>`).join('');
  if (nextBtn) nextBtn.textContent = _tutorialStep >= TUTORIAL_STEPS.length - 1 ? '✓ Commencer' : 'Suivant →';
}

function nextTutorialStep() {
  _tutorialStep++;
  if (_tutorialStep >= TUTORIAL_STEPS.length) {
    skipTutorial();
  } else {
    showTutorialStep();
  }
}

function skipTutorial() {
  document.getElementById('tutorial-ov').style.display = 'none';
  localStorage.setItem('orbis_tutorial_done', '1');
}

// ══════════════════════════════════════════
// ── Export récit prose ──
// ══════════════════════════════════════════
async function exportStory() {
  const btn = document.getElementById('btn-export-story');
  const panel = document.getElementById('arc-story-panel');
  const textEl = document.getElementById('arc-story-text');
  if (!btn || !panel || !textEl) return;
  btn.disabled = true; btn.textContent = '⏳ Génération…';
  panel.style.display = 'block';
  textEl.textContent = 'Génération du récit en cours…';

  try {
    const decrees = G.fullHistory.filter(h => h.type === 'decree')
      .map(h => `[Tour ${h.turn} — ${h.date}] ${h.texte}`).join('\n\n');
    const events = G.fullHistory.filter(h => h.type === 'event' || h.type === 'breaking')
      .slice(0, 25)
      .map(h => `[${h.date || '—'}] ${h.titre}${h.texte ? ' : ' + h.texte.slice(0, 120) : ''}`).join('\n');
    const relVals  = Object.values(G.relations);
    const allyC    = relVals.filter(r => r === 'ally').length;
    const warC     = relVals.filter(r => r === 'war').length;

    const sys = 'Tu es un historien narratif. Compile les informations de cette partie en un récit historique en prose, style livre d\'histoire, 500-700 mots. Chapitres chronologiques, style dramatique et factuel. En français.';
    const user = `Nation dirigée : ${G.nation}. Durée : ${G.turn} tours (${G.date}). Alliés actuels : ${allyC}. Guerres actives : ${warC}.\n\n=== DÉCRETS DU CHEF D'ÉTAT ===\n${decrees || 'Aucun décret enregistré.'}\n\n=== ÉVÉNEMENTS MAJEURS ===\n${events || 'Aucun événement enregistré.'}`;

    const raw = await geminiCallFull(sys, [{ role:'user', parts:[{ text:user }] }], 1500);
    const story = cleanReply(raw);
    textEl.textContent = story;
    G._cachedStory = story;
  } catch(e) {
    textEl.textContent = 'Erreur lors de la génération : ' + e.message;
  }
  btn.disabled = false; btn.textContent = '📖 Générer le récit';
}

function copyStory() {
  const text = document.getElementById('arc-story-text')?.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.arc-story-copy');
    if (btn) { btn.textContent = '✓ Copié'; setTimeout(() => btn.textContent = '📋 Copier', 2000); }
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  });
}

// ══════════════════════════════════════════
// ── Export / Import JSON ──
// ══════════════════════════════════════════
function exportSave() {
  const saves = getAllSaves();
  if (!saves.length) { alert('Aucune sauvegarde à exporter.'); return; }
  const data = JSON.stringify({ orbis_export: true, version: 2, saves, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `orbis_saves_${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function importSave(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      const imported = data.orbis_export ? data.saves : (Array.isArray(data) ? data : [data]);
      if (!imported?.length) throw new Error('Aucune sauvegarde trouvée');
      const existing = getAllSaves();
      let added = 0;
      imported.forEach(s => {
        if (s.nation && s.id) {
          if (!existing.find(e => e.id === s.id)) { existing.unshift(s); added++; }
        }
      });
      localStorage.setItem('orbis_saves', JSON.stringify(existing));
      alert(`${added} sauvegarde(s) importée(s).`);
      renderLoadScreen();
    } catch(err) { alert('Erreur d\'import : ' + err.message); }
    input.value = '';
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════
// ── Custom preset ──
// ══════════════════════════════════════════
async function generatePreset(promptText) {
  const schema = JSON.stringify({
    date_depart: 'Mois AAAA',
    titre_scenario: 'Titre court en 4 mots max',
    contexte: '3-4 phrases décrivant le monde et les enjeux',
    nations_focus: [840, 156],
    relations_initiales: [{ paysA: 276, paysB: 250, statut: 'war' }]
  });
  const sysText = 'Tu es un générateur de scénarios géopolitiques pour le jeu ORBIS. Réponds UNIQUEMENT en JSON valide, en français. Utilise les codes ISO numériques des nations réelles. Si le scénario est fictif (espace, fantasy), assigne les codes ISO existants aux entités fictives et explique-le dans le contexte.';
  const userText = `Génère un scénario cohérent pour ce prompt : "${promptText}"\nSchéma : ${schema}\nStatuts possibles : ally, tension, hostile, war, neutral`;
  const raw = await geminiCallFull(sysText, [{ role:'user', parts:[{ text:userText }] }], 1200);
  const strategies = [
    () => JSON.parse(raw.trim()),
    () => { const m=raw.match(/```(?:json)?\s*([\s\S]*?)```/); if(!m) throw 0; return JSON.parse(m[1]); },
    () => { const m=raw.match(/\{[\s\S]*\}/); if(!m) throw 0; return JSON.parse(m[0]); }
  ];
  for (const fn of strategies) { try { return fn(); } catch {} }
  throw new Error('Impossible de générer le scénario. Réessayez avec un prompt plus précis.');
}

// ══════════════════════════════════════════
// ── Save / Load (multi-slot) ──
// ══════════════════════════════════════════
function getAllSaves() {
  try {
    // Migrate legacy single save
    const legacy = localStorage.getItem('orbis_save');
    if (legacy) {
      const s = JSON.parse(legacy);
      if (s?.nation) {
        s.id = s.id || 'legacy_' + (s.savedAt || Date.now());
        const saves = JSON.parse(localStorage.getItem('orbis_saves')||'[]');
        if (!saves.find(sv => sv.id === s.id)) { saves.unshift(s); localStorage.setItem('orbis_saves', JSON.stringify(saves)); }
        localStorage.removeItem('orbis_save');
      }
    }
    return JSON.parse(localStorage.getItem('orbis_saves')||'[]');
  } catch { return []; }
}

function upsertSave(save) {
  const saves = getAllSaves();
  const idx = saves.findIndex(s => s.id === save.id);
  if (idx >= 0) saves[idx] = save; else saves.unshift(save);
  localStorage.setItem('orbis_saves', JSON.stringify(saves));
}

function deleteSave(id) {
  localStorage.setItem('orbis_saves', JSON.stringify(getAllSaves().filter(s=>s.id!==id)));
}

function confirmDeleteSave(id) {
  if (confirm('Supprimer cette sauvegarde ?')) { deleteSave(id); renderLoadScreen(); }
}

function renameSave(id) {
  const newName = prompt('Nouveau nom pour cette sauvegarde :');
  if (!newName) return;
  const saves = getAllSaves();
  const save = saves.find(s => s.id === id);
  if (!save) return;
  save.saveName = newName.slice(0, 40);
  localStorage.setItem('orbis_saves', JSON.stringify(saves));
  if (G.saveId === id) G.saveName = save.saveName;
  renderLoadScreen();
}

function clearAllSaves() {
  if (confirm('Supprimer TOUTES les sauvegardes ? Cette action est irréversible.')) {
    localStorage.removeItem('orbis_saves');
    localStorage.removeItem('orbis_save');
    renderLoadScreen();
  }
}

let _saveTimeout = 0;
function saveGame(immediate) {
  clearTimeout(_saveTimeout);
  const doSave = () => {
    try {
      const snapshot = {
        id: G.saveId,
        nation:G.nation, nationCode:G.nationCode, style:G.style, model:G.model, saveName:G.saveName||'',
        difficulty:G.difficulty, modules:G.modules, ressources:G.ressources,
        date:G.date, turn:G.turn, relations:G.relations,
        lastResume:G.lastResume, worldRels:G.worldRels,
        scenarioContext:G.scenarioContext||'', scenarioTitle:G.scenarioTitle||'',
        staff:G.staff, warProgress:G.warProgress, provinceOwnership:G.provinceOwnership||{}, factions:G.factions||{},
        treaties:G.treaties||[],
        trendsHistory:(G.trendsHistory||[]).slice(-30),
        opinionScore:G.opinionScore||50, lowOpinionTurns:G.lowOpinionTurns||0,
        highTreasuryTurns:G.highTreasuryTurns||0,
        fullHistory:G.fullHistory.slice(-50),
        actionHistory:G.actionHistory.slice(-20),
        conversations:G.conversations.map(c=>({...c,messages:c.messages.slice(-30)})),
        savedAt:Date.now()
      };
      upsertSave(snapshot);
      flashSaved();
    } catch(e) { console.warn('Save failed:', e); }
  };
  if (immediate) doSave();
  else _saveTimeout = setTimeout(doSave, 800);
}

function flashSaved() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 2000);
}

function renderLoadScreen() {
  getAllSaves(); // triggers migration
  const saves = JSON.parse(localStorage.getItem('orbis_saves')||'[]');
  const container = document.getElementById('save-list-container');
  if (!saves.length) { container.innerHTML='<div class="save-empty">Aucune sauvegarde trouvée.</div>'; return; }
  container.innerHTML = '';
  const list = document.createElement('div'); list.className='save-list';
  saves.forEach(save => {
    const d = new Date(save.savedAt);
    const dateStr = d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const diffLabel = DIFF_LABELS[save.difficulty] || 'Normal';
    const mods = save.modules ? Object.entries(save.modules).filter(([,v])=>v).map(([k])=>({ressources:'💰',opinion:'📢',geopolitique:'🌐',crises:'⚠',brouillard:'🌫',renseignement:'🕵'}[k]||'')).join('') : '';
    const item = document.createElement('div'); item.className='save-item';
    item.innerHTML = `
      <div class="save-flag">${FLAGS[save.nationCode]||'🌐'}</div>
      <div class="save-info">
        <div class="save-nation" style="display:flex;align-items:center;gap:0.4rem">
          ${escHtml(save.saveName || save.nation)}
          <button class="btn-rename-save" onclick="event.stopPropagation();renameSave('${save.id}')" title="Renommer" style="background:none;border:none;color:var(--text3);font-size:0.7rem;cursor:pointer;padding:0">✏</button>
        </div>
        <div class="save-meta">
          <span>📅 ${escHtml(save.date)}</span>
          <span>🔢 Tour ${save.turn}</span>
          <span class="save-diff-badge">${diffLabel}</span>
          ${mods?`<span>${mods}</span>`:''}
          <span style="color:var(--text3);font-size:0.58rem">${dateStr}</span>
        </div>
      </div>
      <div class="save-actions">
        <button class="btn-load-save" onclick="loadSave('${save.id}')">Charger</button>
        <button class="btn-del-save" onclick="confirmDeleteSave('${save.id}')">✕</button>
      </div>
    `;
    list.appendChild(item);
  });
  container.appendChild(list);
}

function renderSettingsScreen() {
  const inp = document.getElementById('settings-api-key');
  if (inp) inp.value = localStorage.getItem('orbis_apikey') || '';
}

// Auto-save API key from settings
document.addEventListener('change', e => {
  if (e.target.id === 'settings-api-key') {
    localStorage.setItem('orbis_apikey', e.target.value.trim());
  }
});

// ══════════════════════════════════════════
// ── Utils ──
// ══════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  const ta = document.getElementById('action-input');
  if (document.activeElement === ta && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const btn = document.getElementById('btn-exec');
    if (btn && !btn.disabled) submitAction();
  }
});

// ── Resizable panels ──
(function() {
  const rV = document.getElementById('resizer-v');
  const rightPanel = document.getElementById('right-panel');
  if (rV && rightPanel) {
    rV.addEventListener('mousedown', e => {
      e.preventDefault(); rV.classList.add('dragging');
      const startX=e.clientX, startW=rightPanel.offsetWidth;
      let raf=0;
      const onMove=e=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ rightPanel.style.width=Math.max(280,Math.min(700,startW+(startX-e.clientX)))+'px'; }); };
      const onUp=()=>{ cancelAnimationFrame(raf); rV.classList.remove('dragging'); document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); };
      document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
    });
  }
  const rH = document.getElementById('resizer-h');
  const newsPanel = document.querySelector('.panel-blk.news');
  if (rH && newsPanel) {
    rH.addEventListener('mousedown', e => {
      e.preventDefault(); rH.classList.add('dragging');
      const startY=e.clientY, startH=newsPanel.offsetHeight;
      let raf=0;
      const onMove=e=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ const h=Math.max(60,Math.min(window.innerHeight-180,startH+(e.clientY-startY))); newsPanel.style.flex='none'; newsPanel.style.height=h+'px'; }); };
      const onUp=()=>{ cancelAnimationFrame(raf); rH.classList.remove('dragging'); document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); };
      document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
    });
  }
})();
