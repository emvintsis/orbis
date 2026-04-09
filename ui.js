// ══ ui.js — Navigation, init, archives, tutoriel, export, save/load, utilitaires ══

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
  tres_facile: 'Tout est possible, même l\'irréaliste. Aucune résistance. Idéal pour l\'exploration.',
  facile:      'Les nations coopèrent et évitent les conflits. Idéal pour débuter.',
  normal:      'Comportement diplomatique équilibré et réaliste. Recommandé.',
  difficile:   'Les nations sont opportunistes et exploitent les faiblesses. Planification nécessaire.',
  impossible:  'Difficulté maximale. Les nations anticipent des mois à l\'avance. Non recommandé aux débutants.',
  // Legacy
  civil: 'Les nations coopèrent et évitent les conflits.',
  diplomate: 'Comportement diplomatique standard. Équilibré.',
  stratege:  'Les nations sont stratégiques et opportunistes.',
  hardcore:  'Les nations sont agressives et cherchent l\'hégémonie mondiale.'
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
    turnSnapshots: [],
    diplomaticCommitments: [],
    battalions: [],
    lastAiSummary: '',
    lastWorldEventTypes: [],
    regions: [],
    countries: {},
    absorbedCountries: {},
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
    turnSnapshots: save.turnSnapshots || [],
    diplomaticCommitments: save.diplomaticCommitments || [],
    battalions: save.battalions || [],
    lastAiSummary: save.lastAiSummary || '',
    lastWorldEventTypes: save.lastWorldEventTypes || [],
    regions: save.regions || [],
    countries: save.countries || {},
    absorbedCountries: save.absorbedCountries || {},
    _gameOver: false
  };
  launchGame();
}

function initCountries() {
  if (Object.keys(G.countries).length > 0) return;
  G.countries = {};
  Object.entries(NAMES).forEach(([code, name]) => {
    G.countries[+code] = { name, flag: FLAGS[+code] || '🌐', color: null };
  });
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

  initCountries();
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
        turnSnapshots:(G.turnSnapshots||[]).slice(-10),
        diplomaticCommitments:(G.diplomaticCommitments||[]).slice(-10),
        battalions:G.battalions||[],
        lastAiSummary:G.lastAiSummary||'',
        lastWorldEventTypes:G.lastWorldEventTypes||[],
        regions:G.regions||[],
        countries:G.countries||{},
        absorbedCountries:G.absorbedCountries||{},
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
