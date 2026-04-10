// ══════════════════════════════════════════
// api.js — Couche Gemini API
// Gestion des appels, des erreurs et du debug
// ══════════════════════════════════════════

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

const SYSTEM_INSTRUCTION_BASE =
  'Tu es le moteur de simulation géopolitique d\'ORBIS. ' +
  'Tu simules un monde parallèle fictif où TOUT est possible. ' +
  'Le joueur a le contrôle narratif total : ses actions RÉUSSISSENT TOUJOURS. ' +
  'Si le joueur dit "j\'annexe l\'Espagne", l\'Espagne est annexée. Point. ' +
  'Si le joueur dit "je construis une base sur Mars", la base est construite. ' +
  'Tu ne refuses JAMAIS une action du joueur. Tu décris les CONSÉQUENCES ' +
  'réalistes de ces actions (réactions des autres pays, opinion publique, ' +
  'coûts économiques, tensions diplomatiques) mais l\'action elle-même réussit. ' +
  'Les autres nations réagissent de manière réaliste et dans leur intérêt. ' +
  'Réponds UNIQUEMENT en JSON valide, UNIQUEMENT en français.';

const DIFF_SYSTEM = {
  tres_facile: 'CONSÉQUENCES MINIMALES. Le monde accepte tout sans broncher.',
  facile: 'CONSÉQUENCES LÉGÈRES. Quelques réactions diplomatiques mineures.',
  normal: 'CONSÉQUENCES RÉALISTES. Les nations réagissent dans leur intérêt. Coalitions possibles contre un joueur trop agressif.',
  difficile: 'CONSÉQUENCES SÉVÈRES. Réactions disproportionnées, coalitions systématiques, crises internes fréquentes, coûts économiques lourds.',
  impossible: 'CONSÉQUENCES BRUTALES. Le monde entier se retourne contre le joueur. Chaque action provoque une cascade de réactions hostiles.',
  civil:    'CONSÉQUENCES LÉGÈRES.',
  diplomate:'CONSÉQUENCES RÉALISTES.',
  stratege: 'CONSÉQUENCES SÉVÈRES.',
  hardcore: 'CONSÉQUENCES BRUTALES.'
};

const FEW_SHOT_EXAMPLES = `

EXEMPLE DE BONNE SIMULATION (action réussie + conséquences lourdes) :
Action joueur: "Annexer l'Espagne"
Réponse attendue: faisabilite.reussite="totale", raison="L'armée française occupe l'Espagne." + map_changes avec transfers de toutes les régions espagnoles + événements: coalition européenne anti-France, sanctions économiques, opinion en chute, USA dégradent relations, manifestations en Espagne occupée.

EXEMPLE DE BONNE SIMULATION (conséquences imprévues) :
Action joueur: "Signer un accord commercial massif avec la Chine"
Réponse attendue: faisabilite.reussite="totale" + événement "Tension transatlantique" où les États-Unis dégradent leurs relations en réaction + opinion publique en baisse (dépendance économique critiquée) + contact entrant des USA "Washington exprime sa préoccupation".

MAUVAISE SIMULATION (à éviter absolument) :
Tout le monde félicite le joueur, aucune conséquence négative, aucune réaction hostile. L'action réussit mais le monde DOIT réagir de manière réaliste.`;

// ── Error types ──
class GeminiError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.type    = type;    // 'HTTP' | 'SAFETY' | 'RECITATION' | 'EMPTY' | 'JSON' | 'OTHER'
    this.details = details; // { status, safetyRatings, rawText, finishReason, ... }
  }
}

