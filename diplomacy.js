// ══ diplomacy.js — Traités, actualités, contacts, conversations, staff ══

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
      <span class="ne-cat decree-cat">📜 NARRATION · ${escHtml(FLAGS[G.nationCode]||'')} ${escHtml(G.nation)}</span>
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
  const rel = G.relations[code];
  if (rel === 'unrecognized') {
    if (typeof showAlertToast === 'function') {
      showAlertToast('⛔', 'Reconnaissance requise', `${name} ne reconnaît pas votre nation. Aucun canal diplomatique disponible.`, 'warn');
    } else {
      alert(`${name} ne reconnaît pas votre nation. Aucun canal diplomatique disponible.`);
    }
    return;
  }
  const ex = G.conversations.find(c=>c.nations.some(n=>n.code===code)&&c.nations.some(n=>n.code===G.nationCode));
  if (ex) { setActive(ex.id); return; }
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
  // Auto-open diplo float panel
  const fp = document.getElementById('diplo-float-panel');
  if (fp && !fp.classList.contains('open')) fp.classList.add('open');
  document.querySelectorAll('.ci').forEach(e=>e.classList.remove('active'));
  const item = document.getElementById('ci-'+id);
  if (item) { item.classList.add('active'); item.querySelector('.ci-dot')?.remove(); }
  const headerN = conv.nations.map(n=>(FLAGS[n.code]||'🌐')+' '+n.name).join(' ↔ ');
  const others = conv.nations.filter(n => n.code !== G.nationCode);
  const archetypeBadges = others.map(n => {
    const a = LEADER_ARCHETYPES[n.code] || { type: 'Pragmatique', trait: 'Défend les intérêts nationaux.', emoji: '🏛' };
    return `<span class="archetype-badge" title="${escHtml(a.trait)}">${a.emoji} ${escHtml(a.type)}</span>`;
  }).join('');
  const curPersona = _convPersonas[id] || '';
  document.getElementById('conv-chat').innerHTML = `
    <div class="cch">
      <div class="cch-n">${headerN}</div>
      <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
        <div class="cch-s">${escHtml(conv.subject)}</div>
        ${archetypeBadges}
      </div>
      <div class="persona-row">
        <span class="persona-label">Vous incarnez :</span>
        <select class="persona-select" id="persona-${id}" onchange="_convPersonas[${id}]=this.value">
          <option value="">Chef d'État</option>
          <option value="Ministre des Affaires Étrangères" ${curPersona==='Ministre des Affaires Étrangères'?'selected':''}>Ministre des AE</option>
          <option value="Général" ${curPersona==='Général'?'selected':''}>Général</option>
          <option value="Diplomate" ${curPersona==='Diplomate'?'selected':''}>Diplomate</option>
          <option value="Conseiller spécial" ${curPersona==='Conseiller spécial'?'selected':''}>Conseiller spécial</option>
        </select>
      </div>
      <div class="conv-actions">
        <button class="conv-action-btn" id="conclude-${id}" onclick="concludeNegotiation(${id})" title="Formaliser les accords">⚖ Conclure</button>
        <button class="conv-action-btn" onclick="openTreatyModal(${id})" title="Proposer un traité formel">📜 Traité</button>
      </div>
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
  if (b) { b.textContent = n; b.classList.toggle('has-msg', n > 0); }
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

// Auto-extraction d'engagements depuis un message joueur (diplo ou staff)
function _autoExtractCommitment(playerText, nationCode, nationName, source) {
  if (!playerText || playerText.length < 15) return;
  if (typeof _COMMIT_KEYWORDS_DIPLO === 'undefined' || typeof _ORDER_KEYWORDS_STAFF === 'undefined') return;
  const list = source === 'staff' ? _ORDER_KEYWORDS_STAFF : _COMMIT_KEYWORDS_DIPLO;
  const low = playerText.toLowerCase();
  if (!list.some(k => low.includes(k))) return;
  if (!Array.isArray(G.diplomaticCommitments)) G.diplomaticCommitments = [];
  const trimmed = playerText.slice(0, 200);
  // Évite les doublons exacts récents
  const last5 = G.diplomaticCommitments.slice(-5);
  if (last5.some(c => c && c.description === trimmed && c.source === source)) return;
  G.diplomaticCommitments.push({
    turn: G.turn,
    nationCode: nationCode || 0,
    nation: nationName || '\u2014',
    description: trimmed,
    type: 'auto',
    source: source || 'diplo'
  });
  if (G.diplomaticCommitments.length > 25) G.diplomaticCommitments.shift();
}

async function sendMsg(convId) {
  const conv = G.conversations.find(c=>c.id===convId);
  if (!conv) return;
  const ta = document.getElementById('cin-'+convId);
  const text = ta?.value.trim(); if (!text) return;
  ta.value='';
  const btn = document.getElementById('csend-'+convId);
  if(btn) btn.disabled = true;
  // Inject persona context if set
  const persona = _convPersonas[convId];
  const msgWithPersona = persona ? `[${persona} de ${G.nation}] ${text}` : text;
  addMsg(convId, persona ? `${G.nation} (${persona})` : G.nation, G.nationCode, text);
  const respondents = conv.nations.filter(n => n.code !== G.nationCode);
  // Auto-extraction d'engagement sur le message joueur
  const primary = respondents[0];
  _autoExtractCommitment(text, primary?.code, primary?.name, 'diplo');
  // Répondre en parallèle (plus rapide) avec erreur individuelle
  const responses = await Promise.allSettled(
    respondents.map(async other => {
      try {
        const reply = await convGemini(conv, other);
        return { other, reply };
      } catch(e) {
        return { other, error: e.message };
      }
    })
  );
  for (const r of responses) {
    if (r.status === 'fulfilled') {
      if (r.value.error) {
        addMsg(convId, 'Système', 0, `[${r.value.other.name}] Erreur : ${r.value.error}`);
      } else {
        addMsg(convId, r.value.other.name, r.value.other.code, r.value.reply);
      }
    }
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
  const groupCtx = isGroup
    ? ` CONTEXTE MULTILATÉRAL : Cette réunion réunit ${participants}. Tu parles en tant que ${responder.name} devant les autres délégations. Tu peux réagir aux messages des AUTRES participants (pas seulement du joueur). Tu peux être d'accord ou en désaccord avec les autres nations présentes. Adresse-toi parfois aux autres participants par leur nom.`
    : '';
  // Full game memory so the foreign leader knows what the player has done
  const allDecrees = G.fullHistory.filter(h=>h.type==='decree')
    .map(h=>`[Tour ${h.turn} — ${h.date}] ${h.texte.slice(0,250)}`).join('\n');
  const allEvents = G.fullHistory.filter(h=>h.type==='event'||h.type==='breaking')
    .map(h=>`[Tour ${h.turn}] ${h.titre}${h.texte?' : '+h.texte.slice(0,100):''}`).join('\n');
  const gameMemory = [
    G.lastResume ? `Résumé récent : ${G.lastResume}` : '',
    allDecrees ? `Actions du chef d'État de ${G.nation} :\n${allDecrees}` : '',
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
  const archetype = LEADER_ARCHETYPES[responder.code] || { type: 'Pragmatique', trait: 'Défend les intérêts nationaux.', emoji: '🏛' };
  const archetypeLine = ` Ton archétype de gouvernance : ${archetype.type} — "${archetype.trait}" Laisse cet archétype influencer ton ton, tes concessions et tes lignes rouges.`;
  const playerPersona = _convPersonas[conv.id];
  const playerPersonaLine = playerPersona ? ` Note : ton interlocuteur parle en tant que ${playerPersona} de ${G.nation}.` : '';
  const customDiploPrompt = G.customPrompts?.diplomacy;
  const diploInstruction = customDiploPrompt || `Incarne ce personnage avec son style propre, ses intérêts nationaux, sa rhétorique réelle. Référence-toi précisément aux événements historiques ci-dessus si pertinent. Réponds en français, 2-3 phrases, uniquement le message diplomatique, aucune introduction ni méta-commentaire.`;
  const sys = `Tu es ${persona}.${groupCtx} Date : ${G.date}. Sujet : ${conv.subject}. Ta relation avec ${G.nation} : ${relLabel}.${archetypeLine}${playerPersonaLine}\n\n${gameMemory}\n\n${diploInstruction}`;
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
    if (res.resume) {
      addMsg(convId, 'Accord conclu', 0, '\u2705 ' + res.resume);
      // Store diplomatic commitment
      if (!G.diplomaticCommitments) G.diplomaticCommitments = [];
      const others = conv.nations.filter(n => n.code !== G.nationCode);
      G.diplomaticCommitments.push({
        turn: G.turn, nationCode: others[0]?.code, nation: others[0]?.name,
        description: res.resume, type: 'accord', source: 'diplo'
      });
      if (G.diplomaticCommitments.length > 25) G.diplomaticCommitments.shift();
    }
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

// showMapIcon, drawRelationArc, triggerMapFX — moved to map-leaflet.js

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
  if (!panel) return;
  const btn = document.getElementById('btn-gov');
  const isOpen = panel.classList.toggle('open');
  if (btn) btn.classList.toggle('open', isOpen);
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
            ${m.deletable ? `<button class="sm-btn sm-btn-delete" onclick="event.stopPropagation();deleteMinistry('${m.id}')" title="Supprimer ce ministère">✕</button>` : ''}
          </div>
        </div>`;
    }
  });
  html += '</div>';
  if (tab === 'ministres') {
    html += `
      <div class="staff-add-section">
        <div class="staff-add-title">Créer un ministère</div>
        <div class="staff-add-form">
          <input class="staff-add-input" id="new-ministry-role" placeholder="Nom du ministère (ex: Ministère de l'Écologie)">
          <input class="staff-add-input" id="new-ministry-name" placeholder="Nom du ministre (optionnel)">
          <select class="staff-add-icon" id="new-ministry-icon">
            <option value="🏛">🏛 Standard</option>
            <option value="🌿">🌿 Écologie</option>
            <option value="📡">📡 Technologie</option>
            <option value="🏥">🏥 Santé</option>
            <option value="📚">📚 Éducation</option>
            <option value="🚂">🚂 Transports</option>
            <option value="⚖">⚖ Justice</option>
            <option value="🏗">🏗 Infrastructure</option>
            <option value="🌾">🌾 Agriculture</option>
            <option value="💼">💼 Commerce</option>
            <option value="🎭">🎭 Culture</option>
            <option value="⚡">⚡ Énergie</option>
          </select>
          <button class="staff-add-btn" onclick="createMinistry()">+ Créer</button>
        </div>
      </div>`;
  }
  content.innerHTML = html;
}

function createMinistry() {
  const roleInput = document.getElementById('new-ministry-role');
  const nameInput = document.getElementById('new-ministry-name');
  const iconSelect = document.getElementById('new-ministry-icon');

  const role = roleInput?.value.trim();
  if (!role) { showAlertToast('⚠', 'Ministère', 'Entrez un nom pour le ministère.', 'warn'); return; }

  const name = nameInput?.value.trim() || '';
  const icon = iconSelect?.value || '🏛';

  const newMinistry = {
    id: 'custom_' + Date.now(),
    role: role,
    icon: icon,
    name: name,
    active: true,
    messages: [],
    custom: true,
    deletable: true
  };

  G.staff.ministres.push(newMinistry);
  saveGame();
  renderStaffList('ministres');

  if (!name && G.apiKey) {
    generateSingleName(newMinistry.id, role);
  }
}

function deleteMinistry(id) {
  const member = getStaffMember(id);
  if (!member || !member.deletable) return;
  if (!confirm(`Supprimer le ministère "${member.role}" ? Cette action est irréversible.`)) return;

  G.staff.ministres = G.staff.ministres.filter(m => m.id !== id);
  saveGame();
  renderStaffList('ministres');
}

async function generateSingleName(memberId, role) {
  try {
    const sys = `Génère un nom réaliste et culturellement approprié pour un ${role} de ${G.nation}. Réponds UNIQUEMENT avec le nom, rien d'autre.`;
    const raw = await geminiCallFull(sys, [{role:'user',parts:[{text:'Nom :'}]}], 50);
    const name = raw.trim().replace(/^["']|["']$/g, '');
    if (name && name.length < 50) {
      const member = getStaffMember(memberId);
      if (member) { member.name = name; saveGame(); renderStaffList(_staffTab); }
    }
  } catch(e) { /* silently ignore */ }
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
      <div class="advisor-chips" id="adv-chips-${id}">
        <span class="advisor-chips-loading">💬 Suggestions…</span>
      </div>
      <div class="staff-input-row">
        <textarea id="sinput-${id}" placeholder="Votre ordre ou question…" onkeydown="staffInputKey(event,'${id}')"></textarea>
        <button class="staff-send-btn" id="ssend-${id}" onclick="sendStaffMsg('${id}')">→</button>
      </div>
    </div>`;
  (m.messages || []).forEach(msg => renderStaffMsg(id, msg));
  scrollStaffChat(id);
  // Load suggested prompts async
  geminiAdvisorSuggestions().then(suggestions => {
    const chips = document.getElementById(`adv-chips-${id}`);
    if (!chips) return;
    if (!suggestions.length) { chips.style.display = 'none'; return; }
    chips.innerHTML = suggestions.map(s =>
      `<button class="advisor-chip" onclick="useAdvisorChip(this,'${id}')">${escHtml(s)}</button>`
    ).join('');
  }).catch(() => {
    const chips = document.getElementById(`adv-chips-${id}`);
    if (chips) chips.style.display = 'none';
  });
}

function useAdvisorChip(el, id) {
  const text = el.textContent;
  const inp = document.getElementById(`sinput-${id}`);
  if (inp) { inp.value = text; inp.focus(); }
  el.classList.add('used');
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
  // Auto-extraction d'ordre gouvernemental
  _autoExtractCommitment(text, G.nationCode, (m.name || m.role), 'staff');

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
  // Full game memory: all actions + all notable events
  const allDecrees = G.fullHistory.filter(h=>h.type==='decree')
    .map(h=>`[Tour ${h.turn} — ${h.date}] ACTION : ${h.texte.slice(0,300)}`).join('\n');
  const allEvents = G.fullHistory.filter(h=>h.type==='event'||h.type==='breaking')
    .map(h=>`[Tour ${h.turn} — ${h.cat||''}] ${h.titre}${h.texte?' : '+h.texte.slice(0,120):''}`).join('\n');
  const gameCtx = [
    G.lastResume ? `Résumé du dernier tour : ${G.lastResume}` : '',
    allDecrees ? `=== HISTORIQUE DES ACTIONS DU CHEF D'ÉTAT ===\n${allDecrees}` : '',
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

