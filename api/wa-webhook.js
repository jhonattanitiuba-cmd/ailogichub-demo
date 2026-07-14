// AILOGIC HUB — Webhook do agente de IA no WhatsApp (Serverless Vercel)
// Onboarding conversacional: lê o estado real do Supabase + histórico da conversa (multi-turno)
// e responde com Claude (fallback básico sem chave). MODO TESTE: só responde a allowlist.
// env: EVO_BASE, EVO_KEY, WA_INSTANCE, DB_URL, ANTHROPIC_API_KEY
const { Client } = require('pg');
const { PERSONA_SAM } = require('./persona');

const EVO_BASE = (process.env.EVO_BASE || '').replace(/\/$/, '');
const EVO_KEY  = process.env.EVO_KEY || '';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';
const DB_URL   = process.env.DB_URL || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const NUM_ALESSANDRO = '5511995568148';

// Persona padrao do agente (Sam), usada quando nao ha ia_persona no banco.
const PERSONA_PADRAO = PERSONA_SAM;

// Regras de estilo (prioridade maxima) para respostas curtas, humanas e ageis.
const ESTILO = `

# REGRAS DE ESTILO (PRIORIDADE MAXIMA, sobrepoem qualquer instrucao anterior)
- Responda CURTO e OBJETIVO. No maximo 2 a 3 frases por mensagem.
- NAO explique o que e o AiLogic Hub, nao faca discurso institucional, nao "venda". Va direto ao ponto.
- UMA pergunta por vez. Termine com no maximo 1 pergunta.
- Na PRIMEIRA mensagem: apresente-se em 1 linha curta (ex.: "Oi! Aqui e o Sam, do AiLogic Hub.") e ofereca opcoes rapidas e curtas numeradas, tipo "1 Comprar  2 Alugar  3 Vender  4 Outro". Deixe explicito, em 1 linha, que a pessoa pode responder com o numero, escrever normalmente ou mandar um audio, como preferir. Nao explique o que e a empresa.
- As rotas numeradas sao so um atalho, NAO engessam: aceite numero, texto livre OU audio de forma equivalente. Se a pessoa escreve direto o que quer, siga o assunto sem forcar o menu.
- Nas mensagens seguintes NAO repita a apresentacao nem o menu completo; se precisar oferecer escolhas, use no maximo 3 opcoes curtas.
- Fale como um humano agil e esperto: natural, direto, sem parecer robo ou folheto. Sem repetir o que a pessoa disse.
- Quando precisar dizer mais de uma coisa, SEPARE em mensagens curtas com uma linha em branco entre elas (o sistema envia como bolhas separadas). Prefira 1 ou 2 bolhas.`;

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
// mostra "digitando..." antes de mandar
async function evoPresence(number, delay) {
  try { await evoFetch('/chat/sendPresence/' + INSTANCE, { number, delay, presence: 'composing' }); } catch (_) {}
}
// quebra a resposta em bolhas curtas (linha em branco = nova bolha; frase longa = corta em ~220 chars)
function splitMsg(t) {
  t = String(t || '').trim(); if (!t) return [];
  const parts = t.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  const out = [];
  parts.forEach(p => {
    if (p.length <= 220) { out.push(p); return; }
    let buf = '';
    p.split(/(?<=[.!?])\s+/).forEach(s => {
      if ((buf + ' ' + s).trim().length > 220) { if (buf) out.push(buf.trim()); buf = s; }
      else buf = (buf + ' ' + s).trim();
    });
    if (buf) out.push(buf.trim());
  });
  return out.slice(0, 3); // no maximo 3 bolhas (rapido, sem estourar timeout)
}
// envia como humano: digita, pausa, manda cada bolha
async function sendChunks(remoteJid, text) {
  const number = String(remoteJid).endsWith('@s.whatsapp.net') ? String(remoteJid).split('@')[0] : remoteJid;
  const chunks = splitMsg(text);
  if (!chunks.length) return;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const delay = Math.min(450 + c.length * 16, 1400); // tempo de digitacao proporcional (cap 1.4s)
    await evoPresence(number, delay);
    await new Promise(r => setTimeout(r, delay));
    await evoFetch('/message/sendText/' + INSTANCE, { number, text: c });
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 260));
  }
}
function textoDe(msg) {
  const M = msg || {};
  return M.conversation || (M.extendedTextMessage && M.extendedTextMessage.text) || '';
}
// transcreve audio (nota de voz) via OpenAI Whisper: baixa o base64 do Evolution e transcreve
async function transcreverAudio(key) {
  if (!OPENAI_KEY) return '';
  try {
    const media = await evoFetch('/chat/getBase64FromMediaMessage/' + INSTANCE, { message: { key } });
    const b64 = media && (media.base64 || media.media || media.buffer);
    if (!b64) return '';
    const buf = Buffer.from(b64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'audio/ogg' }), 'audio.ogg');
    form.append('model', 'whisper-1');
    form.append('language', 'pt');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + OPENAI_KEY }, body: form });
    const j = await r.json();
    return (j && j.text) ? String(j.text).trim() : '';
  } catch (_) { return ''; }
}