// ── Main action call ──
async function geminiActionCall(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${G.model}:generateContent?key=${G.apiKey}`;
  const customSim = G.customPrompts?.simulation;
  const customDiff = G.customPrompts?.difficulty;
  const baseSys = customSim || SYSTEM_INSTRUCTION_BASE;
  const diffSys = customDiff || (DIFF_SYSTEM[G.difficulty] || DIFF_SYSTEM.diplomate);
  const sysText = baseSys + ' ' + diffSys + (
    ['normal','difficile','impossible','diplomate','stratege','hardcore'].includes(G.difficulty) ? FEW_SHOT_EXAMPLES : ''
  );

  const body = {
    system_instruction: { parts: [{ text: sysText }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature:     Math.min(0.85, ({tres_facile:0.65,facile:0.7,normal:0.75,difficile:0.8,impossible:0.85,civil:0.7,diplomate:0.75,stratege:0.8,hardcore:0.85})[G.difficulty] ?? 0.75),
      maxOutputTokens: 8192
    }
  };

  let res, json;
  try {
    res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    json = await res.json();
  } catch(e) {
    throw new GeminiError('HTTP', 'Erreur réseau : ' + e.message, { networkError: e.message });
  }

  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new GeminiError('HTTP', msg, { status: res.status, apiError: json?.error });
  }

  const candidate    = json.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const safetyRatings = candidate?.safetyRatings || [];

  if (!candidate) {
    throw new GeminiError('EMPTY', 'Aucune réponse du modèle (quota ou erreur API).', { json });
  }

  if (finishReason === 'SAFETY') {
    const blocked = safetyRatings
      .filter(r => r.blocked || r.probability === 'HIGH' || r.probability === 'MEDIUM')
      .map(r => r.category.replace('HARM_CATEGORY_', ''))
      .join(', ') || 'catégorie inconnue';
    throw new GeminiError('SAFETY', `Bloqué par le filtre de sécurité (${blocked}).`, { safetyRatings, finishReason });
  }

  if (finishReason === 'RECITATION') {
    throw new GeminiError('RECITATION', 'Réponse bloquée (récitation de contenu protégé). Relancez.', { finishReason });
  }

  if (finishReason === 'OTHER') {
    throw new GeminiError('OTHER', `Le modèle a arrêté pour une raison inconnue (finishReason: OTHER).`, { finishReason, safetyRatings });
  }

  const text = candidate.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiError('EMPTY', `Réponse vide du modèle (finishReason: ${finishReason || 'inconnu'}).`, { finishReason, candidate });
  }

  return text;
}

// ── Brainstorm : génère 5 idées d'actions ──
async function geminiBrainstorm() {
  const rels = Object.entries(G.relations)
    .filter(([,r]) => r !== 'neutral').slice(0, 6)
    .map(([c,r]) => `${NAMES[c]||c}:${r}`).join(', ') || 'stables';
  const ctx = G.lastResume ? `Contexte récent: ${G.lastResume.slice(0,200)}. ` : '';
  const sys = `Tu es le conseiller stratégique de ${G.nation} (${G.date}, tour ${G.turn}). Relations: ${rels}. ${ctx}Génère exactement 5 idées d'actions distinctes (diplomatiques, militaires, économiques, politiques). Réponds UNIQUEMENT avec un tableau JSON valide: [{"titre":"...","action":"description de l'action en 1 phrase précise"}]`;
  const raw = await geminiCallFull(sys, [{role:'user',parts:[{text:'Génère les 5 idées maintenant.'}]}], 700);
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('Format de réponse invalide');
  return JSON.parse(m[0]);
}

