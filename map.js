// ══ map.js — Globals, rendu D3, carte, fronts de guerre, event presenter ══

// ── UI state (pre-game) ──
let _currentDiff = 'normal';
let _jumpDuration = 'trimestre'; // semaine | mois | trimestre | semestre | an
const _mapOptions = { borders: true, labels: true, provinces: true };
let _brainstormOpen = false;
const _convPersonas = {}; // convId → persona string

// ── Event presentation system ──
let _eventPresQueue = [];
let _eventPresIndex = 0;
let _eventPresResolve = null;
let _pulseMarker = null;
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
  turnSnapshots: [],
  _gameOver: false
};
let d3svg, d3g, d3zoom, d3path, d3proj;
const d3centroids = {};
let d3countries = [];
let d3world = null;        // TopoJSON pays (pour mesh de frontières pays)
let d3provinces = [];      // features GeoJSON admin-1 enrichis (_provinceId, _countryCode)
const countryToProvinces = {}; // { countryCode: [provinceId, ...] }
let _provinceFeatMap = null;   // Map<provinceId, feature> — built after province load
const provinceAdjacency = {};  // { pid: Set([neighbor_pid, ...]) }
let _labelLayer = null;
let _provinceLayer = null;
let _provincesVisible = false;


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
  _provincesVisible = false;
  _labelLayer = null;
  _provinceLayer = null;
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

    // Certains territoires disputés (Kosovo, Chypre du Nord, Somaliland…) ont id=undefined
    // dans Natural Earth. On leur affecte le code jeu correspondant, ou on les filtre.
    const NE_NAME_TO_CODE = {
      'Kosovo': 9001, 'Somaliland': 9003, 'N. Cyprus': 9012,
    };
    d3countries = d3countries
      .map(feat => {
        if (feat.id === undefined || isNaN(+feat.id)) {
          const name = feat.properties?.name;
          const mapped = NE_NAME_TO_CODE[name];
          if (mapped) feat.id = mapped;
        }
        return feat;
      })
      .filter(feat => feat.id !== undefined && !isNaN(+feat.id));

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
    // Index rapide provinceId → feature pour lookups centroïdes
    _provinceFeatMap = new Map();
    d3provinces.forEach(f => _provinceFeatMap.set(f._provinceId, f));
    console.info(`[ORBIS] Provinces chargées: ${d3provinces.length}, Pays couverts: ${Object.keys(countryToProvinces).length}`);

    // ── Pré-calcul du graphe d'adjacence des provinces ──
    (function buildProvinceAdjacency() {
      const centroids = {};
      d3provinces.forEach(feat => {
        const c = d3path.centroid(feat);
        if (c && !isNaN(c[0])) centroids[feat._provinceId] = c;
      });
      const allPids = Object.keys(centroids);
      const THRESHOLD = 18;
      const THRESHOLD_SQ = THRESHOLD * THRESHOLD;
      allPids.forEach(pid => { provinceAdjacency[pid] = new Set(); });

      // Pass 1 : adjacence intra-pays (seuil standard)
      const pidsByCountry = {};
      d3provinces.forEach(feat => {
        const cc = feat._countryCode;
        if (cc == null || !centroids[feat._provinceId]) return;
        if (!pidsByCountry[cc]) pidsByCountry[cc] = [];
        pidsByCountry[cc].push(feat._provinceId);
      });
      Object.values(pidsByCountry).forEach(pids => {
        for (let i = 0; i < pids.length; i++) {
          const pidA = pids[i];
          const [ax, ay] = centroids[pidA];
          for (let j = i + 1; j < pids.length; j++) {
            const pidB = pids[j];
            const [bx, by] = centroids[pidB];
            const dx = ax - bx, dy = ay - by;
            if (dx * dx + dy * dy < THRESHOLD_SQ) {
              provinceAdjacency[pidA].add(String(pidB));
              provinceAdjacency[pidB].add(String(pidA));
            }
          }
        }
      });

      // Pass 2 : adjacence transfrontalière (seuil plus large)
      const CROSS_THRESHOLD = 50;
      const CROSS_THRESHOLD_SQ = CROSS_THRESHOLD * CROSS_THRESHOLD;
      const countryCodes = Object.keys(pidsByCountry).map(Number);
      for (let i = 0; i < countryCodes.length; i++) {
        const ccA = countryCodes[i];
        const pidsA = pidsByCountry[ccA];
        for (let j = i + 1; j < countryCodes.length; j++) {
          const ccB = countryCodes[j];
          const pidsB = pidsByCountry[ccB];
          // Skip si pays trop éloignés
          const centA = d3centroids[ccA], centB = d3centroids[ccB];
          if (centA && centB) {
            const cdx = centA[0] - centB[0], cdy = centA[1] - centB[1];
            if (cdx * cdx + cdy * cdy > 160000) continue;
          }
          const pairs = [];
          for (const pidA of pidsA) {
            const [ax, ay] = centroids[pidA];
            for (const pidB of pidsB) {
              const [bx, by] = centroids[pidB];
              const dx = ax - bx, dy = ay - by;
              const distSq = dx * dx + dy * dy;
              if (distSq < CROSS_THRESHOLD_SQ) {
                pairs.push({ pidA, pidB, distSq });
              }
            }
          }
          pairs.sort((a, b) => a.distSq - b.distSq);
          const maxPairs = Math.min(pairs.length, Math.max(10, Math.round(pairs.length * 0.3)));
          for (let k = 0; k < maxPairs; k++) {
            const { pidA, pidB } = pairs[k];
            provinceAdjacency[pidA].add(String(pidB));
            provinceAdjacency[pidB].add(String(pidA));
          }
        }
      }

      const orphans = allPids.filter(pid => provinceAdjacency[pid].size === 0);
      if (orphans.length) console.warn(`[ORBIS] ${orphans.length} provinces sans voisins (îles ou seuil trop bas)`);
      console.info(`[ORBIS] Graphe d'adjacence: ${allPids.length} provinces, seuil intra=${THRESHOLD}px, cross-border=${CROSS_THRESHOLD}px`);
    })();

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

    // Couche d'occupation (toujours visible, pas liée au zoom)
    d3g.append('g').attr('class','occ-layer');

    // Overlays guerre / factions — au-dessus de l'occupation, sous labels
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
  // Appliquer les guerres initiales : assigner les provinces par nom de zone
  if (G.warProgress && _provinceFeatMap) {
    Object.entries(G.warProgress).forEach(([defCode, wp]) => {
      const def = +defCode, atk = wp.attacker;
      const provs = countryToProvinces[def] || [];
      if (!provs.length || !wp.zones || !wp.zones.length) return;

      // Matching par nom de zone
      const matchedPids = new Set();
      for (const zone of wp.zones) {
        const zNorm = zone.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        for (const pid of provs) {
          const feat = _provinceFeatMap.get(pid);
          if (!feat) continue;
          const name = (feat.properties?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (name === zNorm || name.startsWith(zNorm) || zNorm.startsWith(name)) {
            matchedPids.add(pid);
          }
        }
      }

      for (const pid of matchedPids) {
        G.provinceOwnership[pid] = atk;
      }

    });
  }
}

