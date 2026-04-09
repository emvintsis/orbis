// ══ map-leaflet.js — Leaflet-based map rendering (replaces map.js) ══

// ── UI state (pre-game) ──
let _currentDiff = 'normal';
let _jumpDuration = 'trimestre'; // semaine | mois | trimestre | semestre | an
const _mapOptions = { borders: true, labels: true, provinces: true, capitals: true };
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

// ── Leaflet map primitives ──
let leafletMap = null;
let countryLayer = null;
let _provinceLayer = null;
let _regionLayer = null;
let _factionLayer = null;
let _labelLayer = null;       // L.layerGroup for country labels (large)
let _smallLabelLayer = null;  // L.layerGroup for country labels (medium, zoom >= 4)
let _tinyLabelLayer = null;   // L.layerGroup for country labels (small, zoom >= 5)
let _labelTiers = [];         // [tier0, tier1, tier2] layer groups
let _provincesVisible = false;
let _borderLayer = null;
let _capitalLayer = null;
let _battalionLayer = null;
let _countryAreaDeg = {};

// ── Legacy globals (used by other files: turns.js, diplomacy.js, ui.js) ──
// d3svg, d3g, d3zoom kept as non-null sentinels so `if (!d3svg) return;` checks pass
// d3path, d3proj replaced by Leaflet equivalents
let d3svg = null;   // set to truthy after init
let d3g = null;     // set to truthy after init — SVG overlay group for FX
let d3zoom = null;  // compatibility stub
let d3path = null;  // not used with Leaflet
let d3proj = null;  // not used with Leaflet

const d3centroids = {};        // code → [lat, lng] (geographic, for Leaflet)
let d3countries = [];          // GeoJSON features array
let d3world = null;            // raw TopoJSON data
let d3provinces = [];          // GeoJSON features enriched with _provinceId, _countryCode
const countryToProvinces = {}; // { countryCode: [provinceId, ...] }
let _provinceFeatMap = null;   // Map<provinceId, feature>
const provinceAdjacency = {};  // { pid: Set([neighbor_pid, ...]) }

// ISO 3166-1 alpha-3 → numérique
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
  TMP:626,ZAR:180,ROM:642,GBR:826,
  KOS:383,SDS:728,PRI:630,
  SCG:891,VAT:336,XKO:983,
  HKG:344,MAC:446,GRL:304,FRO:234,GIB:292,BMU:60,CYM:136,
  VGB:92,VIR:850,GUM:316,MNP:580,AIA:660,MSR:500,TCA:796,
  BLM:652,MAF:663,SXM:534,CUW:531,FLK:238,SGS:239,SHN:654,
  GGY:831,JEY:832,IMN:833,NFK:574,PCN:612,ATA:10,
};

// ══════════════════════════════════════════
// ── Country label min area threshold ──
// ══════════════════════════════════════════
const LABEL_MIN_AREA = 3000; // px² (used for D3-based area calc during init)

// ── Neutral color cache ──
const _neutralColorCache = {};
let _convCodesCache = null;
function _invalidateConvCache() { _convCodesCache = null; }
function _getConvCodes() {
  if (!_convCodesCache) {
    _convCodesCache = new Set();
    for (const c of G.conversations) for (const n of c.nations) _convCodesCache.add(n.code);
  }
  return _convCodesCache;
}

// Palette de 40 couleurs douces, style cartographique (pas de doublons)
const COUNTRY_PALETTE = [
  '#7b9e6b', '#c4956a', '#6a8caf', '#b07a9b', '#8f8b6e',
  '#5d9a8f', '#c47a6a', '#7a7fb0', '#a89a5a', '#6bb09a',
  '#9a6a7a', '#6a9abf', '#b0a07a', '#7aaf7a', '#af7a5a',
  '#5a8a9a', '#9a8a5a', '#7a6a8f', '#8aaf6a', '#af8a7a',
  '#6a7aaf', '#9aaf8a', '#af6a8a', '#8a9a6a', '#7a8aaf',
  '#af9a6a', '#6aaf9a', '#9a7aaf', '#af8a5a', '#5aaf8a',
  '#8a6aaf', '#af6a6a', '#6aaf6a', '#9a9aaf', '#af9a8a',
  '#6a8a6a', '#8aaf9a', '#af7a8a', '#7aaf8a', '#9a6aaf'
];

function getCC(code) {
  // Pays absorbé → couleur de l'absorbeur
  if (G.absorbedCountries && G.absorbedCountries[code]) {
    return getCC(+G.absorbedCountries[code]);
  }

  // Le joueur garde sa couleur accent
  if (code === G.nationCode) return '#d4920a';

  // Brouillard de guerre
  if (G.modules?.brouillard) {
    const rel = G.relations[code];
    if ((!rel || rel === 'neutral') && !_getConvCodes().has(code)) return '#0a0e14';
  }

  // Couleur custom définie dans G.countries
  if (G.countries?.[code]?.color) return G.countries[code].color;

  // Couleur unique et stable basée sur le code pays
  if (_neutralColorCache[code]) return _neutralColorCache[code];

  // Hash stable via golden ratio → index dans la palette (pas de troncature 32 bits)
  const hash = ((code * 137.508) % COUNTRY_PALETTE.length + COUNTRY_PALETTE.length) % COUNTRY_PALETTE.length;
  const idx = Math.floor(hash);
  const c = COUNTRY_PALETTE[idx];

  _neutralColorCache[code] = c;
  return c;
}

function getRegionStyle(feature) {
  const owner = feature.properties.owner;
  const z = leafletMap ? leafletMap.getZoom() : 3;
  const fill = getCC(owner);

  if (z < 5) {
    // Dézoomé : stroke même couleur que fill pour couvrir les gaps d'anti-aliasing Canvas
    return {
      fillColor: fill, fillOpacity: 1,
      stroke: true, color: fill, weight: 1.5, opacity: 1
    };
  } else if (z < 7) {
    return {
      fillColor: fill, fillOpacity: 0.92,
      stroke: true, color: 'rgba(13,21,32,0.15)', weight: 0.4, opacity: 0.15
    };
  } else {
    return {
      fillColor: fill, fillOpacity: 0.92,
      stroke: true, color: 'rgba(13,21,32,0.4)', weight: 0.5, opacity: 0.4
    };
  }
}

function getCountryName(code) {
  return G.countries?.[code]?.name || NAMES[code] || String(code);
}