// ── Enhance/Polish action ──
async function geminiEnhanceAction(action, mode) {
  const sys = mode === 'polish'
    ? `Tu es le moteur de simulation géopolitique ORBIS. Réécris cette action pour qu'elle soit plus précise, concrète et efficacement simulable (ajoute des détails opérationnels : acteurs, zones, délais). Garde le sens original. Réponds UNIQUEMENT avec l'action réécrite, sans guillemets ni commentaire.`
    : `Tu es un rédacteur politique expert. Améliore la formulation de cette action pour qu'elle soit plus claire et professionnelle. Garde strictement le sens original. Réponds UNIQUEMENT avec l'action réécrite, sans guillemets ni commentaire.`;
  const raw = await geminiCallFull(sys, [{role:'user',parts:[{text:action}]}], 400);
  return raw.trim().replace(/^["'`]|["'`]$/g, '');
}

// ── Advisor suggested prompts ──
async function geminiAdvisorSuggestions() {
  const rels = Object.entries(G.relations)
    .filter(([,r]) => r !== 'neutral').slice(0, 5)
    .map(([c,r]) => `${NAMES[c]||c}:${r}`).join(', ') || 'stables';
  const sys = `Tu es le conseiller de ${G.nation} (${G.date}, tour ${G.turn}). Relations: ${rels}. ${G.lastResume ? 'Situation: ' + G.lastResume.slice(0,150) : ''} Génère 4 questions courtes et pertinentes que le joueur pourrait poser à son conseiller. Réponds UNIQUEMENT avec un tableau JSON: ["question 1","question 2","question 3","question 4"]`;
  const raw = await geminiCallFull(sys, [{role:'user',parts:[{text:'Génère les suggestions maintenant.'}]}], 400);
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  return JSON.parse(m[0]);
}

// ── Diplomatic chat call ──
async function geminiCallFull(system, contents, maxTokens = 900) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${G.model}:generateContent?key=${G.apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: { temperature: 0.8, maxOutputTokens: maxTokens }
  };
  const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new GeminiError('HTTP', err?.error?.message || `HTTP ${res.status}`, { status: res.status });
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── JSON parsing with debug on failure ──
function parseActionJson(raw) {
  const strategies = [
    () => JSON.parse(raw.trim()),
    () => JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()),
    () => { const m = raw.match(/\{[\s\S]*\}/); if(!m) throw new Error('no match'); return JSON.parse(m[0]); },
    () => { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); if(!m) throw new Error('no fence'); return JSON.parse(m[1]); },
    () => {
      let s = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
      const start=s.indexOf('{'), end=s.lastIndexOf('}');
      if(start===-1||end===-1) throw new Error('no braces');
      s = s.slice(start,end+1).replace(/,\s*([}\]])/g,'$1');
      return JSON.parse(s);
    },
    () => {
      // JSON tronqué — fermer les tableaux/objets ouverts
      let s = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
      const start = s.indexOf('{');
      if (start === -1) throw new Error('no brace');
      s = s.slice(start);
      // Compter les accolades/crochets ouverts
      let opens = 0, opensBracket = 0;
      for (const c of s) {
        if (c === '{') opens++;
        if (c === '}') opens--;
        if (c === '[') opensBracket++;
        if (c === ']') opensBracket--;
      }
      // Fermer ce qui manque
      // D'abord couper au dernier objet complet dans un tableau
      s = s.replace(/,\s*\{[^}]*$/, '');  // supprimer le dernier objet incomplet
      s = s.replace(/,\s*"[^"]*$/, '');    // supprimer la dernière clé incomplète
      // Refermer les crochets/accolades
      while (opensBracket > 0) { s += ']'; opensBracket--; }
      while (opens > 0) { s += '}'; opens--; }
      s = s.replace(/,\s*([}\]])/g, '$1'); // trailing commas
      return JSON.parse(s);
    }
  ];

  for (const fn of strategies) {
    try { return fn(); } catch {}
  }

  // All strategies failed — throw with raw snippet for debug
  throw new GeminiError('JSON', 'Impossible de parser le JSON Gemini.', {
    rawSnippet: raw.slice(0, 400)
  });
}

// ── Debug error card in news feed ──
function displayDebugError(err) {
  const type    = err instanceof GeminiError ? err.type : 'UNKNOWN';
  const message = err.message || String(err);
  const details = err instanceof GeminiError ? err.details : {};

  let detailHtml = '';
  if (type === 'SAFETY' && details.safetyRatings) {
    const ratings = details.safetyRatings
      .map(r => `<span style="color:#f87171">${r.category.replace('HARM_CATEGORY_','')}: ${r.probability}</span>`)
      .join('<br>');
    detailHtml = `<div class="debug-block">${ratings}</div>`;
  }
  if (type === 'JSON' && details.rawSnippet) {
    detailHtml = `<div class="debug-block">${escHtml(details.rawSnippet)}…</div>`;
  }
  if (type === 'HTTP' && details.status) {
    detailHtml = `<div class="debug-block">HTTP ${details.status}${details.apiError?.message ? ' — ' + escHtml(details.apiError.message) : ''}</div>`;
  }

  const el = document.createElement('div');
  el.className = 'ne debug-card';
  el.innerHTML = `
    <div class="ne-top">
      <span class="ne-cat debug-cat">⚠ ERREUR [${type}]</span>
      <span class="ne-time">${escHtml(G?.date||'—')} · Tour ${G?.turn||'—'}</span>
    </div>
    <div class="ne-title" style="color:#f87171">${escHtml(message)}</div>
    ${detailHtml}
    <div style="margin-top:0.4rem;font-size:0.65rem;color:var(--text3)">
      Corrigez votre décret et cliquez sur <strong style="color:var(--text2)">Exécuter →</strong> pour relancer.
    </div>
  `;
  const feed = document.getElementById('news-feed');
  if (feed) { feed.appendChild(el); feed.scrollTop = feed.scrollHeight; }
}
