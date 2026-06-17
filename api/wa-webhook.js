// AI LOGIC HUB — Webhook do agente de IA no WhatsApp (Serverless Vercel)
// Onboarding conversacional: lê o estado real do Supabase + histórico da conversa (multi-turno)
// e responde com Claude (fallback básico sem chave). MODO TESTE: só responde a allowlist.
// env: EVO_BASE, EVO_KEY, WA_INSTANCE, DB_URL, ANTHROPIC_API_KEY
const { Client } = require('pg');

const EVO_BASE = (process.env.EVO_BASE || '').replace(/\/$/, '');
const EVO_KEY  = process.env.EVO_KEY || '';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';
const DB_URL   = process.env.DB_URL || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const NUM_ALESSANDRO = '5511995568148';

const PERSONA_PADRAO = 'Você é o assistente virtual do AI Logic Hub, plataforma imobiliária. ' +
  'Atenda em português do Brasil, cordial e objetivo, respostas curtas (2 a 4 frases). Não use emojis decorativos.';

async function db(q, params) {
  const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
  await c.connect();
  try { return await c.query(q, params); } finally { try { await c.end(); } catch (_) {} }
}
async function evoFetch(path, body) {
  const r = await fetch(EVO_BASE + path, { method: 'POST', headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
}
async function evoSend(remoteJid, text) {
  const number = String(remoteJid).endsWith('@s.whatsapp.net') ? String(remoteJid).split('@')[0] : remoteJid;
  await evoFetch('/message/sendText/' + INSTANCE, { number, text });
}
function textoDe(msg) {
  const M = msg || {};
  return M.conversation || (M.extendedTextMessage && M.extendedTextMessage.text) || '';
}

// contexto REAL lido do banco (o agente "já conhece" a plataforma)
async function contextoBase() {
  try {
    const imob = (await db('select nome, cidade, extra from imobiliarias where deleted_at is null order by created_at')).rows;
    const nImov = (await db('select count(*) n from imoveis where deleted_at is null')).rows[0].n;
    const lista = imob.map(i => i.nome + (i.cidade ? ' (' + i.cidade + ')' : '')).join('; ') || 'nenhuma ainda';
    return 'CONTEXTO ATUAL DA PLATAFORMA (lido do banco agora):\n' +
      '- Imobiliárias cadastradas: ' + imob.length + ' — ' + lista + '\n' +
      '- Imóveis cadastrados: ' + nImov + '\n' +
      '- Canal WhatsApp do Hub: conectado e espelhado na plataforma.';
  } catch (_) { return 'CONTEXTO: plataforma AI Logic Hub ativa.'; }
}

// histórico da conversa (multi-turno) a partir do Evolution
async function historico(remoteJid, currentId, cutoff) {
  try {
    const j = await evoFetch('/chat/findMessages/' + INSTANCE, { where: { key: { remoteJid } }, limit: 16 });
    const recs = (j && j.messages && j.messages.records) || [];
    let arr = recs
      .map(m => ({ role: (m.key && m.key.fromMe) ? 'assistant' : 'user', content: textoDe(m.message), ts: m.messageTimestamp ? Number(m.messageTimestamp) : 0, id: m.key && m.key.id }))
      .filter(m => m.content && m.content.trim() && m.id !== currentId)
      .filter(m => !cutoff || m.ts * 1000 >= cutoff)
      .sort((a, b) => a.ts - b.ts)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));
    // colapsa papéis consecutivos iguais (exigência da API)
    const out = [];
    for (const m of arr) { const last = out[out.length - 1]; if (last && last.role === m.role) last.content += '\n' + m.content; else out.push({ ...m }); }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  } catch (_) { return []; }
}

function respostaBasica(t) {
  const s = (t || '').toLowerCase();
  if (/alug/.test(s)) return 'Perfeito! Para locação, me diga a região e a faixa de aluguel que procura.';
  if (/compr|venda/.test(s)) return 'Ótimo! Para compra, qual região e faixa de valor você tem em mente?';
  return 'Olá! Sou o assistente do AI Logic Hub. Posso te ajudar com imóveis para comprar ou alugar — me conta o que procura.';
}

async function respostaIA(persona, contexto, messages) {
  const ultimaUser = (messages[messages.length - 1] || {}).content || '';
  if (!ANTHROPIC_KEY) return respostaBasica(ultimaUser);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5', max_tokens: 400,
        system: (persona || PERSONA_PADRAO) + '\n\n' + contexto,
        messages
      })
    });
    const j = await r.json();
    const txt = j && j.content && j.content[0] && j.content[0].text;
    return txt || respostaBasica(ultimaUser);
  } catch (_) { return respostaBasica(ultimaUser); }
}

module.exports = async (req, res) => {
  try {
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};
    const event = body.event || body.type || '';
    const data = body.data || {};
    const key = data.key || {};
    const remoteJid = key.remoteJid || '';
    const fromMe = !!key.fromMe;
    const texto = textoDe(data.message);

    if (!/messages?\.?upsert/i.test(event)) { res.status(200).json({ ignored: 'event' }); return; }
    if (fromMe) { res.status(200).json({ ignored: 'fromMe' }); return; }
    if (String(remoteJid).endsWith('@g.us')) { res.status(200).json({ ignored: 'grupo' }); return; }
    if (!texto.trim()) { res.status(200).json({ ignored: 'sem texto' }); return; }

    const cfg = (await db('select ia_ativa, ia_allowlist, ia_persona, espelho_desde from canais_whatsapp where instancia=$1', [INSTANCE])).rows[0] || {};
    if (!cfg.ia_ativa) { res.status(200).json({ ignored: 'ia off' }); return; }
    const allow = Array.isArray(cfg.ia_allowlist) ? cfg.ia_allowlist : [];
    const senderNum = String(remoteJid).split('@')[0].replace(/\D/g, '');
    const liberado = allow.includes('*') || allow.map(x => String(x).replace(/\D/g, '')).includes(senderNum);
    if (!liberado) { res.status(200).json({ ignored: 'fora da allowlist', senderNum }); return; }

    const cutoff = cfg.espelho_desde ? new Date(cfg.espelho_desde).getTime() : null;
    let contexto = await contextoBase();
    if (senderNum === NUM_ALESSANDRO) contexto += '\n\nVocê está falando com ALESSANDRO FERREIRA, o dono/cliente do Hub. É a conversa de ONBOARDING/personalização do agente.';
    const hist = await historico(remoteJid, key.id, cutoff);
    const messages = [...hist, { role: 'user', content: texto }];
    // garante alternância terminando em user
    while (messages.length > 1 && messages[messages.length - 2].role === 'user') messages.splice(messages.length - 2, 1);

    const resposta = await respostaIA(cfg.ia_persona, contexto, messages);
    await evoSend(remoteJid, resposta);
    res.status(200).json({ ok: true, respondido: true, motor: ANTHROPIC_KEY ? 'claude' : 'basico', turns: messages.length });
  } catch (e) {
    res.status(200).json({ ok: false, erro: String((e && e.message) || e) });
  }
};