function getCountryFlag(code) {
  return G.countries?.[code]?.flag || FLAGS[code] || '🌐';
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

// ══════════════════════════════════════════
// ── Leaflet country layer index ──
// ══════════════════════════════════════════
const _countryLayerIndex = {}; // code → Leaflet layer reference

// ══════════════════════════════════════════
// ── Geographic centroid calculation ──
// ══════════════════════════════════════════
function _geoCentroid(feature) {
  // Calculate geographic centroid from GeoJSON coordinates
  // Simple average of all coordinates (works for most cases)
  let sumLon = 0, sumLat = 0, count = 0;
  function walk(coords, depth) {
    if (depth === 0) {
      sumLon += coords[0]; sumLat += coords[1]; count++;
    } else {
      for (const c of coords) walk(c, depth - 1);
    }
  }
  const geom = feature.geometry || feature;
  if (geom.type === 'Polygon') walk(geom.coordinates, 2);
  else if (geom.type === 'MultiPolygon') walk(geom.coordinates, 3);
  else if (geom.type === 'Point') { sumLon = geom.coordinates[0]; sumLat = geom.coordinates[1]; count = 1; }
  if (count === 0) return null;
  return [sumLat / count, sumLon / count]; // [lat, lng] for Leaflet
}

// ══════════════════════════════════════════
// ── Antimeridian fix ──
// ══════════════════════════════════════════
function fixAntimeridian(feature) {
  function fixCoords(coords) {
    let hasPositive = false, hasNegative = false;
    for (const c of coords) {
      if (Array.isArray(c[0])) return coords.map(fixCoords);
      if (c[0] > 160) hasPositive = true;
      if (c[0] < -160) hasNegative = true;
    }
    if (hasPositive && hasNegative) {
      return coords.map(c => {
        if (Array.isArray(c[0])) return fixCoords(c);
        return c[0] < 0 ? [c[0] + 360, c[1]] : c;
      });
    }
    return coords;
  }

  const geom = feature.geometry;
  if (!geom) return feature;
  const fixed = { ...feature, geometry: { ...geom } };
  if (geom.type === 'Polygon') {
    fixed.geometry.coordinates = fixCoords(geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    fixed.geometry.coordinates = geom.coordinates.map(poly => fixCoords(poly));
  }
  return fixed;
}

// ══════════════════════════════════════════
// ── Map initialization ──
// ══════════════════════════════════════════

function initMap() {
  const wrap = document.getElementById('map-wrap');
  if (!wrap) return;

  // Remove any previous map
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }

  const container = document.getElementById('map-container');
  if (!container) return;

  // Create Leaflet map
  leafletMap = L.map('map-container', {
    center: [20, 0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 8,
    zoomControl: false,
    attributionControl: false,
    worldCopyJump: true,
    preferCanvas: true
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_noannotation/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(leafletMap);

  // Set legacy sentinels so other files' null checks pass
  d3svg = { _leaflet: true };
  d3g = { _leaflet: true };
  d3zoom = { _leaflet: true };

  // Tooltip
  const tt = document.getElementById('map-tt');

  // Loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.35);font-size:13px;font-family:Inter,sans-serif;z-index:1000;pointer-events:none;';
  loadingDiv.textContent = 'Chargement des provinces\u2026';
  container.appendChild(loadingDiv);

  const PROVINCE_ZOOM_THRESHOLD = 5;

  // Load data in parallel
  Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json').then(r => r.json()),
    fetch('admin1.topojson?v=' + Date.now()).then(r => r.json())
  ]).then(([worldData, provTopoData]) => {
    loadingDiv.remove();
    d3world = worldData;

    // ── Convert TopoJSON → GeoJSON countries ──
    d3countries = topojson.feature(worldData, worldData.objects.countries).features;

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

    // Filter inverted polygons but KEEP large countries (Russia, USA, Canada, etc.)
    const LARGE_COUNTRY_IDS = new Set([643, 840, 124, 156, 76, 36, 356]); // RUS, USA, CAN, CHN, BRA, AUS, IND
    d3countries = d3countries.filter(feat => {
      if (LARGE_COUNTRY_IDS.has(+feat.id)) return true; // never filter these
      const b = L.geoJSON(feat).getBounds();
      const latSpan = b.getNorth() - b.getSouth();
      const lngSpan = b.getEast() - b.getWest();
      if (latSpan > 160 || lngSpan > 300) {
        console.warn('Inverted polygon excluded:', feat.id, feat.properties?.name);
        return false;
      }
      return true;
    });

    // Calculate geographic centroids for countries
    d3countries.forEach(d => {
      const code = +d.id;
      // Prefer capital coordinates (accurate for large countries)
      if (CAPITALS[code]) {
        d3centroids[code] = [CAPITALS[code][1], CAPITALS[code][0]]; // [lat, lng]
      } else {
        // Fallback: bounds center (better than coordinate average for irregular shapes)
        try {
          const b = L.geoJSON(d).getBounds();
          if (b.isValid()) d3centroids[code] = [b.getCenter().lat, b.getCenter().lng];
        } catch(e) {}
      }
      // Ultimate fallback
      if (!d3centroids[code]) {
        const c = _geoCentroid(d);
        if (c) d3centroids[code] = c;
      }
    });

    // Precompute geographic area (rough, in sq degrees) for label filtering
    _countryAreaDeg = {};
    d3countries.forEach(feat => {
      const b = L.geoJSON(feat).getBounds();
      const latSpan = b.getNorth() - b.getSouth();
      const lngSpan = b.getEast() - b.getWest();
      _countryAreaDeg[+feat.id] = latSpan * lngSpan;
    });

    // Fix antimeridian pour les pays qui traversent le 180°
    const ANTIMERIDIAN_COUNTRIES = new Set([643, 840, 242, 296, 776, 798, 882, 548, 90, 584, 583, 585]);
    d3countries = d3countries.map(feat => {
      if (ANTIMERIDIAN_COUNTRIES.has(+feat.id)) return fixAntimeridian(feat);
      return feat;
    });

    // ── Country data (invisible — kept for centroids/labels/borders only) ──
    countryLayer = L.geoJSON({type:'FeatureCollection', features: d3countries}, {
      style: () => ({ fillOpacity: 0, stroke: false, interactive: false }),
      interactive: false
    });
    // NOT added to map — _regionLayer handles all rendering

    // Borders removed — province colors + ocean provide natural boundaries

    // ── Province features ──
    const provFeatures = provTopoData.objects.provinces.geometries.map(geom => {
      const merged = topojson.merge(provTopoData, [geom]);
      return {
        type: 'Feature',
        properties: geom.properties || {},
        geometry: merged
      };
    });

    // Index country features for bbox containment check
    const countryByCode = {};
    d3countries.forEach(c => { countryByCode[+c.id] = c; });

    // Associate provinces to parent countries
    d3provinces = [];
    Object.keys(countryToProvinces).forEach(k => delete countryToProvinces[k]);

    provFeatures.forEach((feat, i) => {
      const pid = feat.properties?.ne_id || i;
      feat._provinceId = pid;

      const a3 = feat.properties?.adm0_a3 || feat.properties?.gu_a3 || '';
      let parentCode = ISO3_TO_NUM[a3] || null;

      // Fallback: centroid containment
      if (!parentCode) {
        const centroid = _geoCentroid(feat);
        if (centroid) {
          const [lat, lon] = centroid;
          for (const cf of d3countries) {
            // Simple bbox check then containment
            const bounds = L.geoJSON(cf).getBounds();
            if (bounds.contains([lat, lon])) {
              parentCode = +cf.id;
              break;
            }
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

    // Diagnostic
    const countriesWithoutProvinces = d3countries
      .map(c => +c.id)
      .filter(code => NAMES[code] && !countryToProvinces[code]);
    if (countriesWithoutProvinces.length) {
      console.warn(`[ORBIS] ${countriesWithoutProvinces.length} pays sans provinces:`,
        countriesWithoutProvinces.map(c => `${c}=${NAMES[c]}`));
    }

    _provinceFeatMap = new Map();
    d3provinces.forEach(f => _provinceFeatMap.set(f._provinceId, f));
    console.info(`[ORBIS] Provinces chargées: ${d3provinces.length}, Pays couverts: ${Object.keys(countryToProvinces).length}`);

    // ── Province centroids (geographic [lat, lng]) ──
    const _provCentroids = {};
    d3provinces.forEach(feat => {
      const c = _geoCentroid(feat);
      if (c) _provCentroids[feat._provinceId] = c;
    });

    // ── Adjacency graph ──
    (function buildProvinceAdjacency() {
      const allPids = Object.keys(_provCentroids);
      // Use degree-based thresholds (approx equivalent to pixel thresholds at the original D3 scale)
      const THRESHOLD = 7;       // degrees, intra-country
      const THRESHOLD_SQ = THRESHOLD * THRESHOLD;
      allPids.forEach(pid => { provinceAdjacency[pid] = new Set(); });

      // Pass 1: intra-country
      const pidsByCountry = {};
      d3provinces.forEach(feat => {
        const cc = feat._countryCode;
        if (cc == null || !_provCentroids[feat._provinceId]) return;
        if (!pidsByCountry[cc]) pidsByCountry[cc] = [];
        pidsByCountry[cc].push(feat._provinceId);
      });
      Object.values(pidsByCountry).forEach(pids => {
        for (let i = 0; i < pids.length; i++) {
          const pidA = pids[i];
          const [aLat, aLon] = _provCentroids[pidA];
          for (let j = i + 1; j < pids.length; j++) {
            const pidB = pids[j];
            const [bLat, bLon] = _provCentroids[pidB];
            const dLat = aLat - bLat, dLon = aLon - bLon;
            if (dLat * dLat + dLon * dLon < THRESHOLD_SQ) {
              provinceAdjacency[pidA].add(String(pidB));
              provinceAdjacency[pidB].add(String(pidA));
            }
          }
        }
      });

      // Pass 2: cross-border
      const CROSS_THRESHOLD = 18;
      const CROSS_THRESHOLD_SQ = CROSS_THRESHOLD * CROSS_THRESHOLD;
      const countryCodes = Object.keys(pidsByCountry).map(Number);
      for (let i = 0; i < countryCodes.length; i++) {
        const ccA = countryCodes[i];
        const pidsA = pidsByCountry[ccA];
        for (let j = i + 1; j < countryCodes.length; j++) {
          const ccB = countryCodes[j];
          const pidsB = pidsByCountry[ccB];
          // Skip distant countries
          const centA = d3centroids[ccA], centB = d3centroids[ccB];
          if (centA && centB) {
            const cdLat = centA[0] - centB[0], cdLon = centA[1] - centB[1];
            if (cdLat * cdLat + cdLon * cdLon > 3600) continue; // ~60 degrees
          }
          const pairs = [];
          for (const pidA of pidsA) {
            const [aLat, aLon] = _provCentroids[pidA];
            for (const pidB of pidsB) {
              const [bLat, bLon] = _provCentroids[pidB];
              const dLat = aLat - bLat, dLon = aLon - bLon;
              const distSq = dLat * dLat + dLon * dLon;
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
      if (orphans.length) console.warn(`[ORBIS] ${orphans.length} provinces sans voisins`);
      console.info(`[ORBIS] Graphe d'adjacence: ${allPids.length} provinces, seuil intra=${THRESHOLD}°, cross-border=${CROSS_THRESHOLD}°`);
    })();

    // ── Province layer (borders only, visible at zoom >= 5) ──
    _provinceLayer = L.geoJSON({type:'FeatureCollection', features: d3provinces}, {
      style: {
        fillColor: 'transparent',
        fillOpacity: 0,
        color: 'rgba(0,0,0,0.15)',
        weight: 0.5,
        interactive: false
      },
      interactive: false
    });
    // Start hidden, show on zoom
    leafletMap.on('zoomend', () => {
      const z = leafletMap.getZoom();
      const shouldShow = z >= PROVINCE_ZOOM_THRESHOLD;
      if (shouldShow !== _provincesVisible) {
        _provincesVisible = shouldShow;
        if (shouldShow && _mapOptions.provinces) {
          leafletMap.addLayer(_provinceLayer);
        } else {
          leafletMap.removeLayer(_provinceLayer);
        }
      }
    });

    // ── Faction overlay layer ──
    _factionLayer = L.layerGroup().addTo(leafletMap);

    // ── Labels pays — 3 niveaux de zoom ──
    _labelTiers = [
      L.layerGroup(), // tier 0 : toujours visible (zoom 2+) — ~15 grands pays
      L.layerGroup(), // tier 1 : zoom 4+ — ~30 pays moyens
      L.layerGroup(), // tier 2 : zoom 5+ — le reste
    ];

    const TIER0 = new Set([840,643,156,356,76,124,36,392,484,710,360]);

    d3countries.forEach(feat => {
      const code = +feat.id;
      if (!NAMES[code]) return;
      const center = d3centroids[code];
      if (!center) return;
      const name = NAMES[code];
      const area = _countryAreaDeg[code] || 0;

      let tier;
      if (TIER0.has(code)) tier = 0;
      else if (area >= 20) tier = 1;
      else if (area >= 2) tier = 2;
      else return;

      const cls = tier === 0 ? 'label-xl' : tier === 1 ? 'label-lg' : 'label-md';
      const label = name.toUpperCase();

      const divIcon = L.divIcon({
        className: 'leaflet-country-label ' + cls,
        html: `<span>${label}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      L.marker(center, { icon: divIcon, interactive: false }).addTo(_labelTiers[tier]);
    });

    if (_mapOptions.labels) _labelTiers[0].addTo(leafletMap);
    _labelLayer = _labelTiers[0];

    leafletMap.on('zoomend', () => {
      if (!_mapOptions.labels) return;
      const z = leafletMap.getZoom();
      if (z >= 4) { if (!leafletMap.hasLayer(_labelTiers[1])) leafletMap.addLayer(_labelTiers[1]); }
      else { leafletMap.removeLayer(_labelTiers[1]); }
      if (z >= 5) { if (!leafletMap.hasLayer(_labelTiers[2])) leafletMap.addLayer(_labelTiers[2]); }
      else { leafletMap.removeLayer(_labelTiers[2]); }
    });

    // ── Capitales ──
    _capitalLayer = L.layerGroup();
    if (typeof CAPITALS !== 'undefined') {
      Object.entries(CAPITALS).forEach(([code, coords]) => {
        code = +code;
        if (!NAMES[code]) return;
        const [lng, lat] = coords;
        const isPlayer = code === G.nationCode;
        const rel = G.relations[code];
        const isWar = rel === 'war';
        const icon = L.divIcon({
          className: 'capital-marker' + (isPlayer ? ' capital-player' : '') + (isWar ? ' capital-war' : ''),
          html: '\u2605',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });
        const marker = L.marker([lat, lng], { icon, interactive: true });
        marker.bindTooltip(`${FLAGS[code]||''} ${NAMES[code]} — Capitale`, {
          className: 'capital-tooltip', direction: 'top', offset: [0, -8]
        });
        marker.addTo(_capitalLayer);
      });
    }
    if (_mapOptions.capitals) _capitalLayer.addTo(leafletMap);

    // ── Bataillons ──
    _battalionLayer = L.layerGroup().addTo(leafletMap);

    // Store province centroids for use by getConquerableFrontier etc.
    window._provCentroids = _provCentroids;

    initializeOwnership();
    initRegionsFromProvinces();

    // ── Region layer (source de vérité visuelle — chaque province colorée par owner) ──
    _regionLayer = L.geoJSON(
      { type: 'FeatureCollection', features: G.regions.map(r => ({
          type: 'Feature',
          geometry: r.geometry,
          properties: { id: r.id, owner: r.owner, originalOwner: r.originalOwner, name: r.name }
      }))},
      {
        style: getRegionStyle,
        onEachFeature: (feature, layer) => {
          layer.on('mouseover', e => {
            const owner = feature.properties.owner;
            const name = getCountryName(owner);
            const regionName = feature.properties.name;
            const rel = G.relations[owner];
            const relLabel = (owner === G.nationCode) ? 'Votre Nation' : (rel ? REL_LABELS[rel] : 'Neutre');
            document.getElementById('tt-n').textContent = (getCountryFlag(owner)||'') + ' ' + name;
            document.getElementById('tt-r').textContent = regionName + ' · ' + relLabel;
            tt.style.display = 'block';
            layer.setStyle({ fillOpacity: 0.95, weight: 1.5 });
          });
          layer.on('mousemove', e => {
            const pt = leafletMap.latLngToContainerPoint(e.latlng);
            tt.style.left = (pt.x+12)+'px'; tt.style.top = (pt.y-10)+'px';
          });
          layer.on('mouseout', e => {
            tt.style.display = 'none';
            layer.setStyle(getRegionStyle(feature));
          });
          layer.on('click', e => {
            const owner = feature.properties.owner;
            if (owner !== G.nationCode) openConvWith(owner, getCountryName(owner));
          });
        }
      }
    ).addTo(leafletMap);

    // Update region border styles on zoom
    leafletMap.on('zoomend', () => {
      if (_regionLayer) {
        _regionLayer.eachLayer(layer => {
          const s = getRegionStyle(layer.feature);
          layer.setStyle({ stroke: s.stroke, color: s.color, weight: s.weight, opacity: s.opacity });
        });
      }
    });

    updateColors();
    updateMapConvState();
  }).catch(err => {
    loadingDiv.textContent = 'Erreur de chargement \u2014 v\u00e9rifiez la connexion';
    console.error('Map load error:', err);
  });
}

// ══════════════════════════════════════════
// ── Province ownership ──
// ══════════════════════════════════════════

function initializeOwnership() {
  if (!d3provinces.length) return;
  if (Object.keys(G.provinceOwnership || {}).length > 0) return;
  G.provinceOwnership = {};
  d3provinces.forEach(feat => {
    G.provinceOwnership[feat._provinceId] = feat._countryCode;
  });
  // Apply initial wars by zone name matching
  if (G.warProgress && _provinceFeatMap) {
    Object.entries(G.warProgress).forEach(([defCode, wp]) => {
      const def = +defCode, atk = wp.attacker;
      const provs = countryToProvinces[def] || [];
      if (!provs.length || !wp.zones || !wp.zones.length) return;

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

function initRegionsFromProvinces() {
  if (G.regions && G.regions.length > 0) return; // déjà chargé (save)
  G.regions = d3provinces.map(feat => ({
    id: 'reg_' + feat._provinceId,
    name: feat.properties?.name || 'Inconnu',
    owner: G.provinceOwnership[feat._provinceId] ?? feat._countryCode,
    originalOwner: feat._countryCode,
    type: 'land',
    geometry: feat.geometry,
    features: []
  }));

  // Ajouter les capitales comme features
  if (typeof CAPITALS !== 'undefined') {
    Object.entries(CAPITALS).forEach(([code, coords]) => {
      code = +code;
      if (!NAMES[code]) return;
      const [lng, lat] = coords;
      let bestReg = null, bestDist = Infinity;
      G.regions.forEach(reg => {
        if (reg.owner !== code && reg.originalOwner !== code) return;
        const cent = _geoCentroid(reg);
        if (!cent) return;
        const d = (cent[0] - lat) ** 2 + (cent[1] - lng) ** 2;
        if (d < bestDist) { bestDist = d; bestReg = reg; }
      });
      if (bestReg) {
        bestReg.features.push({ type: 'capital', name: NAMES[code], lat, lng });
      }
    });
  }

  console.info(`[ORBIS] ${G.regions.length} régions initialisées`);
}

function syncOwnershipFromRegions() {
  if (!G.regions) return;
  G.provinceOwnership = {};
  G.regions.forEach(r => {
    const pid = r.id.replace('reg_', '');
    G.provinceOwnership[pid] = r.owner;
  });
}

// ══════════════════════════════════════════
// ── Map changes (dynamic map) ──
// ══════════════════════════════════════════

// Alias de noms de régions : noms historiques/courants → noms admin1 officiels
const REGION_ALIASES = {
  // France (régions post-2016)
  'alsace': 'grand est', 'lorraine': 'grand est', 'champagne': 'grand est',
  'picardie': 'hauts-de-france', 'nord-pas-de-calais': 'hauts-de-france', 'nord': 'hauts-de-france',
  'languedoc': 'occitanie', 'midi-pyrenees': 'occitanie', 'toulouse': 'occitanie',
  'aquitaine': 'nouvelle-aquitaine', 'limousin': 'nouvelle-aquitaine', 'poitou': 'nouvelle-aquitaine', 'poitou-charentes': 'nouvelle-aquitaine',
  'rhone-alpes': 'auvergne-rhone-alpes', 'auvergne': 'auvergne-rhone-alpes', 'lyon': 'auvergne-rhone-alpes',
  'bourgogne': 'bourgogne-franche-comte', 'franche-comte': 'bourgogne-franche-comte',
  'basse-normandie': 'normandie', 'haute-normandie': 'normandie',
  // Espagne
  'catalogne': 'cataluna', 'pays basque': 'pais vasco', 'andalousie': 'andalucia',
  'galice': 'galicia', 'castille': 'castilla y leon', 'valence': 'comunidad valenciana',
  // Italie
  'lombardie': 'lombardia', 'toscane': 'toscana', 'sardaigne': 'sardegna', 'sicile': 'sicilia',
  'piemont': 'piemonte', 'venetie': 'veneto',
  // Allemagne
  'baviere': 'bayern', 'rhenanie': 'nordrhein-westfalen', 'saxe': 'sachsen',
  'basse-saxe': 'niedersachsen', 'hesse': 'hessen',
  // Royaume-Uni
  'angleterre': 'england', 'ecosse': 'scotland', 'pays de galles': 'wales',
  // Russie
  'siberie': 'siberia', 'caucase': 'caucasus',
  // Chine
  'tibet': 'xizang', 'mandchourie': 'heilongjiang',
};

function findRegionByName(name) {
  if (!name || !G.regions) return null;
  const norm = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Recherche directe
  let found = G.regions.find(r =>
    r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === norm
  );
  if (found) return found;
  // Recherche par alias
  const alias = REGION_ALIASES[norm];
  if (alias) {
    found = G.regions.find(r =>
      r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === alias
    );
    if (found) return found;
  }
  // Recherche par préfixe/contenu
  found = G.regions.find(r => {
    const rn = r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return rn.startsWith(norm) || norm.startsWith(rn);
  });
  if (found) return found;
  // Recherche par inclusion (le nom recherché est contenu dans le nom de la région ou vice-versa)
  found = G.regions.find(r => {
    const rn = r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return rn.includes(norm) || norm.includes(rn);
  });
  return found || null;
}

function findCountryByName(name) {
  if (!name) return null;
  const norm = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [code, c] of Object.entries(G.countries || {})) {
    if (c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === norm) return +code;
  }
  for (const [code, n] of Object.entries(NAMES)) {
    if (n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === norm) return +code;
  }
  return null;
}

function _addMapNewsEvent(cat, titre, texte) {
  const el = document.createElement('div');
  el.className = `ne cat-${cat.toLowerCase()}`;
  el.innerHTML = `
    <div class="ne-top"><span class="ne-cat cat-${cat.toLowerCase()}">${cat.toUpperCase()}</span><span class="ne-time">${escHtml(G.date)} · Tour ${G.turn}</span></div>
    <div class="ne-title">${escHtml(titre)}</div>
    <div class="ne-body">${escHtml(texte)}</div>`;
  const feed = document.getElementById('news-feed');
  if (feed) { feed.appendChild(el); feed.scrollTop = feed.scrollHeight; }
  G.fullHistory.push({ type: 'event', cat: cat.toUpperCase(), titre, texte, date: G.date, turn: G.turn });
}

function applyMapChange(mc) {
  switch (mc.type) {

    case 'transfer': {
      const regionName = mc.region;
      const newOwnerName = mc.new_owner;
      if (!regionName || !newOwnerName) return;
      const reg = findRegionByName(regionName);
      if (!reg) { console.warn(`[MAP] Région "${regionName}" introuvable`); return; }
      const newOwnerCode = findCountryByName(newOwnerName);
      if (!newOwnerCode) { console.warn(`[MAP] Pays "${newOwnerName}" introuvable`); return; }
      const prevOwner = reg.owner;
      reg.owner = newOwnerCode;
      console.info(`[MAP] Transfert: ${reg.name} — ${getCountryName(prevOwner)} → ${getCountryName(newOwnerCode)}`);
      _addMapNewsEvent('militaire',
        `${getCountryFlag(newOwnerCode)} ${getCountryName(newOwnerCode)} prend le contrôle de ${reg.name}`,
        `La région de ${reg.name}, anciennement sous contrôle de ${getCountryName(prevOwner)}, passe sous souveraineté de ${getCountryName(newOwnerCode)}.`
      );
      syncOwnershipFromRegions();
      updateColors();
      break;
    }

    case 'rename_country': {
      const oldName = mc.old_name;
      const newName = mc.new_name;
      if (!oldName || !newName) return;
      const code = findCountryByName(oldName);
      if (!code) { console.warn(`[MAP] Pays "${oldName}" introuvable pour renommage`); return; }
      if (!G.countries[code]) G.countries[code] = { name: oldName, flag: FLAGS[code] || '🌐', color: null };
      G.countries[code].name = newName;
      NAMES[code] = newName;
      console.info(`[MAP] Renommage: ${oldName} → ${newName} (code ${code})`);
      _addMapNewsEvent('politique',
        `${getCountryFlag(code)} ${oldName} devient ${newName}`,
        `Le pays anciennement connu sous le nom de ${oldName} se renomme officiellement ${newName}.`
      );
      updateCountryLabels();
      break;
    }

    case 'new_country': {
      const newName = mc.new_name;
      const fromName = mc.from_country;
      const regionNames = mc.regions || [];
      const newFlag = mc.new_flag || '🏴';
      if (!newName || !fromName || !regionNames.length) return;
      const fromCode = findCountryByName(fromName);
      if (!fromCode) { console.warn(`[MAP] Pays source "${fromName}" introuvable`); return; }
      const existingCodes = Object.keys(G.countries).map(Number);
      const newCode = Math.max(9100, ...existingCodes.filter(c => c >= 9100), 9099) + 1;
      G.countries[newCode] = { name: newName, flag: newFlag, color: null };
      NAMES[newCode] = newName;
      FLAGS[newCode] = newFlag;
      let transferred = 0;
      for (const rName of regionNames) {
        const reg = findRegionByName(rName);
        if (reg && reg.owner === fromCode) {
          reg.owner = newCode;
          reg.originalOwner = newCode;
          transferred++;
        }
      }
      G.relations[newCode] = 'tension';
      console.info(`[MAP] Nouveau pays: ${newFlag} ${newName} (code ${newCode}), ${transferred} régions depuis ${fromName}`);
      _addMapNewsEvent('politique',
        `${newFlag} Indépendance : ${newName} proclame sa souveraineté`,
        `${newName} fait sécession de ${fromName} avec ${transferred} région(s). La communauté internationale observe.`
      );
      syncOwnershipFromRegions();
      updateColors();
      updateCountryLabels();
      break;
    }

    case 'split': {
      applyMapChange({ ...mc, type: 'new_country', new_name: mc.new_country || mc.new_name });
      break;
    }

    case 'merge': {
      const countryNames = mc.countries || [];
      const intoName = mc.into;
      if (countryNames.length < 2 || !intoName) return;
      const codes = countryNames.map(n => findCountryByName(n)).filter(Boolean);
      if (codes.length < 2) return;
      const mainCode = codes[0];
      if (!G.countries[mainCode]) G.countries[mainCode] = { name: NAMES[mainCode], flag: FLAGS[mainCode] || '🌐', color: null };
      G.countries[mainCode].name = intoName;
      NAMES[mainCode] = intoName;
      for (let i = 1; i < codes.length; i++) {
        const absorbedCode = codes[i];
        G.regions.forEach(r => {
          if (r.owner === absorbedCode) { r.owner = mainCode; }
        });
        delete G.countries[absorbedCode];
        delete G.relations[absorbedCode];
      }
      console.info(`[MAP] Fusion: ${countryNames.join(' + ')} → ${intoName}`);
      _addMapNewsEvent('diplomatique',
        `Fusion historique : naissance de ${intoName}`,
        `${countryNames.join(', ')} fusionnent pour former ${intoName}. Les frontières intérieures sont abolies.`
      );
      syncOwnershipFromRegions();
      updateColors();
      updateCountryLabels();
      break;
    }

    case 'destroy': {
      const oldName = mc.old_name;
      if (!oldName) return;
      const code = findCountryByName(oldName);
      if (!code) return;
      delete G.countries[code];
      delete G.relations[code];
      console.info(`[MAP] Pays détruit: ${oldName}`);
      _addMapNewsEvent('politique',
        `${oldName} cesse d'exister`,
        `Le pays de ${oldName} est dissous. Ses territoires sont répartis entre les puissances occupantes.`
      );
      syncOwnershipFromRegions();
      updateColors();
      updateCountryLabels();
      break;
    }
  }
}

// ══════════════════════════════════════════
// ── War frontier functions ──
// ══════════════════════════════════════════

function getConquerableFrontier(defCode, atkCode) {
  const defProvinces = countryToProvinces[defCode] || [];
  const stillDefended = defProvinces.filter(pid =>
    (G.provinceOwnership[pid] ?? defCode) === defCode
  );
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

  // Fallback: closest provinces to attacker territory
  if (frontier.length === 0 && stillDefended.length > 0) {
    const provCentroids = window._provCentroids || {};
    const atkCents = [];
    (countryToProvinces[atkCode] || []).forEach(pid => {
      if ((G.provinceOwnership[pid] ?? atkCode) !== atkCode) return;
      const c = provCentroids[pid];
      if (c) atkCents.push(c);
    });
    defProvinces.forEach(pid => {
      if (G.provinceOwnership[pid] !== atkCode) return;
      const c = provCentroids[pid];
      if (c) atkCents.push(c);
    });
    // Fallback: capital
    if (!atkCents.length) {
      const cap = CAPITALS[atkCode];
      if (cap) atkCents.push([cap[1], cap[0]]); // [lat, lng]
    }
    if (atkCents.length) {
      const withDist = stillDefended.map(pid => {
        const c = provCentroids[pid];
        if (!c) return { pid, dist: Infinity };
        let minD = Infinity;
        for (const ac of atkCents) {
          const dLat = c[0] - ac[0], dLon = c[1] - ac[1];
          const d2 = dLat * dLat + dLon * dLon;
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

// ══════════════════════════════════════════
// ── Update colors ──
// ══════════════════════════════════════════

let _relationMarkerLayer = null;
function updateRelationMarkers() {
  if (!leafletMap || typeof CAPITALS === 'undefined') return;
  if (!_relationMarkerLayer) _relationMarkerLayer = L.layerGroup().addTo(leafletMap);
  _relationMarkerLayer.clearLayers();

  const REL_DOTS = { ally: '🟢', tension: '🟡', hostile: '🔴', war: '⚔️' };

  Object.entries(G.relations).forEach(([code, rel]) => {
    if (rel === 'neutral' || !CAPITALS[+code]) return;
    const [lng, lat] = CAPITALS[+code];
    const dot = REL_DOTS[rel];
    if (!dot) return;
    const icon = L.divIcon({
      className: 'rel-dot',
      html: `<span style="font-size:8px">${dot}</span>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    L.marker([lat, lng], { icon, interactive: false }).addTo(_relationMarkerLayer);
  });
}

function updateColors() {
  // Update region layer (provinces) — always visible
  if (_regionLayer) {
    _regionLayer.eachLayer(layer => {
      const reg = G.regions.find(r => r.id === layer.feature.properties.id);
      if (reg) {
        layer.feature.properties.owner = reg.owner;
        const s = getRegionStyle(layer.feature);
        layer.setStyle(s);
      }
    });
  }
  updateRelationMarkers();
}


function updateCounters() {
  const c = {ally:0, tension:0, hostile:0, war:0};
  Object.values(G.relations).forEach(r => { if (c[r]!==undefined) c[r]++; });
  document.getElementById('cnt-a').textContent = c.ally;
  document.getElementById('cnt-t').textContent = c.tension;
  document.getElementById('cnt-h').textContent = c.hostile;
  document.getElementById('cnt-w').textContent = c.war;
}

// ══════════════════════════════════════════
// ── Faction overlays ──
// ══════════════════════════════════════════

let _lastFactionSignature = '';
function updateFactionOverlays() {
  if (!leafletMap || !_factionLayer) return;

  const fSig = JSON.stringify(G.factions || {});
  if (fSig === _lastFactionSignature) return;
  _lastFactionSignature = fSig;

  _factionLayer.clearLayers();
  if (!G.factions || !Object.keys(G.factions).length) return;

  Object.entries(G.factions).forEach(([nom, f]) => {
    const feat = d3countries.find(c => +c.id === f.pays);
    if (!feat) return;

    // Hatched overlay using a canvas pattern
    L.geoJSON(feat, {
      style: {
        fillColor: '#e74c3c',
        fillOpacity: 0.25,
        color: '#e74c3c',
        weight: 0.6,
        interactive: false
      },
      interactive: false
    }).addTo(_factionLayer);

    // Faction marker
    const center = d3centroids[f.pays];
    if (center) {
      const icon = L.divIcon({
        className: 'faction-marker',
        html: '<span style="color:#e74c3c;font-size:14px;text-shadow:0 0 6px rgba(231,76,60,0.6);">&#x270A;</span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker(center, { icon, interactive: false }).addTo(_factionLayer);
    }
  });
}

// ══════════════════════════════════════════
// ── War end / check ──
// ══════════════════════════════════════════

function endWar(defCode, atkCode, attackerWon) {
  const defName = NAMES[defCode] || String(defCode);
  const atkName = NAMES[atkCode] || String(atkCode);

  const newRel = 'hostile';
  if (G.relations[defCode] === 'war') G.relations[defCode] = newRel;
  if (G.relations[atkCode] === 'war') G.relations[atkCode] = newRel;

  const wKey = Math.min(defCode,atkCode)+'-'+Math.max(defCode,atkCode);
  if (G.worldRels[wKey] === 'war') G.worldRels[wKey] = 'hostile';

  if (!G.provinceOwnership) G.provinceOwnership = {};
  const defProvinceIds = countryToProvinces[defCode] || [];
  if (attackerWon) {
    defProvinceIds.forEach(pid => { G.provinceOwnership[pid] = atkCode; });
  } else {
    defProvinceIds.forEach(pid => { G.provinceOwnership[pid] = defCode; });
  }

  delete G.warProgress[defCode];

  // Synchroniser G.regions depuis provinceOwnership
  if (G.regions) {
    G.regions.forEach(r => {
      const pid = r.id.replace('reg_', '');
      const newOwner = G.provinceOwnership[pid];
      if (newOwner != null) r.owner = newOwner;
    });
  }
  updateColors(); updateCounters();
  triggerMapFX([{codeA: atkCode, codeB: defCode, type: newRel}]);

  const titre = attackerWon
    ? `${FLAGS[atkCode]||''} ${atkName} remporte la guerre contre ${defName}`
    : `${FLAGS[defCode]||''} ${defName} repousse l'invasion de ${atkName}`;
  const texte = attackerWon
    ? `Capitulation de ${defName} \u2014 ${atkName} contr\u00f4le d\u00e9sormais le territoire. Un armistice est impos\u00e9.`
    : `L'offensive de ${atkName} est bris\u00e9e. ${defName} a tenu ses lignes et force un cessez-le-feu.`;
  addWorldEvent({ lieu: defName, titre, texte });
  G.fullHistory.push({ type:'event', cat:'MILITAIRE', titre, texte, date:G.date, turn:G.turn });
  saveGame();
}

function checkWarEnd() {
  if (!G.warProgress) return;
  Object.keys(G.warProgress).forEach(defCode => {
    const wp = G.warProgress[+defCode];
    if (!wp) return;
    if (wp.progress >= 95) endWar(+defCode, wp.attacker, true);
    else if (wp.progress <= 5) endWar(+defCode, wp.attacker, false);
  });
}

// ══════════════════════════════════════════
// ── Map navigation ──
// ══════════════════════════════════════════

function mzoom(f) {
  if (!leafletMap) return;
  if (f > 1) leafletMap.zoomIn();
  else leafletMap.zoomOut();
}

function mreset() {
  if (!leafletMap) return;
  leafletMap.setView([20, 0], 3, { animate: true, duration: 0.4 });
}

function locateCountry(code) {
  if (!leafletMap) return;
  // Calculer les bounds depuis les régions possédées par ce pays
  const regs = (G.regions || []).filter(r => r.owner === code);
  if (regs.length) {
    const fc = { type: 'FeatureCollection', features: regs.map(r => ({ type: 'Feature', geometry: r.geometry })) };
    const bounds = L.geoJSON(fc).getBounds();
    if (bounds.isValid()) {
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 6, animate: true, duration: 0.75 });
      return;
    }
  }
  // Fallback: centroid
  const center = d3centroids[code];
  if (center) leafletMap.setView(center, 5, { animate: true, duration: 0.75 });
}

// ══════════════════════════════════════════
// ── Map conversation state ──
// ══════════════════════════════════════════

let _mapConvRAF = 0;
function updateMapConvState() {
  if (!leafletMap || !_regionLayer) return;
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
    _regionLayer.eachLayer(layer => {
      const owner = layer.feature.properties.owner;
      const el = layer.getElement();
      if (!el) return;
      el.classList.toggle('country-has-conv', convCodes.has(owner));
      el.classList.toggle('country-unread', unreadCodes.has(owner));
    });
  });
}

// ══════════════════════════════════════════
// ── Map display options toggle ──
// ══════════════════════════════════════════
// (called from HTML onclick handlers)

// ══════════════════════════════════════════
// ── Panel toggle (floating buttons) ──
// ══════════════════════════════════════════
let _panelState = { news: true, diplo: true };

function togglePanel(panel) {
  _panelState[panel] = !_panelState[panel];

  const newsBlk = document.querySelector('.panel-blk.news');
  const diploBlk = document.querySelector('.panel-blk.diplo');
  const rightPanel = document.getElementById('right-panel');
  const resizerV = document.getElementById('resizer-v');
  const resizerH = document.getElementById('resizer-h');

  if (panel === 'news' && newsBlk) {
    newsBlk.classList.toggle('collapsed', !_panelState.news);
    document.getElementById('btn-toggle-news').classList.toggle('active', _panelState.news);
  }
  if (panel === 'diplo' && diploBlk) {
    diploBlk.classList.toggle('collapsed', !_panelState.diplo);
    document.getElementById('btn-toggle-diplo').classList.toggle('active', _panelState.diplo);
  }

  if (!_panelState.news && !_panelState.diplo) {
    if (rightPanel) rightPanel.classList.add('collapsed');
    if (resizerV) resizerV.style.display = 'none';
  } else {
    if (rightPanel) rightPanel.classList.remove('collapsed');
    if (resizerV) resizerV.style.display = '';
  }

  if (resizerH) resizerH.style.display = (_panelState.news && _panelState.diplo) ? '' : 'none';

  if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 300);
}

// ── Dynamic map updates ──
function updateCountryLabels() {
  if (!leafletMap || !_labelTiers || !_labelTiers.length) return;
  const TIER0 = new Set([840,643,156,356,76,124,36,392,484,710,360]);
  // Remember which tiers were on the map
  const wasOnMap = _labelTiers.map(t => leafletMap.hasLayer(t));
  _labelTiers.forEach(tier => { leafletMap.removeLayer(tier); tier.clearLayers(); });

  // Construire la liste des pays qui possèdent au moins une région
  const ownerSet = new Set();
  if (G.regions) G.regions.forEach(r => ownerSet.add(r.owner));

  d3countries.forEach(feat => {
    const code = +feat.id;
    // Masquer les labels des pays sans territoire
    if (!ownerSet.has(code)) return;
    const name = getCountryName(code);
    if (!name || name === String(code)) return;
    const center = d3centroids[code];
    if (!center) return;
    const area = _countryAreaDeg[code] || 0;
    let tier;
    if (TIER0.has(code)) tier = 0;
    else if (area >= 20) tier = 1;
    else if (area >= 2) tier = 2;
    else return;
    const cls = tier === 0 ? 'label-xl' : tier === 1 ? 'label-lg' : 'label-md';
    const divIcon = L.divIcon({
      className: 'leaflet-country-label ' + cls,
      html: `<span>${name.toUpperCase()}</span>`,
      iconSize: [0, 0], iconAnchor: [0, 0]
    });
    L.marker(center, { icon: divIcon, interactive: false }).addTo(_labelTiers[tier]);
  });

  // Labels pour les nouveaux pays (code >= 9100) qui ne sont pas dans d3countries
  ownerSet.forEach(code => {
    if (code < 9100) return;
    if (d3countries.some(f => +f.id === code)) return;
    const c = G.countries?.[code];
    if (!c) return;
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
      html: `<span>${c.name.toUpperCase()}</span>`,
      iconSize: [0, 0], iconAnchor: [0, 0]
    });
    L.marker(center, { icon: divIcon, interactive: false }).addTo(_labelTiers[2]);
  });

  // Re-add tiers that were visible
  if (_mapOptions.labels) {
    wasOnMap.forEach((was, i) => { if (was) leafletMap.addLayer(_labelTiers[i]); });
    // At minimum show tier 0
    if (!leafletMap.hasLayer(_labelTiers[0])) leafletMap.addLayer(_labelTiers[0]);
  }
}

// updateCountryLayer — no longer needed (kept as no-op for compatibility)
function updateCountryLayer() {}

// mergeAbsorbedCountry — no longer needed (kept as no-op for compatibility)
function mergeAbsorbedCountry() {}

// ── Battalion markers ──
function updateBattalionMarkers() {
  if (!leafletMap || !_battalionLayer) return;
  _battalionLayer.clearLayers();
  if (!G.battalions) return;

  const UNIT_ICONS = { infantry: '⚔', navy: '⚓', air: '✈' };

  G.battalions.forEach(b => {
    const color = b.ownerCode === G.nationCode ? '#d4920a' : getCC(b.ownerCode);
    const icon = L.divIcon({
      className: 'battalion-marker',
      html: `<div style="background:${color};border:1px solid rgba(255,255,255,0.4);border-radius:3px;padding:1px 3px;font-size:9px;color:#fff;white-space:nowrap;text-shadow:0 0 3px #000">${UNIT_ICONS[b.type] || '⚔'} ${b.strength}%</div>`,
      iconSize: [0, 0],
    });
    const marker = L.marker([b.lat, b.lng], { icon, interactive: true });
    marker.bindTooltip(`${FLAGS[b.ownerCode]||''} ${b.name} (${b.strength}%)`, { direction: 'top' });
    marker.addTo(_battalionLayer);
  });
}

function toggleMapOptions() {
  const panel = document.getElementById('map-opts-panel');
  if (panel) panel.classList.toggle('open');
}

function toggleMapOpt(key) {
  _mapOptions[key] = !_mapOptions[key];
  const btns = document.querySelectorAll(`.map-opt-toggle[data-key="${key}"]`);
  btns.forEach(b => b.classList.toggle('active', _mapOptions[key]));

  if (key === 'borders') {
    // Borders removed — no-op
  }
  if (key === 'labels') {
    _labelTiers.forEach(tier => {
      if (_mapOptions.labels) leafletMap.addLayer(tier);
      else leafletMap.removeLayer(tier);
    });
    if (_mapOptions.labels) {
      const z = leafletMap.getZoom();
      if (z < 4) leafletMap.removeLayer(_labelTiers[1]);
      if (z < 5) leafletMap.removeLayer(_labelTiers[2]);
    }
  }
  if (key === 'provinces' && _provinceLayer) {
    if (_mapOptions.provinces && _provincesVisible) leafletMap.addLayer(_provinceLayer);
    else leafletMap.removeLayer(_provinceLayer);
  }
  if (key === 'capitals' && _capitalLayer) {
    if (_mapOptions.capitals) leafletMap.addLayer(_capitalLayer);
    else leafletMap.removeLayer(_capitalLayer);
  }
}

// ══════════════════════════════════════════
// ── showMapIcon / triggerMapFX / drawRelationArc ──
// ── (ported from diplomacy.js to use Leaflet) ──
// ══════════════════════════════════════════

function showMapIcon(code, icon) {
  if (!leafletMap) return;
  const center = d3centroids[code];
  if (!center) return;
  const divIcon = L.divIcon({
    className: 'map-icon-fx',
    html: `<span style="font-size:16px;text-shadow:0 0 8px rgba(0,0,0,0.8);">${icon}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  const marker = L.marker(center, { icon: divIcon, interactive: false }).addTo(leafletMap);
  // Fade out and remove after delay
  const el = marker.getElement();
  if (el) {
    el.style.transition = 'opacity 0.4s';
    el.style.opacity = '0';
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => {
      el.style.transition = 'opacity 1s';
      el.style.opacity = '0';
      setTimeout(() => leafletMap.removeLayer(marker), 1100);
    }, 5000);
  }
}

const REL_ICONS = {ally:'\u2726', tension:'!', hostile:'\u2715', war:'\u2694', neutral:'\u00b7'};

function drawRelationArc(codeA, codeB, type) {
  if (!leafletMap) return;
  const capA = CAPITALS[codeA], capB = CAPITALS[codeB];
  if (!capA || !capB) return;
  // CAPITALS are [lng, lat], Leaflet needs [lat, lng]
  const ptA = [capA[1], capA[0]];
  const ptB = [capB[1], capB[0]];

  const colors = {ally:'#d4920a', tension:'#9a6210', hostile:'#8a1a1a', war:'#cc0000', neutral:'#3a5a7a'};
  const color = colors[type] || '#3a5a7a';

  const line = L.polyline([ptA, ptB], {
    color: color,
    weight: type === 'war' ? 2.5 : 1.8,
    opacity: 0,
    dashArray: type === 'war' ? '6,4' : null,
    interactive: false
  }).addTo(leafletMap);

  const el = line.getElement();
  if (el) {
    el.style.transition = 'opacity 0.3s';
    requestAnimationFrame(() => { el.style.opacity = '0.7'; });
    setTimeout(() => {
      el.style.transition = 'opacity 0.7s';
      el.style.opacity = '0';
      setTimeout(() => leafletMap.removeLayer(line), 800);
    }, 2600);
  }
}

function triggerMapFX(changes) {
  changes.forEach(ch => {
    const icon = REL_ICONS[ch.type] || '\u00b7';
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
// ── Event Presenter ──
// ══════════════════════════════════════════

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
  if (!leafletMap) return null;
  const center = d3centroids[code];
  if (!center) return null;

  const icon = L.divIcon({
    className: 'pulse-marker-leaflet',
    html: '<div class="pulse-dot"></div><div class="pulse-ring"></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
  const marker = L.marker(center, { icon, interactive: false }).addTo(leafletMap);
  return { remove() { leafletMap.removeLayer(marker); } };
}

function _showEventStep(index) {
  const ev = _eventPresQueue[index];
  if (!ev) return;
  const total = _eventPresQueue.length;

  const prog = document.getElementById('ep-progress');
  if (prog) prog.textContent = `${index + 1} / ${total}`;

  const cat = (ev.categorie || 'DIVERS').toUpperCase();
  const catEl = document.getElementById('ep-cat');
  if (catEl) {
    catEl.className = 'ep-cat-badge ' + (CAT_CLASS[cat] || 'cat-misc');
    catEl.textContent = cat;
  }
  const titleEl = document.getElementById('ep-title');
  if (titleEl) titleEl.textContent = ev.titre || '\u00c9v\u00e9nement';
  const bodyEl = document.getElementById('ep-body');
  if (bodyEl) bodyEl.textContent = ev.texte || '';

  const btn = document.getElementById('ep-next-btn');
  if (btn) btn.textContent = index === total - 1 ? 'Terminer \u2713' : 'Suivant \u2192';

  addNewsEvent(ev);

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