// Retourne les provinces du défenseur adjacentes à une province déjà contrôlée par l'attaquant
function getConquerableFrontier(defCode, atkCode) {
  const defProvinces = countryToProvinces[defCode] || [];
  const stillDefended = defProvinces.filter(pid =>
    (G.provinceOwnership[pid] ?? defCode) === defCode
  );
  // Provinces contrôlées par l'attaquant (dans territoire défenseur + propre territoire)
  const atkControlled = new Set();
  defProvinces.forEach(pid => {
    if (G.provinceOwnership[pid] === atkCode) atkControlled.add(String(pid));
  });
  (countryToProvinces[atkCode] || []).forEach(pid => {
    if ((G.provinceOwnership[pid] ?? atkCode) === atkCode) atkControlled.add(String(pid));
  });

  const frontier = stillDefended.filter(pid => {
    const neighbors = provinceAdjacency[pid];
    if (!neighbors || !neighbors.size) return false;
    for (const nPid of neighbors) {
      if (atkControlled.has(String(nPid))) return true;
    }
    return false;
  });

  // Fallback si aucune frontière trouvée : provinces les plus proches des provinces attaquantes
  if (frontier.length === 0 && stillDefended.length > 0) {
    const atkCents = [];
    // Centroïdes des provinces de l'attaquant (frontière réelle, pas la capitale)
    (countryToProvinces[atkCode] || []).forEach(pid => {
      if ((G.provinceOwnership[pid] ?? atkCode) !== atkCode) return;
      const feat = _provinceFeatMap && _provinceFeatMap.get(pid);
      if (!feat) return;
      const c = d3path.centroid(feat);
      if (c && !isNaN(c[0])) atkCents.push(c);
    });
    // Provinces déjà conquises dans le territoire défenseur
    defProvinces.forEach(pid => {
      if (G.provinceOwnership[pid] !== atkCode) return;
      const feat = _provinceFeatMap && _provinceFeatMap.get(pid);
      if (!feat) return;
      const c = d3path.centroid(feat);
      if (c && !isNaN(c[0])) atkCents.push(c);
    });
    // Fallback ultime : capitale
    if (!atkCents.length) {
      const atkCap = CAPITALS[atkCode];
      if (atkCap && d3proj) atkCents.push(d3proj(atkCap));
    }
    if (atkCents.length) {
      const withDist = stillDefended.map(pid => {
        const feat = _provinceFeatMap && _provinceFeatMap.get(pid);
        if (!feat) return { pid, dist: Infinity };
        const c = d3path.centroid(feat);
        if (!c || isNaN(c[0])) return { pid, dist: Infinity };
        let minD = Infinity;
        for (const ac of atkCents) {
          const dx = c[0] - ac[0], dy = c[1] - ac[1];
          const d2 = dx * dx + dy * dy;
          if (d2 < minD) minD = d2;
        }
        return { pid, dist: minD };
      });
      withDist.sort((a, b) => a.dist - b.dist);
      return withDist.slice(0, 3).map(x => x.pid);
    }
    return stillDefended.slice(0, 3);
  }
  return frontier;
}

