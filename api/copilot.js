// AILOGIC HUB - SAM Copilot interno (assistente do time da imobiliaria).
// Autenticado: responde com base nos DADOS ESCOPADOS que o front envia (o front ja os obtem
// pelos endpoints escopados por tenant). Nunca inventa numero. Cerebro Claude.
const { requireAuth } = require('./_auth');

const AK = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

function fmtDados(d) {
  if (!d || typeof d !== 'object') return '';
  const r = d.resumo || {}, f = d.funil || {}, L = [];
  if (r.leadsTotal != null) L.push('Leads: ' + r.leadsTotal + (r.leadsQualificados != null ? (' (' + r.leadsQualificados + ' qualificados)') : ''));
  if (r.imoveisTotal != null) L.push('Imoveis: ' + r.imoveisTotal);
  if (Array.isArray(r.imobiliarias)) L.push('Imobiliarias no escopo: ' + r.imobiliarias.length);
  if (f && Array.isArray(f.cards)) {
    L.push('Negocios no funil: ' + f.cards.length);
    const soma = f.cards.reduce((a, c) => a + (Number(c.valor) || 0), 0);
    if (soma) L.push('Valor em pipeline: R$ ' + Math.round(soma).toLocaleString('pt-BR'));
    const et = {}; f.cards.forEach(c => { if (c.etapa) et[c.etapa] = (et[c.etapa] || 0) + 1; });
    const ek = Object.keys(et); if (ek.length) L.push('Funil por etapa: ' + ek.map(k => k + '=' + et[k]).join(', '));
  }
  if (Array.isArray(r.leadsPorFonte) && r.leadsPorFonte.length) L.push('Leads por fonte: ' + r.leadsPorFonte.map(x => (x.nome || x.n) + '=' + x.c).join(', '));
  if (Array.isArray(r.leadsPorStatus) && r.leadsPorStatus.length) L.push('Leads por status: ' + r.leadsPorStatus.map(x => (x.status || x.n) + '=' + x.c).join(', '));
  return L.length ? ('\n\n# DADOS ATUAIS DA PLATAFORMA (escopo deste usuario):\n' + L.join('\n')) : '\n\n# DADOS: (nenhum numero carregado nesta tela)';
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const ctx = await requireAuth(req, res); if (!ctx) return; // 401 tratado dentro
  try {
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    let msgs = (body && body.messages) || [];
    if (!Array.isArray(msgs)) msgs = [];
    msgs = msgs.slice(-20).map(m => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').slice(0, 1000) })).filter(m => m.content.trim());
    const clean = [];
    for (const m of msgs) { if (clean.length && clean[clean.length - 1].role === m.role) clean[clean.length - 1].content += '\n' + m.content; else clean.push({ role: m.role, content: m.content }); }
    while (clean.length && clean[0].role !== 'user') clean.shift();
    if (!clean.length) { res.status(200).json({ reply: 'Oi! Sou o Copilot do Hub. Posso te dar um panorama de leads, funil, imoveis ou o que precisar da sua operacao.' }); return; }

    const nome = String((ctx.nome || '')).split(' ')[0] || '';
    const perfil = ctx.perfil || '';
    const system = 'Voce e o SAM Copilot, o assistente interno do AI Logic Hub para o time da imobiliaria' + (nome ? (', falando com ' + nome) : '') + (perfil ? (' (perfil: ' + perfil + ')') : '') + '. Responda com base nos DADOS DA PLATAFORMA abaixo (leads, funil, imoveis, pipeline). Seja direto, consultivo e util, como um copiloto que conhece a operacao e ajuda a decidir. NUNCA invente numeros: use apenas os dados fornecidos; se algo nao estiver ai, diga que da para abrir na tela correspondente. Traga insights acionaveis quando fizer sentido. Respostas curtas e claras. Nunca use travessao.' + fmtDados(body && body.dados);

    if (!AK) { res.status(200).json({ reply: 'Copiloto em preparacao. Assim que a IA estiver plugada, respondo com os dados da sua operacao.' }); return; }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, temperature: 0.4, system, messages: clean })
    });
    const j = await r.json();
    const reply = String((j && j.content && j.content[0] && j.content[0].text) || 'Deixa eu organizar isso, pode repetir?').replace(/\s*[—–]\s*/g, ', ').trim();
    res.status(200).json({ reply });
  } catch (e) {
    res.status(200).json({ reply: 'Tive um instante de instabilidade, pode repetir?' });
  }
};
