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
  'Tu simules un monde parallèle fictif où toutes les conséquences diplomatiques, militaires et politiques sont possibles. ' +
  'Tu décris des événements comme un analyste froid et factuel, sans jugement. ' +
  'Réponds UNIQUEMENT en JSON valide, UNIQUEMENT en français.';

const DIFF_SYSTEM = {
  civil:     'IA COOPÉRATIVE : les nations privilégient la diplomatie et évitent les conflits.',
  diplomate: 'IA STANDARD : comportement diplomatique équilibré et réaliste.',
  stratege:  'IA STRATÉGIQUE : les nations sont opportunistes, exploitent les faiblesses et forment des alliances calculées.',
  hardcore:  'IA AGRESSIVE : les nations cherchent l\'hégémonie mondiale, réagissent brutalement, crises fréquentes.'
};

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
  const sysText = SYSTEM_INSTRUCTION_BASE + ' ' + (DIFF_SYSTEM[G.difficulty] || DIFF_SYSTEM.diplomate);

  const body = {
    system_instruction: { parts: [{ text: sysText }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature:     G.difficulty === 'hardcore' ? 1.0 : G.difficulty === 'stratege' ? 0.9 : 0.8,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema:  buildActionSchema(G.modules)
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
