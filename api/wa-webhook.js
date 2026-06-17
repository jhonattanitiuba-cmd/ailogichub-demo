// AI LOGIC HUB — Webhook do agente de IA no WhatsApp (Serverless Vercel)
// Recebe eventos do Evolution (mensagem nova) -> gera resposta (Claude se houver chave,
// senão resposta básica de regras) -> envia pelo Evolution. MODO TESTE: só responde allowlist.
// env: EVO_BASE, EVO_KEY, WA_INSTANCE, DB_URL, ANTHROPIC_API_KEY (opcional)
const { Client } = require('pg');

const EVO_BASE = (process.env.EVO_BASE || '').replace(/\/$/, '');
const EVO_KEY  = process.env.EVO_KEY || '';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';
const DB_URL   = process.env.DB_URL || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

const PERSONA_PADRAO = 'Você é o assistente virtual do AI Logic Hub, uma plataforma imobiliária. ' +
  'Atenda em português do Brasil, cordial e objetivo. Ajude o cliente a encontrar imóveis (comprar ou alugar): ' +
  'pergunte a região, a faixa de valor e o tipo de imóvel. Respostas curtas (2 a 4 frases), tom profissional e humano. ' +
  'Não invente imóveis específicos nem preços; diga que vai verificar as opções disponíveis. Não use emojis decorativos.';

async function db(q, params) {
  const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
  await c.connect();
  try { return await c.query(q, params); } finally { try { await c.end(); } catch (_) {} }
}
async function evoSend(remoteJid, text) {
  const number = String(remoteJid).endsWith('@s.whatsapp.net') ? String(remoteJid).split('@')[0] : remoteJid;
  await fetch(EVO_BASE + '/message/sendText/' + INSTANCE, {
    method: 'POST', headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, text })
  });
}
function textoDe(msg) {
  const M = msg || {};
  return M.conversation || (M.extendedTextMessage && M.extendedTextMessage.text) || '';
}
function respostaBasica(t) {
  const s = (t || '').toLowerCase();
  if (/alug/.test(s)) return 'Perfeito! Para locação, me diga a região e a faixa de aluguel que procura, que já separo opções.';
  if (/compr|venda|comprar/.test(s)) return 'Ótimo! Para compra, qual região e faixa de valor você tem em mente? Trabalhamos com imóveis de alto padrão na Av. Paulista e Jardins.';
  if (/(^|\b)(oi|ol[aá]|bom dia|boa tarde|boa noite|menu|ajuda)\b/.test(s)) return 'Olá! Sou o assistente virtual do AI Logic Hub. Posso te ajudar a encontrar um imóvel. Você procura *comprar* ou *alugar*?';
  return 'Recebi sua mensagem! Posso ajudar com imóveis para comprar ou alugar. Me conta a região e a faixa de valor que já te envio opções.';
}
async function respostaIA(persona, texto) {
  if (!ANTHROPIC_KEY) return respostaBasica(texto);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5', max_tokens: 320,
        system: persona || PERSONA_PADRAO,
        messages: [{ role: 'user', content: texto }]
      })
    });
    const j = await r.json();
    const txt = j && j.content && j.content[0] && j.content[0].text;
    return txt || respostaBasica(texto);
  } catch (_) { return respostaBasica(texto); }
}

module.exports = async (req, res) => {
  // responde rápido pro Evolution não re-tentar; processa em try/catch
  try {
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};
    const event = body.event || body.type || '';
    const data = body.data || {};
    const key = data.key || {};
    const remoteJid = key.remoteJid || '';
    const fromMe = !!key.fromMe;
    const texto = textoDe(data.message);

    // guardas básicas
    if (!/messages?\.?upsert/i.test(event)) { res.status(200).json({ ignored: 'event' }); return; }
    if (fromMe) { res.status(200).json({ ignored: 'fromMe' }); return; }
    if (String(remoteJid).endsWith('@g.us')) { res.status(200).json({ ignored: 'grupo' }); return; }
    if (!texto.trim()) { res.status(200).json({ ignored: 'sem texto' }); return; }

    // config do agente
    const cfg = (await db('select ia_ativa, ia_allowlist, ia_persona from canais_whatsapp where instancia=$1', [INSTANCE])).rows[0] || {};
    if (!cfg.ia_ativa) { res.status(200).json({ ignored: 'ia off' }); return; }
    const allow = Array.isArray(cfg.ia_allowlist) ? cfg.ia_allowlist : [];
    const senderNum = String(remoteJid).split('@')[0].replace(/\D/g, '');
    const liberado = allow.includes('*') || allow.map(x => String(x).replace(/\D/g, '')).includes(senderNum);
    if (!liberado) { res.status(200).json({ ignored: 'fora da allowlist', senderNum }); return; }

    const resposta = await respostaIA(cfg.ia_persona, texto);
    await evoSend(remoteJid, resposta);
    res.status(200).json({ ok: true, respondido: true, motor: ANTHROPIC_KEY ? 'claude' : 'basico' });
  } catch (e) {
    res.status(200).json({ ok: false, erro: String((e && e.message) || e) });
  }
};