// Retourne les provinces occupées par l'attaquant adjacentes au territoire encore défendu (front côté défenseur)
function getLiberatableFrontier(defCode, atkCode) {
  const defProvinces = countryToProvinces[defCode] || [];
  const occupied = defProvinces.filter(pid => G.provinceOwnership[pid] === atkCode);
  if (!occupied.length) return [];
  const defSet = new Set(defProvinces.map(String));
  const liberatable = occupied.filter(pid => {
    const neighbors = provinceAdjacency[pid];
    if (!neighbors || !neighbors.size) return false;
    for (const nPid of neighbors) {
      if (defSet.has(String(nPid)) && (G.provinceOwnership[nPid] ?? defCode) === defCode) return true;
    }
    return false;
  });
  return liberatable.length > 0 ? liberatable : occupied;
}

// Redessine les frontières :
// - Frontières entre pays (TopoJSON mesh) : trait noir moyen
// - Contours des provinces occupées (différentes de leur pays d'origine) : trait rouge pulsant
let _borderPath = null; // cached country borders path
// updateBordersMesh supprimée — logique intégrée dans updateColors()

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
  const absCode = Math.abs(code);
  const hue = Math.round((absCode * 137.508) % 360);
  const hueAdj = (hue >= 200 && hue <= 230) ? (hue + 40) % 360 : hue;
  const mod5 = absCode % 5;
  const sat = 60 + mod5 * 8;
  const lig = 48 + mod5 * 6;
  const c = `hsl(${hueAdj},${sat}%,${lig}%)`;
  _neutralColorCache[code] = c;
  return c;
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
      // Faction icon — raised fist as SVG lines
      const fg = layer.append('g')
        .attr('transform', `translate(${c[0]},${c[1]+6})`)
        .attr('pointer-events','none').attr('opacity',0.85);
      fg.append('circle').attr('r',4).attr('fill','rgba(231,76,60,0.35)')
        .attr('stroke','#e74c3c').attr('stroke-width',0.7);
      fg.append('line').attr('x1',0).attr('y1',2).attr('x2',0).attr('y2',-2.5)
        .attr('stroke','#e74c3c').attr('stroke-width',1.2).attr('stroke-linecap','round');
      fg.append('line').attr('x1',-1.5).attr('y1',-1).attr('x2',1.5).attr('y2',-1)
        .attr('stroke','#e74c3c').attr('stroke-width',0.8).attr('stroke-linecap','round');
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

  updateColors(); updateCounters();
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

let _lastOccSignature = '';

