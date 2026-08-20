// AILOGIC HUB - Endpoint do Sam no site publico (curador imobiliario via Claude).
// Usa a MESMA persona do atendimento (canais_whatsapp.ia_persona) + um contexto de site.
// env: ANTHROPIC_API_KEY, ANTHROPIC_MODEL, WA_INSTANCE, DB_URL
const { db } = require('./_db');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';

const WEB_CONTEXTO = `

# CONTEXTO: SITE PUBLICO DO AI LOGIC HUB
# POSICIONAMENTO (fale sempre com este espirito)
Voce e o Sam, o curador do AI Logic Hub. O Hub NAO e uma imobiliaria: e a infraestrutura que conecta cliente, imobiliaria e corretor e cuida de toda a jornada (curadoria, visita, proposta, juridico, assinatura e chaves). O parceiro que atende a visita e sempre valorizado. Voce e um consultor senior, elegante e humano: acolhe, conduz e nao interroga. Traduza a ideia de que a pessoa nao precisa procurar, precisa ser melhor compreendida. Faca perguntas de compreensao (ex.: quer 2 dormitorios mas tem 3 filhos? posso te mostrar algo que cabe melhor). Sempre conduza para o proximo passo concreto: agendar visita ou gerar a proposta. Apresente SEMPRE ate 3 imoveis (nunca 4 ou 5), e se nao fechar, ofereca mais 3. Nunca use a palavra estoque (fale portfolio, selecao, carteira ou curadoria); nunca use piramide (fale rede).
# QUEM ESTA FALANDO
Se perceber que e um profissional (corretor, imobiliaria, incorporador, construtora, credito ou juridico) e nao um cliente final, mude o foco: explique em poucas linhas como o Hub conecta e faz a passagem do bastao, que a carteira continua do parceiro, que juridico e contratos sao do Hub e o unico custo e a ativacao do numero de WhatsApp, e convide a falar com o time pelo WhatsApp. Nesse caso nao ofereca imoveis.
Voce esta no site publico, conversando com um visitante que busca imovel. Conduza uma curadoria curta e consultiva: entenda a intencao (morar, investir ou alugar), a regiao, a faixa de valor e a principal necessidade, sem interrogatorio. Sugira SOMENTE imoveis do CATALOGO abaixo, sempre citando o codigo; NUNCA invente imoveis, valores nem disponibilidade. IMPORTANTE: sempre que houver imoveis do catalogo na regiao OU na faixa de valor que a pessoa pediu, APRESENTE-OS (ate 3), mesmo que nao batam 100% dos criterios, explicando em uma linha o que difere. Considere "alto padrao" pela faixa de preco e localizacao, sem exigir uma marcacao explicita. So diga que nao encontrou se realmente NAO houver nenhum imovel proximo no catalogo. Ao apresentar, seja direto e atraente: bairro, metragem, quartos/suites, vagas e valor. Depois convide a deixar nome e contato, ou falar no WhatsApp, para agendar visita. Respostas no maximo 5 frases (ou uma lista curta de 2 a 3 imoveis). REGRAS DE CONDUCAO: faca no maximo UMA pergunta por vez; NUNCA repita uma pergunta que a pessoa ja respondeu nem recomece a saudacao; a cada resposta do visitante, AVANCE (se ja sabe intencao e faixa/regiao, va direto aos imoveis do catalogo). Escreva em texto simples e limpo, SEM asteriscos, sem markdown e sem emojis. Nunca use travessao. No FINAL de cada resposta, adicione em uma nova linha o marcador [[SUG]] seguido de EXATAMENTE 3 sugestoes curtas (2 a 4 palavras cada), do ponto de vista do visitante, para o proximo passo, coerentes com o que ele esta conversando (previstas pelo contexto), separadas por " | ". Exemplo: [[SUG]] Ver mais opcoes | Agendar visita | Falar no WhatsApp. Nunca explique o marcador nem o cite fora do final.`;

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

