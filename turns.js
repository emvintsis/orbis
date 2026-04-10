// ══ turns.js — Ressources, snapshots, brainstorm, soumission et résolution du tour, intel ══

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
// ── Snapshots (internal state persistence) ──
// ══════════════════════════════════════════
function pushTurnSnapshot() {
  const snap = {
    turn: G.turn, date: G.date,
    relations: JSON.parse(JSON.stringify(G.relations)),
    ressources: JSON.parse(JSON.stringify(G.ressources)),
    warProgress: JSON.parse(JSON.stringify(G.warProgress || {})),
    worldRels: JSON.parse(JSON.stringify(G.worldRels || {})),
    treaties: JSON.parse(JSON.stringify(G.treaties || [])),
    opinionScore: G.opinionScore || 50,
    lastResume: G.lastResume || '',
    provinceOwnership: JSON.parse(JSON.stringify(G.provinceOwnership || {})),
    factions: JSON.parse(JSON.stringify(G.factions || {})),
    savedAt: Date.now()
  };
  if (!G.turnSnapshots) G.turnSnapshots = [];
  G.turnSnapshots.push(snap);
  if (G.turnSnapshots.length > 10) G.turnSnapshots.shift();
}

// ══════════════════════════════════════════
// ── Brainstorm & Enhance ──
// ══════════════════════════════════════════
async function brainstormActions() {
  const panel = document.getElementById('brainstorm-panel');
  const btn = document.getElementById('btn-brainstorm');
  if (_brainstormOpen && panel) { panel.style.display = 'none'; _brainstormOpen = false; return; }
  _brainstormOpen = true;
  panel.style.display = 'block';
  panel.innerHTML = '<div class="brainstorm-loading">💡 Génération d\'idées…</div>';
  btn.disabled = true;
  try {
    const ideas = await geminiBrainstorm();
    panel.innerHTML = `
      <div class="brainstorm-header">
        <span class="brainstorm-title">💡 Idées d'actions</span>
        <button class="brainstorm-refresh" onclick="brainstormActions()" title="Nouvelles idées">↻</button>
        <button class="brainstorm-close" onclick="document.getElementById('brainstorm-panel').style.display='none';_brainstormOpen=false">✕</button>
      </div>
      <div class="brainstorm-chips">
        ${ideas.map(idea => `<div class="brainstorm-chip" onclick="useBrainstormIdea(this)" data-action="${escHtml(idea.action)}">
          <span class="brainstorm-chip-title">${escHtml(idea.titre)}</span>
          <span class="brainstorm-chip-desc">${escHtml(idea.action)}</span>
        </div>`).join('')}
      </div>`;
  } catch(e) {
    panel.innerHTML = `<div class="brainstorm-loading" style="color:#f87171">Erreur : ${escHtml(e.message)}</div>`;
  }
  btn.disabled = false;
}

function useBrainstormIdea(el) {
  const action = el.dataset.action;
  if (!action) return;
  document.getElementById('action-input').value = action;
  document.getElementById('action-input').focus();
  document.getElementById('brainstorm-panel').style.display = 'none';
  _brainstormOpen = false;
}

async function enhanceAction(mode) {
  const inp = document.getElementById('action-input');
  const action = inp.value.trim();
  if (!action) { document.getElementById('action-err').textContent = 'Rédigez d\'abord votre narration.'; return; }
  const btn = document.getElementById(mode === 'polish' ? 'btn-polish' : 'btn-enhance');
  if (btn) btn.disabled = true;
  inp.style.opacity = '0.5';
  try {
    const improved = await geminiEnhanceAction(action, mode);
    inp.value = improved;
  } catch(e) {
    document.getElementById('action-err').textContent = 'Erreur : ' + e.message;
  }
  inp.style.opacity = '1';
  if (btn) btn.disabled = false;
}

// ══════════════════════════════════════════
// ── Saut temporel ──
// ══════════════════════════════════════════
function setJumpDuration(dur) {
  _jumpDuration = dur;
  document.querySelectorAll('.timeline-node-jump').forEach(b => b.classList.toggle('active', b.dataset.dur === dur));
  if (typeof renderTimelineNodes === 'function') {
    // Met à jour l'affichage du bouton timeline avec un tooltip indiquant la durée sélectionnée
    const tbtn = document.getElementById('float-btn-timeline');
    if (tbtn) {
      const def = (typeof JUMP_DEFS !== 'undefined') ? JUMP_DEFS.find(d => d.dur === dur) : null;
      tbtn.title = 'Saut temporel — ' + (def ? def.label : (dur === 'event' ? 'Prochain événement' : dur));
    }
  }
}

// ══════════════════════════════════════════
// ── Options carte ──
// ══════════════════════════════════════════
// toggleMapOptions, toggleMapOpt — moved to map-leaflet.js

// ══════════════════════════════════════════
// ── Narration queue ──
// ══════════════════════════════════════════
// Le joueur enchaîne plusieurs prompts via ⚡ (mis en file localement).
// L'appel Gemini et l'avancement du tour ne se produisent que lorsqu'il
// clique "Prochain tour" — à ce moment tous les prompts sont combinés.

function addToNarration() {
  if (G._gameOver) return;
  const inp = document.getElementById('action-input');
  const text = inp.value.trim();
  if (!text) return;
  if (!G.pendingNarration) G.pendingNarration = [];
  G.pendingNarration.push(text);
  inp.value = '';
  inp.style.height = 'auto';
  document.getElementById('action-err').textContent = '';
  renderNarrationQueue();
  inp.focus();
}

function removeNarration(i) {
  if (!G.pendingNarration) return;
  G.pendingNarration.splice(i, 1);
  renderNarrationQueue();
}

function renderNarrationQueue() {
  const wrap = document.getElementById('narration-queue');
  if (!wrap) return;
  const q = G.pendingNarration || [];
  if (!q.length) {
    wrap.innerHTML = '';
    wrap.classList.remove('has-items');
  } else {
    wrap.classList.add('has-items');
    wrap.innerHTML = `
      <div class="nq-head">
        <span class="nq-title">Narration en attente <span class="nq-count">${q.length}</span></span>
        <button class="nq-clear" onclick="clearNarration()" title="Tout effacer">✕</button>
      </div>
      <div class="nq-list">
        ${q.map((t, i) => `
          <div class="nq-item">
            <span class="nq-bullet">⚡</span>
            <span class="nq-text">${escHtml(t)}</span>
            <button class="nq-rm" onclick="removeNarration(${i})" title="Retirer">×</button>
          </div>`).join('')}
      </div>`;
  }
  // Mise à jour du bouton "Prochain tour"
  const nextBtn = document.getElementById('btn-next-turn');
  if (nextBtn) {
    const has = (G.pendingNarration || []).length > 0;
    nextBtn.classList.toggle('has-queue', has);
    nextBtn.title = has
      ? `Lancer le tour avec ${q.length} prompt${q.length>1?'s':''}`
      : 'Passer le tour (aucune narration)';
  }
}

function clearNarration() {
  G.pendingNarration = [];
  renderNarrationQueue();
}

// ══════════════════════════════════════════
// ── Action ──
// ══════════════════════════════════════════
async function submitAction() {
  // Bouton ⚡ = ajoute à la file, n'avance pas le tour
  addToNarration();
}

async function _runActionTurn(action) {
  if (G._gameOver) return;
  document.getElementById('action-err').textContent = '';
  const addBtn = document.getElementById('btn-add-narration');
  const nextBtn = document.getElementById('btn-next-turn');
  if (addBtn)  addBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  G.actionHistory.push({ turn: G.turn, action });
  pushTurnSnapshot();

  addDecreeToFeed(action);
  const thinkEl = addThinking();
  try {
    const raw = await geminiActionCall(buildActionPrompt(action));
    thinkEl.remove();
    await resolveAction(raw);
  } catch(e) {
    thinkEl.remove();

    // Si erreur JSON mais l'action contient une fusion/annexion,
    // appliquer les changements de carte côté client
    if (e.type === 'JSON' || e.message?.includes('JSON')) {
      const applied = autoApplyMapChanges(action);
      if (applied) {
        // Avancer le tour quand même
        G.turn++;
        G.date = incrementDate(G.date);
        document.getElementById('hdr-turn').textContent = G.turn;
        document.getElementById('hdr-date').textContent = G.date;
        if (typeof renderTimelineNodes === 'function') renderTimelineNodes();
        saveGame();
        if (addBtn)  addBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;
        return;
      }
    }

    displayDebugError(e);
    document.getElementById('action-err').textContent = e.message;
  }
  if (addBtn)  addBtn.disabled = false;
  if (nextBtn) nextBtn.disabled = false;
}