// contexto REAL lido do banco (o agente "já conhece" a plataforma)
async function contextoBase() {
  try {
    const imob = (await db('select nome, cidade, extra from imobiliarias where deleted_at is null order by created_at')).rows;
    const nImov = (await db('select count(*) n from imoveis where deleted_at is null')).rows[0].n;
    const lista = imob.map(i => i.nome + (i.cidade ? ' (' + i.cidade + ')' : '')).join('; ') || 'nenhuma ainda';
    return 'CONTEXTO ATUAL DA PLATAFORMA (lido do banco agora):\n' +
      '- Imobiliárias cadastradas: ' + imob.length + ', ' + lista + '\n' +
      '- Imóveis cadastrados: ' + nImov + '\n' +
      '- Canal WhatsApp do Hub: conectado e espelhado na plataforma.';
  } catch (_) { return 'CONTEXTO: plataforma AILogic Hub ativa.'; }
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

// remove travessão e emojis (cara de bot) e normaliza
function limparBot(t) {
  if (!t) return t;
  return String(t)
    .replace(/\s*[—–]\s*/g, ', ')   // travessão/en-dash -> vírgula
    // emojis genéricos e pictogramas (mantém letras/acentos/pontuação normais)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function respostaBasica(t) {
  const s = (t || '').toLowerCase();
  if (/alug/.test(s)) return 'Perfeito! Para locação, me diga a região e a faixa de aluguel que procura.';
  if (/compr|venda/.test(s)) return 'Ótimo! Para compra, qual região e faixa de valor você tem em mente?';
  return 'Olá! Sou o assistente do AILogic Hub. Posso te ajudar com imóveis para comprar ou alugar. Me conta o que procura.';
}

async function respostaIA(persona, contexto, messages) {
  const ultimaUser = (messages[messages.length - 1] || {}).content || '';
  if (!OPENAI_KEY) return respostaBasica(ultimaUser);
  try {
    const sys = { role: 'system', content: (persona || PERSONA_PADRAO) + '\n\n' + contexto + ESTILO };
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OPENAI_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 240, temperature: 0.6, messages: [sys, ...messages] })
    });
    const j = await r.json();
    let txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    txt = limparBot(txt);
    return (txt && txt.trim()) || respostaBasica(ultimaUser);
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
    const isAudio = !!(data.message && data.message.audioMessage);

    if (!/messages?\.?upsert/i.test(event)) { res.status(200).json({ ignored: 'event' }); return; }
    if (fromMe) { res.status(200).json({ ignored: 'fromMe' }); return; }
    if (String(remoteJid).endsWith('@g.us')) { res.status(200).json({ ignored: 'grupo' }); return; }
    if (!texto.trim() && !isAudio) { res.status(200).json({ ignored: 'sem texto' }); return; }

    // ===== TRAVA GLOBAL DA RESPOSTA AUTOMÁTICA =====
    // false = liberado, MAS ainda restrito pela allowlist do banco (modo teste:
    // só responde os números em canais_whatsapp.ia_allowlist, hoje Jhonattan+Alessandro).
    // Para desligar tudo de novo, volte para true. Para liberar geral, use '*' na allowlist.
    const IA_RESPOSTA_DESLIGADA = false;
    if (IA_RESPOSTA_DESLIGADA) { res.status(200).json({ ignored: 'ia_global_off' }); return; }

    const cfg = (await db('select ia_ativa, ia_allowlist, ia_persona, espelho_desde from canais_whatsapp where instancia=$1', [INSTANCE])).rows[0] || {};
    if (!cfg.ia_ativa) { res.status(200).json({ ignored: 'ia off' }); return; }
    const allow = Array.isArray(cfg.ia_allowlist) ? cfg.ia_allowlist : [];
    const senderNum = String(remoteJid).split('@')[0].replace(/\D/g, '');
    const liberado = allow.includes('*') || allow.map(x => String(x).replace(/\D/g, '')).includes(senderNum);
    if (!liberado) { res.status(200).json({ ignored: 'fora da allowlist', senderNum }); return; }

    // audio (nota de voz): transcreve com Whisper e usa como texto do usuario
    let msgUser = texto;
    if (!msgUser.trim() && isAudio) { msgUser = await transcreverAudio(key); }
    if (!msgUser.trim()) { await sendChunks(remoteJid, 'Nao consegui ouvir seu audio, pode escrever ou mandar de novo?'); res.status(200).json({ ignored: 'audio vazio' }); return; }

    const cutoff = cfg.espelho_desde ? new Date(cfg.espelho_desde).getTime() : null;
    let contexto = await contextoBase();
    if (senderNum === NUM_ALESSANDRO) contexto += '\n\nVocê está falando com ALESSANDRO FERREIRA, o dono/cliente do Hub. É a conversa de ONBOARDING/personalização do agente.';
    const hist = await historico(remoteJid, key.id, cutoff);
    const messages = [...hist, { role: 'user', content: msgUser }];
    // garante alternância terminando em user
    while (messages.length > 1 && messages[messages.length - 2].role === 'user') messages.splice(messages.length - 2, 1);

    const resposta = await respostaIA(cfg.ia_persona, contexto, messages);
    await sendChunks(remoteJid, resposta);
    res.status(200).json({ ok: true, respondido: true, motor: OPENAI_KEY ? 'openai' : 'basico', turns: messages.length });
  } catch (e) {
    res.status(200).json({ ok: false, erro: String((e && e.message) || e) });
  }
};