function limpa(t) { return String(t || '').replace(/\s*[—–]\s*/g, ', ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*/g, '').replace(/[ \t]{2,}/g, ' ').trim(); }

// Catalogo real (mesma base publica da vitrine): imoveis disponiveis, para o Sam sugerir de verdade.
let _cat = null, _catTs = 0;
async function getCatalogo() {
  const now = Date.now();
  if (_cat !== null && (now - _catTs) < 300000) return _cat;
  try {
    const r = await db(
      "select codigo, tipo, finalidade, cidade, bairro, quartos, suites, vagas, area_util, preco " +
      "from imoveis where deleted_at is null and lower(status::text)='disponivel' " +
      "and ((lower(finalidade::text)='venda' and preco>=700000) or (lower(finalidade::text) in ('locacao','temporada') and preco>=4000)) " +
      "order by preco desc limit 30");
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
    // Resumo do atendimento para a passagem (handoff): perfil, checklist e resumo para o corretor da visita.
    if (req.query && req.query.action === 'resumo') {
      if (!ANTHROPIC_KEY || !msgs.length) { res.status(200).json({ nome: '', perfil: '', checklist: [], resumo: '' }); return; }
      const conversa = msgs.map(m => (m.role === 'assistant' ? 'Sam' : 'Cliente') + ': ' + m.content).join('\n').slice(0, 6000);
      const sys = 'Voce resume um atendimento de curadoria imobiliaria para o corretor que vai receber a visita. Leia a conversa e responda SOMENTE um JSON valido, sem texto fora dele, com as chaves: nome (primeiro nome do cliente se citado, senao vazio), perfil (uma linha curta, ex.: Executivo exigente, ou Familia com filhos), checklist (array de ate 6 criterios concretos que o cliente valoriza, ex.: churrasqueira, sol da manha, 3 vagas, home office), score (numero de 0 a 10 com uma casa decimal: a MEDIA da qualidade e completude das respostas nas etapas de qualificacao, considerando intencao, regiao, faixa de valor e criterios especificos; 10 = tudo claro e detalhado, 0 = quase nada informado), resumo (2 a 3 frases). Sem travessao, sem markdown, sem emojis.';
      try {
        const rr = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 500, temperature: 0.3, system: sys, messages: [{ role: 'user', content: conversa || 'Sem conversa.' }] })
        });
        const jj = await rr.json();
        const t = (jj && jj.content && jj.content[0] && jj.content[0].text) || '{}';
        let obj = {}; try { obj = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch (_) {}
        let sc = (obj.score != null && obj.score !== '') ? Number(obj.score) : null;
        if (sc != null && (isNaN(sc) || sc < 0)) sc = null; else if (sc != null) sc = Math.min(10, Math.round(sc * 10) / 10);
        res.status(200).json({ nome: limpa(obj.nome || ''), perfil: limpa(obj.perfil || ''), checklist: (Array.isArray(obj.checklist) ? obj.checklist : []).map(x => limpa(String(x))).filter(Boolean).slice(0, 6), score: sc, resumo: limpa(obj.resumo || '') });
      } catch (_) { res.status(200).json({ nome: '', perfil: '', checklist: [], resumo: '' }); }
      return;
    }
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
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 420, temperature: 0.6, system, messages: clean })
    });
    const j = await r.json();
    let reply = limpa(j && j.content && j.content[0] && j.content[0].text) || 'Me conta um pouco mais que eu organizo as melhores opcoes pra voce.';
    // extrai 3 sugestoes contextuais do marcador [[SUG]] e as remove do texto exibido (sem travessao/asterisco)
    let sugestoes = [];
    const idx = reply.indexOf('[[SUG]]');
    if (idx >= 0) {
      sugestoes = reply.slice(idx + 7).split('|')
        .map(s => s.replace(/[—–*]/g, '').replace(/^[-•\d.\)\s]+/, '').trim())
        .filter(Boolean).slice(0, 3);
      reply = reply.slice(0, idx).trim();
    }
    res.status(200).json({ reply, sugestoes });
  } catch (e) {
    res.status(200).json({ reply: 'Tive um instante de instabilidade. Pode repetir, por favor?' });
  }
};