async function executeNextTurn() {
  if (G._gameOver) return;
  // Si du texte est encore dans l'input, on le pousse dans la file d'abord
  const inp = document.getElementById('action-input');
  if (inp && inp.value.trim()) addToNarration();

  const queue = G.pendingNarration || [];
  let actionText;
  if (queue.length === 0) {
    // Aucune narration → skip
    actionText = '__SKIP__';
  } else if (queue.length === 1) {
    actionText = queue[0];
  } else {
    actionText = queue.map((p, i) => `${i + 1}. ${p}`).join('\n');
  }

  G.pendingNarration = [];
  renderNarrationQueue();
  await _runActionTurn(actionText);
}

async function consultStaff() {
  const draft = document.getElementById('action-input').value.trim();
  if (!draft) { document.getElementById('action-err').textContent = 'Rédigez d\'abord votre narration.'; return; }
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
    const sys = `Tu es ${m.name||m.role}, ${m.role} de ${G.nation}. Date : ${G.date}. Relations : ${rels||'stables'}. Donne ton avis personnel et direct sur l'action suivante en 1-2 phrases. Sois concis, opinioné, reste dans ton rôle.`;
    try {
      const resp = await geminiCallFull(sys, [{role:'user',parts:[{text:`Action proposée : "${draft}"`}]}], 300);
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
  const addBtn = document.getElementById('btn-add-narration');
  const nextBtn = document.getElementById('btn-next-turn');
  if (addBtn)  addBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  pushTurnSnapshot();
  const thinkEl = addThinking();
  try {
    const raw = await geminiActionCall(buildActionPrompt('__SKIP__'));
    thinkEl.remove();
    await resolveAction(raw);
  } catch(e) {
    thinkEl.remove();
    displayDebugError(e);
  }
  if (addBtn)  addBtn.disabled = false;
  if (nextBtn) nextBtn.disabled = false;
}

// Mots-clés déclenchant la détection d'engagements/ordres (français)
const _COMMIT_KEYWORDS_DIPLO = [
  // militaire
  'envoie','envoyer','envoyons','envoyons','envoie',"j'envoie",'déploie','déployer','déploient','déploierons','troupes','offensive','défendre','défends','défendrons','bombarder','bombardons','attaquer','attaquons','mobiliser','mobilise','mobilisons','renforcer','renforce','renforcerons','intervenir','intervenons',
  // économique
  'sanctions','embargo','aide financière','accord commercial','livrer','livre','livrerons','fournir','fournis','fournirons','financement','investissement',
  // diplomatique
  'alliance','pacte','traité','soutien','reconnaître','reconnaissons','reconnais','voter pour','voter contre','condamner','condamnons',
  // promesses
  'je promets','nous promettons','nous allons',"je m'engage",'nous nous engageons','vous avez ma parole',"j'accepte",'nous acceptons','nous signerons','nous accepterons','nous garantissons'
];

const _ORDER_KEYWORDS_STAFF = [
  'lancez','lance','préparez','prépare','ordonnez','ordonne','déployez','déploie','négociez','négocie','signez','signe',
  'annulez','annule','renforcez','renforce','mobilisez','mobilise','envoyez','envoie','imposez','impose','démarrez','démarre',
  'attaquez','attaque','défendez','défends','interceptez','arrêtez','initiez','initie','prenez','assurez','planifiez','plan',
  'préparer','lancer','mobiliser','déployer','négocier','signer','annuler','renforcer','envoyer','imposer',"prépare-toi",'lancer'
];

function _hasAnyKeyword(text, list) {
  if (!text) return false;
  const low = text.toLowerCase();
  return list.some(k => low.includes(k));
}

function buildDiplomaticContext() {
  if (!G.conversations || !G.conversations.length) return '';
  const active = G.conversations.filter(c => c.messages && c.messages.length >= 2);
  if (!active.length) return '';
  // Limite aux 8 conversations les plus récentes (ordre d'apparition du tableau)
  const convs = active.slice(-8);
  const lines = ['\u2550\u2550\u2550 CANAUX DIPLOMATIQUES ACTIFS \u2550\u2550\u2550'];
  for (const c of convs) {
    const others = c.nations.filter(n => n.code !== G.nationCode);
    if (!others.length) continue;
    const othersLbl = others.map(n => n.name).join(', ');
    const firstOther = others[0];
    const relRaw = firstOther ? G.relations[firstOther.code] : null;
    const relLabel = relRaw ? (typeof REL_LABELS !== 'undefined' ? (REL_LABELS[relRaw] || relRaw) : relRaw) : 'neutre';
    // Derniers 8 messages
    const recent = c.messages.slice(-8);
    // Dernier engagement détecté (message joueur récent avec mots-clés)
    const engagement = [...recent].reverse().find(m =>
      (m.isPlayer || m.code === G.nationCode) && _hasAnyKeyword(m.text, _COMMIT_KEYWORDS_DIPLO)
    );
    lines.push(`[${othersLbl}] (relation: ${relLabel}) Sujet: ${c.subject || '\u2014'}`);
    if (engagement) {
      lines.push(`  \u26a0 ENGAGEMENT JOUEUR: "${(engagement.text||'').slice(0, 240)}"`);
    }
    lines.push('  Derniers \u00e9changes:');
    for (const m of recent) {
      const who = (m.from || '').slice(0, 18);
      const txt = (m.text || '').slice(0, 200);
      if (!txt) continue;
      lines.push(`  - ${who}: "${txt}"`);
    }
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function buildStaffContext() {
  if (!G.staff) return '';
  const allMembers = [
    ...(G.staff.militaires || []),
    ...(G.staff.ministres || [])
  ].filter(m => m && m.active && Array.isArray(m.messages) && m.messages.length >= 1);
  if (!allMembers.length) return '';
  // 6 membres les plus actifs (par longueur de conversation)
  const ranked = allMembers
    .map(m => ({ m, n: m.messages.length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map(x => x.m);
  const lines = ['\u2550\u2550\u2550 ORDRES GOUVERNEMENTAUX \u2550\u2550\u2550'];
  for (const m of ranked) {
    const recent = (m.messages || []).slice(-6);
    const order = [...recent].reverse().find(msg =>
      msg.isPlayer && msg.text && msg.text.length >= 10 &&
      _hasAnyKeyword(msg.text, _ORDER_KEYWORDS_STAFF)
    );
    const lastPlayer = [...recent].reverse().find(msg => msg.isPlayer && msg.text);
    const lastReply  = [...recent].reverse().find(msg => !msg.isPlayer && msg.text);
    const icon = m.icon || '\u2022';
    const name = m.name ? `${m.name}, ${m.role}` : m.role;
    const label = `${icon} ${name}`;
    const block = [`[${label}]`];
    if (order) {
      block.push(`  ORDRE: "${order.text.slice(0,220)}"`);
    } else if (lastPlayer) {
      block.push(`  Dernier message joueur: "${lastPlayer.text.slice(0,200)}"`);
    }
    if (lastReply) {
      block.push(`  R\u00e9ponse: "${lastReply.text.slice(0,220)}"`);
    }
    if (block.length > 1) lines.push(...block);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function buildNarrativeContext() {
  const items = (G.fullHistory || []).slice(-15);
  const decrees = items.filter(h => h.type === 'decree').slice(-3)
    .map(h => `[T${h.turn}] D\u00e9cret: ${(h.texte||'').slice(0,120)}`);
  const events = items.filter(h => h.type === 'event' || h.type === 'breaking').slice(-5)
    .map(h => `[T${h.turn}] ${h.titre}: ${(h.texte||'').slice(0,80)}`);
  const treaties = (G.treaties||[]).filter(t => t.active).slice(-3)
    .map(t => `Trait\u00e9 ${t.label} avec ${t.parties.map(p=>p.name).join(',')}`);
  const result = [...decrees, ...events, ...treaties].join('\n');
  return result || (G.actionHistory.slice(-2).map(h=>`T${h.turn}:${h.action.slice(0,60)}`).join('|')) || '-';
}

function buildTerritorialContext() {
  if (typeof RECOGNITION === 'undefined') return '';
  const sections = [];

  const playerRec = RECOGNITION[G.nationCode];
  if (playerRec) {
    const recognizedCount = playerRec.recognized_by.size;
    const claimedByName = NAMES[playerRec.claimed_by] || '?';
    sections.push(
      `${G.nation} est un TERRITOIRE DISPUTÉ. ` +
      `Reconnu par ~${recognizedCount} pays. ` +
      `Revendiqué par ${claimedByName} (code ${playerRec.claimed_by}). ` +
      `Membre ONU : ${playerRec.un_member ? 'oui' : 'non'}.`
    );
  }

  Object.keys(G.relations).forEach(k => {
    const code = +k;
    const rec = RECOGNITION[code];
    if (!rec || code === G.nationCode) return;
    const name = NAMES[code] || code;
    const recognized = isRecognizedBy(code, G.nationCode);
    sections.push(
      `${name} : territoire disputé, ${recognized ? 'reconnu' : 'NON reconnu'} par ${G.nation}. Revendiqué par ${NAMES[rec.claimed_by] || '?'}.`
    );
  });

  if (!sections.length) return '';
  return '═══ CONTEXTE TERRITORIAL ═══\n' + sections.join('\n') + '\n' +
    'RÈGLE : Si un conflit implique un territoire disputé, les nations qui le reconnaissent ' +
    'traitent l\'agression comme une invasion étrangère. Les nations qui ne le reconnaissent pas ' +
    'traitent l\'action comme une affaire intérieure du pays revendiquant. ' +
    'Cela détermine les coalitions, sanctions et soutiens automatiques.';
}

function buildActionPrompt(action) {
  const rels = Object.entries(G.relations)
    .filter(([,r]) => r !== 'neutral')
    .map(([c,r]) => `${NAMES[c]||c}:${r[0]}`)
    .join(',');
  const hist = buildNarrativeContext();
  const prevTurnCtx = G.lastAiSummary ? `\nRésultat tour précédent: ${G.lastAiSummary}` : '';
  const memoryCtx = (G.consolidations || []).slice(-3).map(c =>
    `[Tours ${c.fromTurn}-${c.toTurn}, ${c.date}] ${c.text}`
  ).join('\n');
  const memoryLine = memoryCtx ? `\nMÉMOIRE HISTORIQUE:\n${memoryCtx}` : '';

  // État de la nation (ressources, opinion, traités, diplo)
  const nationState = [];
  if (G.modules.ressources) {
    nationState.push(`Ressources ${G.nation}: Tr\u00e9sorerie=${G.ressources.tresorerie}/100, Stabilit\u00e9=${G.ressources.stabilite}/100, Puissance=${G.ressources.puissance}/100`);
  }
  if (G.modules.opinion) {
    nationState.push(`Opinion publique: ${G.opinionScore}/100`);
  }
  const activeTreaties = (G.treaties||[]).filter(t => t.active).slice(0, 5);
  if (activeTreaties.length) {
    nationState.push('Trait\u00e9s actifs: ' + activeTreaties.map(t =>
      `${t.label} avec ${t.parties.filter(p=>p.code!==G.nationCode).map(p=>p.name).join(',')}`
    ).join('; '));
  }
  // Engagements diplomatiques consolidés (ceux trackés dans G.diplomaticCommitments)
  const commitments = (G.diplomaticCommitments||[]).slice(-15);
  if (commitments.length) {
    nationState.push('Engagements actifs (\u22645 tours): ' + commitments.map(c => {
      const src = c.source ? `[${c.source}]` : '';
      const typ = c.type === 'auto' ? '~' : '';
      return `T${c.turn}${typ}${src} ${c.nation||'?'}: ${(c.description||'').slice(0,160)}`;
    }).join(' | '));
  }
  const nationCtx = nationState.join('\n');

  // Sections dédiées : conversations diplomatiques + ordres staff
  const diploSection = buildDiplomaticContext();
  const staffSection = buildStaffContext();
  const territorialSection = buildTerritorialContext();
  const diploBlock = diploSection ? `\n\n${diploSection}` : '';
  const staffBlock = staffSection ? `\n\n${staffSection}` : '';
  const territorialBlock = territorialSection ? `\n\n${territorialSection}` : '';

  // Instructions forçant l'IA à respecter ces canaux
  let diploInstructions = '';
  if (diploSection || staffSection) {
    const parts = ['\u2550\u2550\u2550 INSTRUCTIONS CRITIQUES \u2550\u2550\u2550'];
    if (diploSection) {
      parts.push("Les canaux diplomatiques ci-dessus sont des engagements R\u00c9ELS du joueur. Si le joueur a promis d'envoyer des troupes, le tour suivant DOIT refl\u00e9ter cet envoi. Si un accord a \u00e9t\u00e9 discut\u00e9, les nations impliqu\u00e9es doivent r\u00e9agir en cons\u00e9quence. Les promesses non tenues doivent entra\u00eener une d\u00e9gradation des relations. IGNORER les conversations diplomatiques est INTERDIT.");
    }
    if (staffSection) {
      parts.push("Les ordres gouvernementaux ci-dessus sont des D\u00c9CISIONS ACTIVES du joueur transmises via son \u00e9tat-major. L'IA DOIT en tenir compte : si un g\u00e9n\u00e9ral a re\u00e7u l'ordre de pr\u00e9parer une offensive, les \u00e9v\u00e9nements du tour doivent refl\u00e9ter cette pr\u00e9paration (mouvements de troupes, r\u00e9actions ennemies, co\u00fbts logistiques). Si un ministre a re\u00e7u un ordre \u00e9conomique, les cons\u00e9quences doivent appara\u00eetre.");
    }
    diploInstructions = '\n\n' + parts.join('\n');
  }

  // Rapport de force mondial
  const powerRanking = (() => {
    const powers = [
      { code: 840, label: 'USA', power: 99 },
      { code: 156, label: 'Chine', power: 93 },
      { code: 643, label: 'Russie', power: 87 },
      { code: 826, label: 'UK', power: 74 },
      { code: 250, label: 'France', power: 71 },
      { code: 356, label: 'Inde', power: 77 },
      { code: 392, label: 'Japon', power: 42 },
    ];
    if (!powers.find(p => p.code === G.nationCode) && G.modules.ressources) {
      powers.push({ code: G.nationCode, label: G.nation, power: G.ressources.puissance });
    }
    const playerP = powers.find(p => p.code === G.nationCode);
    if (playerP && G.modules.ressources) playerP.power = G.ressources.puissance;
    powers.sort((a, b) => b.power - a.power);
    return 'Puissances mondiales: ' + powers.slice(0, 7).map(p => `${p.label}(${p.power})`).join(' > ');
  })();

  const RCODE = {ally:'a',tension:'t',hostile:'h',war:'w',neutral:'n'};
  const world = Object.entries(G.worldRels).slice(0,20)
    .map(([k,r])=>{ const [a,b]=k.split('-').map(Number); return `${NAMES[a]?.split(' ')[0]?.slice(0,4)||a}-${NAMES[b]?.split(' ')[0]?.slice(0,4)||b}:${RCODE[r]||'n'}`; })
    .join(',');

  const diffLine = `Difficult\u00e9:${G.difficulty}`;

  // Saut temporel
  const jumpCfg = {
    semaine:   { label:'7 jours',  dateRule:'date+7j',    densityMin:1, densityMax:2, worldEventsCount:'1', worldBoostMult: 0 },
    mois:      { label:'1 mois',   dateRule:'date+1mois', densityMin:2, densityMax:4, worldEventsCount:'1-2', worldBoostMult: 0.5 },
    trimestre: { label:'3 mois',   dateRule:'date+3\u00e06mois',densityMin:3, densityMax:6, worldEventsCount:'2-3', worldBoostMult: 1 },
    semestre:  { label:'6 mois',   dateRule:'date+6mois', densityMin:4, densityMax:8, worldEventsCount:'3-4', worldBoostMult: 1.5 },
    an:        { label:'12 mois',  dateRule:'date+12mois',densityMin:5, densityMax:10, worldEventsCount:'4-6', worldBoostMult: 2 },
    event:     { label:'→ prochain événement', dateRule:'LIBRE', densityMin:1, densityMax:4, worldEventsCount:'1-2', worldBoostMult: 1 }
  };
  const jcfg = jumpCfg[_jumpDuration] || jumpCfg.trimestre;

  // Event jump mode
  let eventJumpInstruction = '';
  if (_jumpDuration === 'event') {
    eventJumpInstruction = `
SAUT ÉVÉNEMENTIEL : NE PAS utiliser une durée fixe. Avance le temps jusqu'au PROCHAIN ÉVÉNEMENT MAJEUR qui se produit naturellement dans le monde ou qui impacte le joueur. Exemples d'événements déclencheurs : élection dans un pays clé, début d'un conflit, traité majeur signé, crise économique, catastrophe, coup d'État, mort d'un dirigeant, sommet international. La nouvelle_date doit refléter le moment où cet événement se produit (ça peut être 2 semaines comme 8 mois). Le PREMIER événement de la liste evenements doit être l'événement déclencheur (celui qui a justifié l'arrêt du temps).`;
  }
  const dateRuleLine = _jumpDuration === 'event'
    ? 'nouvelle_date=date du prochain événement majeur (durée libre, l\'IA décide)'
    : jcfg.dateRule;

  // Module-specific rules
  let moduleRules = '';
  if (G.modules.ressources)   moduleRules += ';RESSOURCES:retourne impact_ressources={tresorerie:entier-20à+20,stabilite:entier-15à+15,puissance:entier-10à+10}';
  if (G.modules.opinion)      moduleRules += ';OPINION:retourne opinion_publique={score:0-100,commentaire:"réaction du peuple en 1 phrase"}';
  if (G.modules.crises)       moduleRules += ';CRISES:si pertinent retourne evenement_crise={titre,effet,impact}(pandémie/krach/catastrophe)';
  if (G.modules.geopolitique) moduleRules += ';GÉOPOL:0-2 evolutions_mondiales si l\'action influence des relations entre pays tiers';

  // Variété narrative
  const avoidTypes = (G.lastWorldEventTypes || []).join(', ');
  const varietyHint = avoidTypes ? `\n- ÉVITER ces types d'événements mondiaux (déjà utilisés au tour précédent) : ${avoidTypes}` : '';

  const schema = '{"nouvelle_date":"Mois AAAA","resume_action":"10 mots max","evenements":[{"categorie":"DIPLOMATIQUE|MILITAIRE|ÉCONOMIQUE|POLITIQUE|HUMANITAIRE","titre":"...","texte":"2 phrases."}],"contacts_entrants":[{"code":840,"sujet":"...","message":"2 phrases."}],"conversations_auto":[{"codes":[643,156],"sujet":"...","message":"1 phrase précise."}],"relations_modifiees":[{"code":840,"statut":"ally|tension|hostile|war|neutral"}],"evolutions_mondiales":[{"paysA":840,"paysB":156,"nouveau_statut":"war","raison_courte":"1 phrase."}]}';

  // Faction context
  const factCtx = Object.entries(G.factions||{}).map(([nom,f])=>`${nom}(${NAMES[f.pays]||f.pays},intensité:${f.intensite}/10)`).join(';');

  // Inject war state so Gemini knows near-defeat situations
  const warCtx = Object.entries(G.warProgress||{}).map(([def,wp]) => {
    const prog = wp.progress;
    const atkName = NAMES[wp.attacker]||wp.attacker;
    const defName = NAMES[+def]||def;
    const status = prog >= 80 ? 'QUASI-VICTOIRE attaquant — capitulation imminente'
                : prog >= 60 ? 'Avantage attaquant — offensive en cours'
                : prog <= 20 ? 'QUASI-VICTOIRE défenseur — attaquant épuisé'
                : prog <= 40 ? 'Avantage défenseur — contre-offensive'
                : 'Front stabilisé — guerre d\'usure';
    const zones = (wp.zones||[]).join(', ');
    const isPlayerInvolved = +def === G.nationCode || wp.attacker === G.nationCode;
    const costNote = isPlayerInvolved ? ' [COÛTE trésorerie et stabilité chaque tour]' : '';
    return `${atkName}→${defName}: ${prog}% — ${status}${zones ? '. Zones: '+zones : ''}${costNote}`;
  }).join('\n');

  // Contexte régions pour map_changes
  let regionCtx = '';
  if (G.regions && G.regions.length) {
    const playerRegs = G.regions.filter(r => r.owner === G.nationCode).map(r => r.name);
    regionCtx = `\nRégions de ${G.nation}: ${playerRegs.slice(0, 15).join(', ')}${playerRegs.length > 15 ? '...' : ''}`;
    const warCodes = Object.entries(G.warProgress || {}).map(([d, w]) =>
      +d === G.nationCode ? w.attacker : +d
    ).filter(c => c);
    warCodes.forEach(code => {
      const name = getCountryName(code);
      const regs = G.regions.filter(r => r.owner === code).map(r => r.name);
      if (regs.length) {
        regionCtx += `\nRégions de ${name}: ${regs.slice(0, 10).join(', ')}${regs.length > 10 ? '...' : ''}`;
      }
    });
    // Régions des pays mentionnés dans l'action
    const actionLower = action.toLowerCase();
    Object.entries(NAMES).forEach(([code, name]) => {
      if (actionLower.includes(name.toLowerCase()) && +code !== G.nationCode) {
        const regs = G.regions.filter(r => r.owner === +code).map(r => r.name);
        if (regs.length && !regionCtx.includes(name)) {
          regionCtx += `\nRégions de ${name}: ${regs.join(', ')}`;
        }
      }
    });
  }

  const scenCtx = G.scenarioContext ? `SC\u00c9NARIO:"${G.scenarioContext.slice(0,200)}" ` : '';

  // Monde vivant : toujours actif, modulé par durée de saut
  const worldEventCount = {
    semaine: '0-1 evolution_mondiale mineure',
    mois: '1-2 evolutions_mondiales',
    trimestre: '2-3 evolutions_mondiales significatives',
    semestre: '3-4 evolutions_mondiales majeures',
    an: '4-5 evolutions_mondiales transformatrices'
  };
  // Calendrier événementiel
  const WORLD_CALENDAR = {
    'Janvier':['Forum de Davos'],'F\u00e9vrier':['Sommet UA'],'Mars':['Conseil europ\u00e9en'],
    'Avril':['R\u00e9unions FMI'],'Mai':['Eurovision'],'Juin':['Sommet G7'],
    'Juillet':['Sommet OTAN'],'Ao\u00fbt':['Crises humanitaires'],'Septembre':['AG ONU'],
    'Octobre':['Prix Nobel','Sommet BRICS'],'Novembre':['G20','COP Climat'],'D\u00e9cembre':['Bilans annuels']
  };
  const currentMonth = (G.date || '').split(' ')[0] || '';
  const calendarEvents = WORLD_CALENDAR[currentMonth];
  const calendarCtx = calendarEvents ? ` Calendrier: ${calendarEvents.join(', ')}.` : '';
  const worldBoost = `
MONDE VIVANT : Le monde évolue indépendamment du joueur, mais de manière RÉALISTE.
- Les guerres entre pays tiers sont RARES (1-2 par an max dans le monde). Les tensions montent progressivement avant un conflit.
- Les événements courants : élections, réformes économiques, accords commerciaux, sommets diplomatiques, crises humanitaires, scandales politiques, avancées scientifiques.
- Les guerres existantes évoluent (cessez-le-feu, escalade, négociations) mais de nouvelles guerres ne démarrent que si les tensions sont au maximum depuis plusieurs tours.
- Si ${_jumpDuration} est "semaine" ou "mois" : 0-1 évolution mondiale mineure.
- Si ${_jumpDuration} est "trimestre" : 1-2 évolutions mondiales, dont max 1 changement de relation significatif.
- Si ${_jumpDuration} est "semestre" ou "an" : 2-4 évolutions mondiales, des élections, des traités, possiblement 1 nouveau conflit si les tensions existantes l'imposent.
- RÉALISME : consulte le calendrier mondial. En janvier = Davos, en septembre = AG ONU, en novembre = G20/COP. Les événements doivent coller à la période.${calendarCtx}`;
  const isAutonomousTurn = action === '__SKIP__' || action === '__WORLD_EVENT__';
  const actionLine = isAutonomousTurn
    ? `Le joueur ne fait rien ce tour. Le monde continue d'évoluer sans intervention de ${G.nation}. Génère des événements mondiaux autonomes riches : élections dans des pays tiers, coups d'État, traités signés entre nations sans le joueur, crises économiques locales, mouvements populaires. Aucun contact entrant ciblant le joueur, aucune modification de ses relations sauf si un événement externe l'impose logiquement.`
    : `Action du joueur:"${action}"`;
  return `ORBIS g\u00e9opol 2025. ${scenCtx}Joueur:${G.nation} | Style:${G.style} | Date:${G.date} | Tour:${G.turn} | Saut:${jcfg.label}
${diffLine}

\u2550\u2550\u2550 \u00c9TAT DE LA NATION \u2550\u2550\u2550
${nationCtx || 'Aucune donn\u00e9e'}
${powerRanking}

\u2550\u2550\u2550 RELATIONS \u2550\u2550\u2550
Joueur: ${rels||'aucune'} | Monde: ${world||'stable'}${territorialBlock}

\u2550\u2550\u2550 CONTEXTE \u2550\u2550\u2550
${hist}${prevTurnCtx}${memoryLine}
${warCtx?`\n\u2550\u2550\u2550 CONFLITS \u2550\u2550\u2550\nGuerres:${warCtx}`:''}${factCtx?`\nInsurrections:${factCtx}`:''}${regionCtx}${diploBlock}${staffBlock}

\u2550\u2550\u2550 ACTION \u2550\u2550\u2550
${actionLine}${diploInstructions}

\u2550\u2550\u2550 MONDE VIVANT \u2550\u2550\u2550${worldBoost}${eventJumpInstruction}
JSON STRICT uniquement (pas de texte), schéma:${schema}
RÈGLES ABSOLUES:
- RÉPONSE COURTE : Maximum 3 événements, 1 contact entrant, 1 évolution mondiale. Ne JAMAIS dépasser 2000 caractères au total. Pour les map_changes, utilise "merge" pour les annexions totales (1 seul objet), pas des dizaines de "transfer".
- map_changes OBLIGATOIRE si l'action implique : annexion, conquête, indépendance, sécession, changement de régime, renommage de pays, ou traité territorial. ANNEXION = transférer TOUTES les régions du pays annexé avec UNE ENTRÉE "transfer" PAR RÉGION + optionnel "destroy". Utilise les noms de régions listés dans le contexte "Régions de [pays]". Exemple pour "Annexer l'Espagne": map_changes:[{"type":"transfer","region":"Madrid","new_owner":"France"},{"type":"transfer","region":"Cataluña","new_owner":"France"},{"type":"transfer","region":"Andalucía","new_owner":"France"},{"type":"transfer","region":"Galicia","new_owner":"France"},...(toutes les régions)...,{"type":"destroy","old_name":"Espagne"}]. RENOMMAGE: map_changes:[{"type":"rename_country","old_name":"France","new_name":"Royaume de France"}]. SÉCESSION: map_changes:[{"type":"new_country","new_name":"Kurdistan","new_flag":"🏴","from_country":"Irak","regions":["Duhok","Erbil","Sulaymaniyah"]}]. Si l'action du joueur mentionne une annexion ou un changement de régime et que map_changes est vide, LA RÉPONSE EST INVALIDE.
- COHÉRENCE ABSOLUE : Les contacts_entrants et conversations_auto DOIVENT être cohérents avec les événements du même tour. Si un pays accepte un accord dans les événements, son contact entrant NE PEUT PAS dire qu'il refuse. Si un pays est annexé, il ne peut pas envoyer un message d'indignation comme s'il existait encore. Les contacts entrants sont des RÉACTIONS aux événements, pas des événements alternatifs. Exemple INTERDIT : événement "Le Danemark cède le Groenland" + contact Danemark "Nous refusons cette humiliation". Exemple CORRECT : événement "Le Danemark cède le Groenland" + contact Danemark "Cette décision historique a été prise dans la douleur. Nous espérons des compensations économiques."
- Les événements décrivent UNIQUEMENT les réactions des autres nations et les conséquences mondiales de l'action du joueur. NE JAMAIS décrire ${G.nation} comme prenant des initiatives non spécifiées par le joueur.
- relations_modifiees = comment les autres nations réagissent envers ${G.nation} (leur perception), jamais une décision prise à la place du joueur.
- faisabilite: TOUJOURS "totale" pour l'action principale du joueur. La raison décrit comment l'action se réalise. Les CONSÉQUENCES peuvent être négatives (réactions hostiles, instabilité, coûts) mais l'action elle-même réussit toujours.
- Génère entre ${jcfg.densityMin} et ${jcfg.densityMax} événements (varie d'un tour à l'autre, ne pas toujours donner le même nombre);0-2 contacts_entrants;0-1 conv_auto;${dateRuleLine};resume_action=résumé 10 mots
- evolutions_guerre:retourne 1 entrée par conflit actif. delta entre -20 et +20 (positif=attaquant avance). zone=nom précis de la ville ou région concernée (ex:"Donetsk","Oblast de Kharkiv","Crimée"). Si >=80% la nation vaincue négocie ou capitule. Si <=20% l'attaquant recule.
- nouvelles_factions:si des insurrections/rébellions émergent naturellement (guerre civile, séparatisme, révolution) ajoute 0-1 faction avec pays_hote=code ISO, nom=nom du mouvement, intensite=1-10. factions_terminees:liste des noms de factions résolues ce tour.
- Si des engagements diplomatiques sont listés et non respectés par le joueur, les nations concernées réagissent négativement.
- evenements_mondiaux:OBLIGATOIRE ${jcfg.worldEventsCount || '1-2'} faits divers variés et réalistes, totalement indépendants de l'action du joueur. Catégories possibles (varier à chaque tour): catastrophes naturelles, faits divers criminels, accidents industriels/transports, records économiques/boursiers, scandales sportifs/culturels, pandémies/épidémies locales, incidents sociaux/manifestations, découvertes scientifiques/technologiques, événements météo extrêmes, décisions judiciaires marquantes, exploits sportifs, inaugurations/lancements. Lieu précis, titre accrocheur, 2 phrases. NE PAS répéter les mêmes catégories d'un tour à l'autre.${varietyHint}
- VARIÉTÉ NARRATIVE : Ne JAMAIS répéter un type d'événement du tour précédent. Si le tour précédent contenait un séisme, ce tour NE DOIT PAS contenir de catastrophe naturelle. Si le tour précédent contenait un sommet diplomatique, varier avec du sport, de la science, du crime, de la culture, de l'insolite. Chaque tour doit surprendre le joueur.
- map_changes: Modifications de carte (0-2 max). UTILISER quand des territoires changent de main, des pays sont renommés ou de nouveaux pays émergent. Types: "transfer"(region+new_owner), "rename_country"(old_name+new_name), "new_country"(new_name+new_flag+from_country+regions), "split"(from_country+new_name+regions), "merge"(countries+into), "destroy"(old_name). IMPORTANT: Quand des territoires changent de main suite à une guerre, un traité ou une révolution, utilise map_changes pour refléter ces changements sur la carte.
  * Pour une ANNEXION TOTALE d'un pays, ne PAS lister chaque région individuellement. Utilise un seul map_change de type "merge" : {"type":"merge","countries":["France","Espagne"],"into":"Frespagne"} Le code côté client transférera automatiquement toutes les régions. N'utilise "transfer" que pour des transferts de 1-3 régions spécifiques.${moduleRules}`;
}


function applyWarCosts() {
  if (!G.modules.ressources || !G.warProgress) return;
  const playerWars = Object.entries(G.warProgress).filter(([def, wp]) =>
    +def === G.nationCode || wp.attacker === G.nationCode
  );
  if (!playerWars.length) return;
  const totalCost = { tresorerie: -5 * playerWars.length, stabilite: -3 * playerWars.length, puissance: -1 * playerWars.length };
  applyResourceDelta(totalCost);
  if (playerWars.length >= 2) showAlertToast('\u2694', 'Co\u00fbt de guerre', `${playerWars.length} guerres drainent vos ressources.`, 'warn');
}

function consolidateMemory() {
  if (!G.consolidations) G.consolidations = [];
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
  if (G.consolidations.length > 10) G.consolidations.shift();
  console.info(`[MEMORY] Consolidation tours ${consolidation.fromTurn}-${consolidation.toTurn}`);
}

async function resolveAction(raw) {
  applyWarCosts();
  // Expire les engagements de plus de 5 tours (nettoyage avant résolution)
  if (Array.isArray(G.diplomaticCommitments) && G.diplomaticCommitments.length) {
    G.diplomaticCommitments = G.diplomaticCommitments.filter(c =>
      c && typeof c.turn === 'number' && (G.turn - c.turn) <= 5
    );
  }
  const data = parseActionJson(raw); // throws GeminiError('JSON') if all strategies fail
  console.log('[DEBUG] map_changes:', JSON.stringify(data.map_changes));

  // Stocker un résumé de la réponse IA pour le prochain tour
  G.lastAiSummary = '';
  try {
    const evSummary = (data.evenements || []).slice(0, 3).map(e => e.titre).join(', ');
    const relSummary = (data.relations_modifiees || []).map(r => `${NAMES[r.code]||r.code}→${r.statut}`).join(', ');
    const fais = data.faisabilite?.reussite || '?';
    G.lastAiSummary = `[Tour ${G.turn}] Faisabilité:${fais}. Événements:${evSummary||'aucun'}. Relations:${relSummary||'inchangées'}. ${data.resume_action||''}`.slice(0, 300);
  } catch {}

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
  if (typeof renderTimelineNodes === 'function') renderTimelineNodes();

  // ═══ Construire la chronologie complète du tour ═══
  const chronoEvents = [];

  // 1) Événements principaux (actualités directes, pas de carte méta "Action réalisée")
  if (Array.isArray(data.evenements)) {
    chronoEvents.push(...data.evenements);
  }

  // 2) Fronts de guerre — résoudre codes OU noms de pays, ignorer les entrées non résolues
  if (Array.isArray(data.evolutions_guerre)) {
    data.evolutions_guerre.forEach(ev => {
      let atkCode = +ev.attaquant;
      if (!NAMES[atkCode] && typeof ev.attaquant === 'string' && typeof findCountryByName === 'function') {
        const resolved = findCountryByName(ev.attaquant);
        if (resolved) { atkCode = resolved; ev.attaquant = resolved; }
      }
      let defCode = +ev.defenseur;
      if (!NAMES[defCode] && typeof ev.defenseur === 'string' && typeof findCountryByName === 'function') {
        const resolved = findCountryByName(ev.defenseur);
        if (resolved) { defCode = resolved; ev.defenseur = resolved; }
      }
      const atkName = NAMES[atkCode];
      const defName = NAMES[defCode];
      if (!atkName || !defName) return; // skip unresolved: évite "? vs ?"
      chronoEvents.push({
        categorie: 'MILITAIRE',
        titre: `Front : ${atkName} vs ${defName}`,
        texte: `${ev.raison_courte || 'Évolution du front.'} Zone : ${ev.zone || 'inconnue'}. Delta : ${ev.delta > 0 ? '+' : ''}${ev.delta}%.`
      });
    });
  }

  // 3) Événements mondiaux
  if (Array.isArray(data.evenements_mondiaux)) {
    data.evenements_mondiaux.forEach(ev => {
      chronoEvents.push({
        categorie: 'MONDE',
        titre: ev.titre || 'Événement mondial',
        texte: ev.texte || '',
        lieu: ev.lieu
      });
    });
  }

  // 4) Map changes résumés
  if (Array.isArray(data.map_changes)) {
    data.map_changes.forEach(mc => {
      if (mc.type === 'transfer') {
        chronoEvents.push({ categorie: 'MILITAIRE', titre: `Transfert : ${mc.region}`, texte: `${mc.region} passe sous contrôle de ${mc.new_owner}.` });
      } else if (mc.type === 'rename_country') {
        chronoEvents.push({ categorie: 'POLITIQUE', titre: `Renommage : ${mc.old_name} → ${mc.new_name}`, texte: `${mc.old_name} se renomme en ${mc.new_name}.` });
      } else if (mc.type === 'new_country') {
        chronoEvents.push({ categorie: 'POLITIQUE', titre: `Indépendance : ${mc.new_name}`, texte: `${mc.new_name} fait sécession de ${mc.from_country}.` });
      }
    });
  }

  // Lancer la chronologie
  await startEventPresentation(chronoEvents);

  // Show contextual map icons for all events after presentation
  const CAT_ICON = { MILITAIRE:'💥', DIPLOMATIQUE:'🤝', ÉCONOMIQUE:'📈', POLITIQUE:'⚡', HUMANITAIRE:'🆘', SOCIAL:'🏛', SCIENTIFIQUE:'🔬', ENVIRONNEMENT:'🌿', CULTUREL:'🎭', DIVERS:'📌' };
  for (const ev of chronoEvents) {
    const fullText = (ev.titre || '') + (ev.texte || '');
    const keywordIcon = /congrès|sommet|accord|traité|forum|réunion|assemblée/i.test(fullText) ? '🏛'
                      : /catastrophe|séisme|inondation|ouragan|tremblement/i.test(fullText) ? '🌪'
                      : /élection|vote|référendum/i.test(fullText) ? '🗳'
                      : /scandale|corruption|arrestation/i.test(fullText) ? '⚠'
                      : /découverte|scientifique|recherche/i.test(fullText) ? '🔬'
                      : null;
    const icon = keywordIcon || CAT_ICON[ev.categorie];
    if (icon) {
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
      let atk = +ev.attaquant, def = +ev.defenseur;
      if (!NAMES[atk] && typeof ev.attaquant === 'string' && typeof findCountryByName === 'function') atk = findCountryByName(ev.attaquant) || NaN;
      if (!NAMES[def] && typeof ev.defenseur === 'string' && typeof findCountryByName === 'function') def = findCountryByName(ev.defenseur) || NaN;
      if (!NAMES[atk] || !NAMES[def]) continue;
      const d = Math.max(-25, Math.min(25, +ev.delta || 0));
      if (!G.warProgress[def]) G.warProgress[def] = { attacker: atk, progress: 50, zones: [] };
      if (!G.warProgress[def].zones) G.warProgress[def].zones = [];
      G.warProgress[def].progress = Math.max(0, Math.min(100, G.warProgress[def].progress + d));

      // Transfert progressif de provinces PAR ADJACENCE DIRECTIONNELLE
      if (d3provinces.length && G.provinceOwnership) {
        if (d > 0) {
          let frontier = getConquerableFrontier(def, atk);
          if (frontier.length) {
            // Pondérer par proximité au centroïde du territoire déjà conquis
            const conqueredPids = (countryToProvinces[def] || []).filter(pid =>
              G.provinceOwnership[pid] === atk
            );
            let fx = 0, fy = 0, cnt = 0;
            const _pc = window._provCentroids || {};
            conqueredPids.forEach(pid => {
              const c = _pc[pid];
              if (c) { fx += c[0]; fy += c[1]; cnt++; }
            });
            if (cnt) {
              fx /= cnt; fy /= cnt;
              frontier = frontier.map(pid => {
                const c = _pc[pid];
                if (!c) return { pid, dist: Infinity };
                return { pid, dist: (c[0]-fx)**2 + (c[1]-fy)**2 };
              }).sort((a, b) => a.dist - b.dist);
              const n = Math.max(1, Math.round(frontier.length * Math.abs(d) / 100));
              for (let t = 0; t < n && t < frontier.length; t++) {
                G.provinceOwnership[frontier[t].pid] = atk;
              }
            } else {
              const n = Math.max(1, Math.round(frontier.length * Math.abs(d) / 100));
              const shuffled = [...frontier].sort(() => Math.random() - 0.5);
              for (let t = 0; t < n && t < shuffled.length; t++) {
                G.provinceOwnership[shuffled[t]] = atk;
              }
            }
          }
          // Combler les trous après avancée
          const defProvs2 = countryToProvinces[def] || [];
          let filled2 = true;
          let safetyCounter = 0;
          while (filled2 && safetyCounter < 30) {
            filled2 = false;
            safetyCounter++;
            const remaining2 = defProvs2.filter(pid => (G.provinceOwnership[pid] ?? def) === def);
            for (const pid of remaining2) {
              const neighbors = provinceAdjacency[pid];
              if (!neighbors || !neighbors.size) continue;
              let sameCN = 0, conquCN = 0;
              for (const nPid of neighbors) {
                const nFeat = typeof _provinceFeatMap !== 'undefined' && _provinceFeatMap && _provinceFeatMap.get(Number(nPid) || nPid);
                if (!nFeat || nFeat._countryCode !== def) continue;
                sameCN++;
                if (G.provinceOwnership[nPid] === atk) conquCN++;
              }
              if (sameCN > 0 && conquCN === sameCN) {
                G.provinceOwnership[pid] = atk;
                filled2 = true;
              }
            }
          }
        } else if (d < 0) {
          const liberatable = getLiberatableFrontier(def, atk);
          const n = Math.max(1, Math.round(liberatable.length * Math.abs(d) / 100));
          const shuffled = [...liberatable].sort(() => Math.random() - 0.5);
          for (let t = 0; t < n && t < shuffled.length; t++) {
            G.provinceOwnership[shuffled[t]] = def;
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
      // War front news cards are now shown via chronology (showChronoStep → addNewsEvent)
    }
    checkWarEnd();
  }

  // Générer/mettre à jour les bataillons pour les guerres actives
  if (!G.battalions) G.battalions = [];
  Object.entries(G.warProgress || {}).forEach(([defCode, wp]) => {
    const def = +defCode, atk = wp.attacker;
    const existing = G.battalions.filter(b =>
      (b.ownerCode === atk || b.ownerCode === def) && b.warTarget === def
    );
    if (existing.length === 0) {
      const atkCap = CAPITALS[atk], defCap = CAPITALS[def];
      if (atkCap && defCap) {
        const frontLat = defCap[1] + (atkCap[1] - defCap[1]) * (wp.progress / 100);
        const frontLng = defCap[0] + (atkCap[0] - defCap[0]) * (wp.progress / 100);
        G.battalions.push(
          { id: Date.now(), ownerCode: atk, name: `${NAMES[atk]?.slice(0,3) || 'ATK'} 1ère Armée`, lat: frontLat + 1, lng: frontLng - 1, strength: 80, type: 'infantry', warTarget: def },
          { id: Date.now()+1, ownerCode: atk, name: `${NAMES[atk]?.slice(0,3) || 'ATK'} Force Aérienne`, lat: frontLat - 0.5, lng: frontLng + 1.5, strength: 60, type: 'air', warTarget: def }
        );
        G.battalions.push(
          { id: Date.now()+2, ownerCode: def, name: `${NAMES[def]?.slice(0,3) || 'DEF'} Défense`, lat: defCap[1] + 0.5, lng: defCap[0] + 0.5, strength: 70, type: 'infantry', warTarget: def }
        );
      }
    } else {
      existing.filter(b => b.ownerCode === atk).forEach(b => {
        const atkCap = CAPITALS[atk], defCap = CAPITALS[def];
        if (atkCap && defCap) {
          const t = wp.progress / 100;
          b.lat = defCap[1] + (atkCap[1] - defCap[1]) * t + (Math.random() - 0.5) * 2;
          b.lng = defCap[0] + (atkCap[0] - defCap[0]) * t + (Math.random() - 0.5) * 2;
        }
      });
    }
  });
  // Supprimer les bataillons des guerres terminées
  G.battalions = G.battalions.filter(b => G.warProgress[b.warTarget]);
  if (typeof updateBattalionMarkers === 'function') updateBattalionMarkers();

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

  // Sync G.regions from provinceOwnership changes (war transfers)
  if (G.regions && G.regions.length && G.provinceOwnership) {
    G.regions.forEach(r => {
      const pid = r.id.replace('reg_', '');
      const newOwner = G.provinceOwnership[pid];
      if (newOwner != null) r.owner = newOwner;
    });
  }

  // ═══ MAP CHANGES ═══
  if (Array.isArray(data.map_changes)) {
    for (const mc of data.map_changes) {
      try {
        applyMapChange(mc);
      } catch(e) {
        console.warn('[MAP_CHANGE] Erreur:', mc.type, e.message);
      }
    }
    // Compléter les annexions partielles : si Gemini a transféré quelques
    // provinces d'un pays ET que l'action mentionne ce pays + annexion totale
    const lastAction = G.actionHistory?.length ? G.actionHistory[G.actionHistory.length - 1]?.action : '';
    const actionLower = (lastAction || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const alreadyCompleted = new Set();
    for (const mc of data.map_changes) {
      if (mc.type === 'transfer' && mc.new_owner) {
        const newOwnerCode = findCountryByName(mc.new_owner);
        const reg = findRegionByName(mc.region);
        if (newOwnerCode && reg) {
          const victimCode = reg.originalOwner;
          if (victimCode && victimCode !== newOwnerCode && !alreadyCompleted.has(victimCode)) {
            // Le nom du pays victime doit apparaître dans l'action
            const victimName = (getCountryName(victimCode) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const mentionsVictim = victimName && actionLower.includes(victimName);
            const mentionsAnnex = /annex|conqu[eè]|envahi|occup|absorb|integr/.test(actionLower);
            if (mentionsVictim && mentionsAnnex) {
              alreadyCompleted.add(victimCode);
              let extra = 0;
              G.regions.forEach(r => {
                if (r.owner === victimCode) { r.owner = newOwnerCode; extra++; }
              });
              if (extra > 0) {
                console.info(`[MAP] Annexion complétée: ${extra} régions restantes de ${getCountryName(victimCode)} → ${getCountryName(newOwnerCode)}`);
                delete G.relations[victimCode];
              }
            }
          }
        }
      }
    }
    if (typeof syncOwnershipFromRegions === 'function') syncOwnershipFromRegions();
  }

  // ═══ AUTO-DETECT map changes from action text ═══
  if (!data.map_changes || data.map_changes.length === 0) {
    const lastAction = G.actionHistory?.length ? G.actionHistory[G.actionHistory.length - 1]?.action : '';
    const actionLower = (lastAction || '').toLowerCase();

    const fusionMatch = actionLower.match(/fusionne?\s+avec\s+(?:l[ae']?\s*)?(\w[\w\s-]*?)(?:\s+et|\s+pour|\s+sous|$)/i);
    const renameMatch = actionLower.match(/(?:devient|forme|renomm[ée])\s+(?:l[ae']?\s*)?(.+?)$/i);

    if (fusionMatch) {
      const targetName = fusionMatch[1].trim();
      const targetCode = findCountryByName(targetName);
      if (targetCode && G.regions) {
        console.info(`[MAP-AUTO] Fusion détectée: ${G.nation} + ${targetName}`);
        G.regions.forEach(r => { if (r.owner === targetCode) r.owner = G.nationCode; });
        if (renameMatch) {
          const newName = renameMatch[1].trim();
          if (newName.length > 1 && newName.length < 50) {
            NAMES[G.nationCode] = newName;
            if (!G.countries[G.nationCode]) G.countries[G.nationCode] = {};
            G.countries[G.nationCode].name = newName;
            G.nation = newName;
            document.getElementById('hdr-nation').textContent = (FLAGS[G.nationCode]||'') + ' ' + newName;
            console.info(`[MAP-AUTO] Renommage: → ${newName}`);
          }
        }
        delete G.relations[targetCode];
        syncOwnershipFromRegions();
        updateColors();
        if (typeof updateCountryLabels === 'function') updateCountryLabels();
        addNewsEvent({ categorie: 'POLITIQUE', titre: `Fusion : ${getCountryName(G.nationCode)} absorbe ${targetName}`, texte: `Toutes les régions de ${targetName} passent sous contrôle de ${getCountryName(G.nationCode)}.` });
      }
    }

    const annexMatch = actionLower.match(/annex(?:er?|ion)\s+(?:l[ae']?\s*)?(\w[\w\s-]*)/i);
    if (annexMatch && !fusionMatch) {
      const targetName = annexMatch[1].trim();
      const targetCode = findCountryByName(targetName);
      if (targetCode && G.regions) {
        console.info(`[MAP-AUTO] Annexion détectée: ${targetName}`);
        G.regions.forEach(r => { if (r.owner === targetCode) r.owner = G.nationCode; });
        delete G.relations[targetCode];
        syncOwnershipFromRegions();
        updateColors();
        if (typeof updateCountryLabels === 'function') updateCountryLabels();
      }
    }

    if (renameMatch && !fusionMatch && !annexMatch) {
      const newName = renameMatch[1].trim();
      if (newName.length > 1 && newName.length < 50) {
        NAMES[G.nationCode] = newName;
        if (!G.countries[G.nationCode]) G.countries[G.nationCode] = {};
        G.countries[G.nationCode].name = newName;
        G.nation = newName;
        document.getElementById('hdr-nation').textContent = (FLAGS[G.nationCode]||'') + ' ' + newName;
        if (typeof updateCountryLabels === 'function') updateCountryLabels();
      }
    }
  }

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
  const validContacts = contacts
    .filter(c => c.code && NAMES[+c.code])
    .filter(c => G.relations[+c.code] !== 'unrecognized') // bloquer pays non reconnus
    .map(c => ({ ...c, code: +c.code }));
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

  // Événements mondiaux — déjà présentés dans la chronologie, on garde juste le tracking variété
  const mondiaux = Array.isArray(data.evenements_mondiaux) ? data.evenements_mondiaux : [];

  // Tracker les types d'événements pour la variété
  G.lastWorldEventTypes = mondiaux.map(ev => {
    const t = (ev.titre || '').toLowerCase();
    if (/séisme|tremblement|volcan|ouragan|inondation|incendie/.test(t)) return 'CATASTROPHE';
    if (/élection|vote|référendum|démission/.test(t)) return 'POLITIQUE';
    if (/accord|traité|sommet|forum/.test(t)) return 'DIPLOMATIE';
    if (/record|compétition|championnat|JO|coupe/.test(t)) return 'SPORT';
    if (/découverte|lancement|spatial|recherche|brevet/.test(t)) return 'SCIENCE';
    if (/scandale|arrestation|procès|corruption/.test(t)) return 'CRIME';
    return 'AUTRE';
  });

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

  // Consolidation mémoire tous les 5 tours
  if (G.turn > 1 && G.turn % 5 === 0) consolidateMemory();

  saveGame();
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

  const btnAdd = document.getElementById('btn-add-narration');
  const btnNext = document.getElementById('btn-next-turn');
  const actInput = document.getElementById('action-input');
  if (btnAdd) btnAdd.disabled = true;
  if (btnNext) btnNext.disabled = true;
  if (actInput) actInput.disabled = true;
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
    const user = `Nation: ${G.nation}. Fin de règne: ${REASON_FR[reason]||reason}. Durée: ${G.turn-1} tours (date finale: ${G.date}).\nDernières actions:\n${decrees||'Aucune action enregistrée.'}`;
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
    const archetype = LEADER_ARCHETYPES[targetCode] || { type: 'Pragmatique', trait: 'Défend les intérêts nationaux.', emoji: '🏛' };
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

function autoApplyMapChanges(action) {
  if (!action || !G.regions) return false;
  const lower = action.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let applied = false;

  // Détecter fusion : "X fusionne avec Y" ou "X et Y fusionnent"
  const fusionPatterns = [
    /fusionne[nt]?\s+avec\s+(?:l[ae']?\s*)?(.+?)(?:\s+(?:pour|et|sous)\s+(?:devenir|former|creer)\s+(?:l[ae']?\s*)?(.+))?$/i,
    /(?:l[ae']?\s*)?(.+?)\s+et\s+(?:l[ae']?\s*)?(.+?)\s+fusionnent/i,
  ];

  // Détecter annexion : "annexer X" ou "annexion de X"
  const annexPatterns = [
    /annex(?:er?|ion(?:\s+de)?)\s+(?:l[ae']?\s*)?(.+?)(?:\s|$)/i,
    /envahi[rst]?\s+(?:l[ae']?\s*)?(.+?)(?:\s|$)/i,
    /conqu[eéè]ri[rst]?\s+(?:l[ae']?\s*)?(.+?)(?:\s|$)/i,
  ];

  // Détecter renommage : "devenir X" ou "renommer en X"
  const renamePatterns = [
    /(?:devenir|former|creer|renomm[ée]r?\s+en)\s+(?:l[ae']?\s*)?(.+?)$/i,
    /(?:devient|forme)\s+(?:l[ae']?\s*)?(.+?)$/i,
  ];

  // Chercher une fusion
  for (const pat of fusionPatterns) {
    const m = lower.match(pat);
    if (m) {
      const targetName = m[1]?.trim();
      const newName = m[2]?.trim();
      if (targetName) {
        const targetCode = findCountryByName(targetName);
        if (targetCode) {
          G.regions.forEach(r => { if (r.owner === targetCode) r.owner = G.nationCode; });
          delete G.relations[targetCode];
          applied = true;
          addNewsEvent({ categorie:'POLITIQUE', titre:`Fusion avec ${getCountryName(targetCode)}`, texte:`Toutes les régions sont transférées.` });
        }
      }
      if (newName && newName.length > 1 && newName.length < 60) {
        renamePlayer(newName);
        applied = true;
      }
      break;
    }
  }

  // Chercher une annexion (si pas de fusion trouvée)
  if (!applied) {
    for (const pat of annexPatterns) {
      const m = lower.match(pat);
      if (m) {
        const targetName = m[1]?.trim();
        if (targetName) {
          const targetCode = findCountryByName(targetName);
          if (targetCode) {
            G.regions.forEach(r => { if (r.owner === targetCode) r.owner = G.nationCode; });
            delete G.relations[targetCode];
            applied = true;
            addNewsEvent({ categorie:'MILITAIRE', titre:`Annexion de ${getCountryName(targetCode)}`, texte:`Toutes les régions sont transférées.` });
          }
        }
        break;
      }
    }
  }

  // Chercher un renommage seul
  if (!applied) {
    for (const pat of renamePatterns) {
      const m = lower.match(pat);
      if (m) {
        const newName = m[1]?.trim();
        if (newName && newName.length > 1 && newName.length < 60) {
          renamePlayer(newName);
          applied = true;
        }
        break;
      }
    }
  }

  if (applied) {
    syncOwnershipFromRegions();
    updateColors();
    if (typeof updateCountryLabels === 'function') updateCountryLabels();
    saveGame();
  }
  return applied;
}

function renamePlayer(newName) {
  // Capitaliser
  newName = newName.charAt(0).toUpperCase() + newName.slice(1);
  NAMES[G.nationCode] = newName;
  if (!G.countries[G.nationCode]) G.countries[G.nationCode] = {};
  G.countries[G.nationCode].name = newName;
  G.nation = newName;
  document.getElementById('hdr-nation').textContent = (FLAGS[G.nationCode]||'') + ' ' + newName;
  addNewsEvent({ categorie:'POLITIQUE', titre:`Renommage : ${newName}`, texte:`La nation se renomme en ${newName}.` });
}

function incrementDate(date) {
  const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const parts = (date||'').split(' ');
  const monthIdx = months.indexOf(parts[0]);
  const year = parseInt(parts[1]) || 2025;
  if (monthIdx === -1) return 'Avril 2025';
  const newMonth = (monthIdx + 3) % 12; // +3 mois par défaut
  const newYear = year + Math.floor((monthIdx + 3) / 12);
  return months[newMonth] + ' ' + newYear;
}

// ══════════════════════════════════════════
