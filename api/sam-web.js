// AILOGIC HUB - Endpoint do Sam no site publico (curador imobiliario via Claude).
// Usa a MESMA persona do atendimento (canais_whatsapp.ia_persona) + um contexto de site.
// env: ANTHROPIC_API_KEY, ANTHROPIC_MODEL, WA_INSTANCE, DB_URL
const { db } = require('./_db');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';

const WEB_CONTEXTO = `

# CONTEXTO: SITE PUBLICO DO AI LOGIC HUB
Voce esta no site publico, conversando com um visitante que busca imovel. Conduza uma curadoria curta e consultiva: entenda a intencao (morar, investir ou alugar), a regiao, a faixa de valor e a principal necessidade, sem interrogatorio. Nao invente imoveis, valores nem disponibilidade. Quando tiver os criterios, diga que vai reunir as melhores opcoes do catalogo e convide o visitante a deixar nome e contato, ou falar no WhatsApp, para receber a curadoria. Respostas curtas, 1 a 3 frases. Nunca use travessao.`;

let _persona = null, _personaTs = 0;
async function getPersona() {
  const now = Date.now();
  if (_persona !== null && (now - _personaTs) < 300000) return _persona;
  try {
    const r = await db('select ia_persona from canais_whatsapp where instancia=$1', [INSTANCE]);
    _persona = (r.rows[0] && r.rows[0].ia_persona) || '';
  } catch (_) { _persona = ''; }
  _personaTs = now;
  return _persona;
}

function limpa(t) { return String(t || '').replace(/\s*[—–]\s*/g, ', ').trim(); }

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    let msgs = (body && body.messages) || [];
    if (!Array.isArray(msgs)) msgs = [];
    // guardas: ate 24 turnos, cada um ate 1200 chars
    msgs = msgs.slice(-24)
      .map(m => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').slice(0, 1200) }))
      .filter(m => m.content.trim());
    // alterna user/assistant e comeca em user
    const clean = [];
    for (const m of msgs) {
      if (clean.length && clean[clean.length - 1].role === m.role) clean[clean.length - 1].content += '\n' + m.content;
      else clean.push({ role: m.role, content: m.content });
    }
    while (clean.length && clean[0].role !== 'user') clean.shift();
    if (!clean.length) { res.status(200).json({ reply: 'Oi! Sou o Sam, do AI Logic Hub. Me conta o que voce procura: para morar, investir ou alugar?' }); return; }
    if (!ANTHROPIC_KEY) { res.status(200).json({ reply: 'Estou reunindo as informacoes. Me deixe seu nome e contato que a curadoria segue pelo time.' }); return; }

    const persona = await getPersona();
    const system = (persona || 'Voce e o Sam, curador imobiliario digital do AI Logic Hub.') + WEB_CONTEXTO;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 320, temperature: 0.6, system, messages: clean })
    });
    const j = await r.json();
    const reply = limpa(j && j.content && j.content[0] && j.content[0].text) || 'Me conta um pouco mais que eu organizo as melhores opcoes pra voce.';
    res.status(200).json({ reply });
  } catch (e) {
    res.status(200).json({ reply: 'Tive um instante de instabilidade. Pode repetir, por favor?' });
  }
};