function updateColors() {
  if (!d3g) return;

  // Fond pays
  d3g.selectAll('.country-base')
    .attr('fill', d => getCC(+d.id))
    .classed('country-war', d => G.relations[+d.id] === 'war');

  // Provinces occupées — ne redessiner que si l'ownership a changé
  if (G.provinceOwnership && d3provinces.length) {
    const occEntries = [];
    for (const f of d3provinces) {
      const o = G.provinceOwnership[f._provinceId];
      if (o != null && o !== f._countryCode) occEntries.push(f._provinceId + ':' + o);
    }
    const sig = occEntries.join('|');

    if (sig !== _lastOccSignature) {
      _lastOccSignature = sig;
      const occData = d3provinces.filter(f => {
        const o = G.provinceOwnership[f._provinceId];
        return o != null && o !== f._countryCode;
      });

      d3g.select('.occ-layer')
        .selectAll('.occ-prov')
        .data(occData, d => d._provinceId)
        .join(
          enter => enter.append('path')
            .attr('class', 'occ-prov')
            .attr('d', d3path)
            .attr('stroke', 'rgba(0,0,0,0.25)')
            .attr('stroke-width', 0.15)
            .attr('pointer-events', 'none'),
          update => update,
          exit => exit.remove()
        )
        .attr('fill', d => getCC(G.provinceOwnership[d._provinceId]));
    }
  }

  // Frontières nationales (une seule fois)
  if (!_borderPath && d3world) {
    _borderPath = d3g.append('path')
      .datum(topojson.mesh(d3world, d3world.objects.countries, (a, b) => a !== b))
      .attr('class', 'country-borders')
      .attr('d', d3path).attr('fill', 'none')
      .attr('stroke', '#0d1520').attr('stroke-width', 0.7)
      .attr('pointer-events', 'none');
  }
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
// ── Event Presenter (one-by-one with Next) ──
// ══════════════════════════════════════════

// Sorted country names by length descending for greedy matching
const _sortedNames = Object.entries(NAMES)
  .filter(([,n]) => n && n.length > 3)
  .sort(([,a],[,b]) => b.length - a.length);

function _findEventCountry(ev) {
  const fullText = (ev.titre || '') + ' ' + (ev.texte || '');
  for (const [code, name] of _sortedNames) {
    if (fullText.includes(name)) return +code;
  }
  return null;
}

function _showPulseMarker(code) {
  if (!d3g) return null;
  const c = d3centroids[code];
  if (!c || isNaN(c[0])) return null;

  const g = d3g.append('g').attr('class', 'pulse-marker').style('pointer-events', 'none');
  // Inner solid dot
  g.append('circle')
    .attr('cx', c[0]).attr('cy', c[1])
    .attr('r', 3).attr('fill', '#ff6b35').attr('opacity', 0.95);
  // Static ring
  g.append('circle')
    .attr('cx', c[0]).attr('cy', c[1])
    .attr('r', 5).attr('fill', 'none')
    .attr('stroke', '#ff6b35').attr('stroke-width', 1.2).attr('opacity', 0.7);

  // Réutilise un seul cercle au lieu d'en créer un nouveau chaque cycle
  const pulseCircle = g.append('circle')
    .attr('cx', c[0]).attr('cy', c[1])
    .attr('fill', 'none')
    .attr('stroke', '#ff6b35').attr('stroke-width', 1.5);
  let _pulseTimer = null;
  function pulse() {
    pulseCircle.interrupt()
      .attr('r', 5).attr('opacity', 0.8)
      .transition().duration(1400)
      .attr('r', 18).attr('opacity', 0);
  }
  pulse();
  _pulseTimer = setInterval(pulse, 1500);

  return { remove() { clearInterval(_pulseTimer); g.remove(); } };
}

function _showEventStep(index) {
  const ev = _eventPresQueue[index];
  if (!ev) return;
  const total = _eventPresQueue.length;

  // Update presenter UI
  const prog = document.getElementById('ep-progress');
  if (prog) prog.textContent = `${index + 1} / ${total}`;

  const cat = (ev.categorie || 'DIVERS').toUpperCase();
  const catEl = document.getElementById('ep-cat');
  if (catEl) {
    catEl.className = 'ep-cat-badge ' + (CAT_CLASS[cat] || 'cat-misc');
    catEl.textContent = cat;
  }
  const titleEl = document.getElementById('ep-title');
  if (titleEl) titleEl.textContent = ev.titre || 'Événement';
  const bodyEl = document.getElementById('ep-body');
  if (bodyEl) bodyEl.textContent = ev.texte || '';

  const btn = document.getElementById('ep-next-btn');
  if (btn) btn.textContent = index === total - 1 ? 'Terminer ✓' : 'Suivant →';

  // Add to news feed immediately
  addNewsEvent(ev);

  // Camera + pulse marker
  if (_pulseMarker) { _pulseMarker.remove(); _pulseMarker = null; }
  const code = _findEventCountry(ev);
  if (code) {
    locateCountry(code);
    setTimeout(() => { _pulseMarker = _showPulseMarker(code); }, 820);
  }
}

function startEventPresentation(events) {
  return new Promise(resolve => {
    if (!events || events.length === 0) { resolve(); return; }
    _eventPresQueue = events;
    _eventPresIndex = 0;
    _eventPresResolve = resolve;
    const pres = document.getElementById('event-presenter');
    if (pres) pres.classList.add('active');
    _showEventStep(0);
  });
}

function nextEventStep() {
  _eventPresIndex++;
  if (_eventPresIndex >= _eventPresQueue.length) {
    _endEventPresentation();
  } else {
    _showEventStep(_eventPresIndex);
  }
}

function _endEventPresentation() {
  const pres = document.getElementById('event-presenter');
  if (pres) pres.classList.remove('active');
  if (_pulseMarker) { _pulseMarker.remove(); _pulseMarker = null; }
  _eventPresQueue = [];
  _eventPresIndex = 0;
  if (_eventPresResolve) { _eventPresResolve(); _eventPresResolve = null; }
}

