// AILOGIC HUB - Endpoint do Sam no site publico (curador imobiliario via Claude).
// Usa a MESMA persona do atendimento (canais_whatsapp.ia_persona) + um contexto de site.
// env: ANTHROPIC_API_KEY, ANTHROPIC_MODEL, WA_INSTANCE, DB_URL
const { db } = require('./_db');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';

const WEB_CONTEXTO = `

# CONTEXTO: SITE PUBLICO DO AI LOGIC HUB
Voce esta no site publico, conversando com um visitante que busca imovel. Conduza uma curadoria curta e consultiva: entenda a intencao (morar, investir ou alugar), a regiao, a faixa de valor e a principal necessidade, sem interrogatorio. Sugira SOMENTE imoveis do CATALOGO abaixo, sempre citando o codigo; NUNCA invente imoveis, valores nem disponibilidade. IMPORTANTE: sempre que houver imoveis do catalogo na regiao OU na faixa de valor que a pessoa pediu, APRESENTE-OS (ate 3), mesmo que nao batam 100% dos criterios, explicando em uma linha o que difere. Considere "alto padrao" pela faixa de preco e localizacao, sem exigir uma marcacao explicita. So diga que nao encontrou se realmente NAO houver nenhum imovel proximo no catalogo. Ao apresentar, seja direto e atraente: bairro, metragem, quartos/suites, vagas e valor. Depois convide a deixar nome e contato, ou falar no WhatsApp, para agendar visita. Respostas no maximo 5 frases (ou uma lista curta de 2 a 3 imoveis). Nunca use travessao.`;

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

// Catalogo real (mesma base publica da vitrine): imoveis disponiveis, para o Sam sugerir de verdade.
let _cat = null, _catTs = 0;
async function getCatalogo() {
  const now = Date.now();
  if (_cat !== null && (now - _catTs) < 300000) return _cat;
  try {
    const r = await db(
      "select codigo, tipo, finalidade, cidade, bairro, quartos, suites, vagas, area_util, preco " +
      "from imoveis where deleted_at is null and lower(status::text)='disponivel' order by created_at desc limit 30");
    const linhas = (r.rows || []).map(x => {
      const specs = [x.quartos ? x.quartos + 'q' : '', x.suites ? x.suites + ' suite(s)' : '', x.vagas ? x.vagas + ' vaga(s)' : '', x.area_util ? x.area_util + 'm2' : ''].filter(Boolean).join(', ');
      const preco = x.preco != null ? ('R$ ' + Number(x.preco).toLocaleString('pt-BR')) : 'sob consulta';
      return `- [${x.codigo || 's/cod'}] ${x.tipo || 'imovel'} para ${x.finalidade || 'venda'} em ${x.bairro || ''}, ${x.cidade || ''} (${specs}) ${preco}`;
    });
    _cat = linhas.length ? ('\n\n# CATALOGO DISPONIVEL (ofereca SOMENTE estes, cite o codigo):\n' + linhas.join('\n')) : '';
  } catch (_) { _cat = ''; }
  _catTs = now;
  return _cat;
}

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
    const catalogo = await getCatalogo();
    const system = (persona || 'Voce e o Sam, curador imobiliario digital do AI Logic Hub.') + WEB_CONTEXTO + catalogo;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 320, temperature: 0.6, system, messages: clean })
    });
    const j = await r.json();
    const reply = limpa(j && j.content && j.content[0] && j.content[0].text) || 'Me conta um pouco mais que eu organizo as melhores opcoes pra voce.';
    res.status(200).json({ reply, _cat: catalogo.length, _per: (persona || '').length });
  } catch (e) {
    res.status(200).json({ reply: 'Tive um instante de instabilidade. Pode repetir, por favor?' });
  }
};
