// AILOGIC HUB - Proposta PUBLICA do site (sem autenticacao).
// Recebe a proposta feita na pagina do imovel (/imovel -> "Fazer proposta") e:
//  1) registra a proposta numa tabela propostas (criada sob demanda);
//  2) gera/vincula um lead no CRM, na imobiliaria "Hub" central (mesmo criterio do WhatsApp),
//     para o funil nao nascer vazio tambem pelo canal do site.
// Nada aqui concede acesso nem gera contrato assinado: e captacao de proposta + lead.
const { db } = require('./_db');
const { rateAllow } = require('./_cache');
const { requireAuth } = require('./_auth');
const DB_URL = process.env.DB_URL || '';
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

// resolve a imobiliaria central que recebe leads/propostas do site (igual ao webhook do WhatsApp):
// env HUB_IMOBILIARIA_ID -> imobiliaria com extra.hub=true -> a mais antiga.
let _hubId = null, _hubTs = 0;
async function imobiliariaHub() {
  const now = Date.now();
  if (_hubId !== null && (now - _hubTs) < 300000) return _hubId;
  let id = null;
  try {
    if (process.env.HUB_IMOBILIARIA_ID) id = process.env.HUB_IMOBILIARIA_ID;
    if (!id) { const r = await db("select id from imobiliarias where deleted_at is null and coalesce((extra->>'hub')::boolean,false)=true order by created_at limit 1"); id = (r.rows[0] || {}).id; }
    if (!id) { const r = await db('select id from imobiliarias where deleted_at is null order by created_at limit 1'); id = (r.rows[0] || {}).id; }
  } catch (_) {}
  _hubId = id || null; _hubTs = now;
  return _hubId;
}

let _ensured = false;
async function ensurePropostas() {
  if (_ensured) return;
  await db("create table if not exists propostas(id bigserial primary key, imobiliaria_id uuid, imovel_codigo text, cliente text, whatsapp text, valor numeric, status text not null default 'nova', lead_id uuid, extra jsonb not null default '{}'::jsonb, created_at timestamptz not null default now())");
  _ensured = true;
}

// AREA DO CLIENTE: acesso por link magico (token unico, com validade). Guarda so o HASH do token.
const crypto = require('crypto');
function shaHex(s) { try { return crypto.createHash('sha256').update(String(s)).digest('hex'); } catch (_) { return null; } }
let _acessoOk = false;
async function ensureAcesso() {
  if (_acessoOk) return;
  await db("create table if not exists cliente_acesso(token_hash text primary key, lead_id uuid, whatsapp text, imobiliaria_id uuid, criado_em timestamptz not null default now(), expira_em timestamptz)");
  _acessoOk = true;
}

// cria/vincula lead por telefone dentro da imobiliaria Hub (idempotente), origem proposta-site
async function garantirLead(imobId, nome, telefone, interesse) {
  try {
    const tel = String(telefone || '').replace(/\D/g, '') || null;
    let leadId = null;
    if (tel) {
      const ex = await db("select id from leads where imobiliaria_id=$1 and deleted_at is null and regexp_replace(coalesce(telefone,''),'\\D','','g')=$2 limit 1", [imobId, tel]);
      leadId = (ex.rows[0] || {}).id;
    }
    if (!leadId) {
      const ins = await db(`insert into leads(imobiliaria_id,nome,telefone,status,interesse,extra)
        values($1,$2,$3,'novo',$4,jsonb_build_object('origem','proposta-site')) returning id`,
        [imobId, nome || (tel ? ('Cliente ' + tel) : 'Cliente site'), tel, interesse || null]);
      leadId = (ins.rows[0] || {}).id;
    } else {
      // ja existe: atualiza ultimo contato e o interesse se estiver vazio
      await db("update leads set ultimo_contato=now(), interesse=coalesce(nullif(interesse,''),$2) where id=$1", [leadId, interesse || null]);
    }
    return leadId;
  } catch (_) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!DB_URL) { res.status(500).json({ error: 'backend nao configurado' }); return; }
  const action = (req.query && req.query.action) || '';
  try {
    // ---- AREA DO CLIENTE (publico): valida o token e devolve SO os dados daquele cliente ----
    if (action === 'area') {
      await ensurePropostas(); await ensureAcesso();
      const tok = (req.query && (req.query.t || req.query.token)) || '';
      const th = tok ? shaHex(tok) : null;
      if (!th) { res.status(400).json({ error: 'link invalido' }); return; }
      const xff0 = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
      const ip0 = xff0 || (req.socket && req.socket.remoteAddress) || '';
      if (ip0) { const rl = await rateAllow('rl:area:' + ip0, 40, 600); if (!rl.allowed) { res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }); return; } }
      const ac = await db('select lead_id, whatsapp, imobiliaria_id, expira_em from cliente_acesso where token_hash=$1', [th]);
      const row = ac.rows[0];
      if (!row) { res.status(404).json({ error: 'link nao encontrado' }); return; }
      if (row.expira_em && new Date(row.expira_em).getTime() < Date.now()) { res.status(410).json({ error: 'link expirado' }); return; }
      const tel = String(row.whatsapp || '').replace(/\D/g, '');
      const props = await db(
        "select imovel_codigo, valor, status, created_at, extra from propostas where imobiliaria_id=$1 and (lead_id=$2 or regexp_replace(coalesce(whatsapp,''),'\\D','','g')=$3) order by created_at desc limit 100",
        [row.imobiliaria_id, row.lead_id, tel]);
      let nome = 'Cliente';
      try { const nr = await db('select nome from leads where id=$1', [row.lead_id]); if (nr.rows[0] && nr.rows[0].nome) nome = nr.rows[0].nome; } catch (_) {}
      const FRIEND = { nova: 'Recebida', em_andamento: 'Em análise', fechada: 'Aceita', descartada: 'Não seguiu' };
      const propostas = (props.rows || []).map(function (p) {
        return {
          imovel_codigo: p.imovel_codigo || null, valor: p.valor != null ? Number(p.valor) : null,
          status: FRIEND[p.status] || 'Recebida', created_at: p.created_at,
          prazo: (p.extra && p.extra.prazo) || null, garantia: (p.extra && p.extra.garantia) || null
        };
      });
      res.status(200).json({ cliente: nome, propostas: propostas });
      return;
    }
    // ---- LISTAR (autenticado): propostas escopadas por imobiliaria (admin ve todas) ----
    if (action === 'list') {
      const user = await requireAuth(req, res); if (!user) return;
      await ensurePropostas();
      const params = []; let where = '';
      if (!user.isAdmin) { if (!user.imobiliariaId) { res.status(200).json({ rows: [] }); return; } params.push(user.imobiliariaId); where = 'where imobiliaria_id=$1'; }
      const r = await db('select id, imovel_codigo, cliente, whatsapp, valor, status, lead_id, created_at, extra from propostas ' + where + ' order by created_at desc limit 500', params);
      res.status(200).json({ rows: r.rows }); return;
    }
    // ---- ATUALIZAR STATUS (autenticado) ----
    if (action === 'status') {
      if (req.method !== 'POST') { res.status(405).json({ error: 'metodo nao permitido' }); return; }
      const user = await requireAuth(req, res); if (!user) return;
      let sb = req.body; if (typeof sb === 'string') { try { sb = JSON.parse(sb); } catch (_) { sb = {}; } } sb = sb || {};
      const id = parseInt(sb.id, 10);
      const ALLOWED = ['nova', 'em_andamento', 'fechada', 'descartada'];
      const status = String(sb.status || '').trim();
      if (!id || ALLOWED.indexOf(status) < 0) { res.status(400).json({ error: 'dados invalidos' }); return; }
      await ensurePropostas();
      const params = [status, id]; let scope = '';
      if (!user.isAdmin) { if (!user.imobiliariaId) { res.status(403).json({ error: 'sem permissao' }); return; } params.push(user.imobiliariaId); scope = ' and imobiliaria_id=$3'; }
      const r = await db('update propostas set status=$1 where id=$2' + scope + ' returning id', params);
      if (!r.rows[0]) { res.status(404).json({ error: 'proposta nao encontrada' }); return; }
      res.status(200).json({ ok: true }); return;
    }
    // ---- GERAR LINK DE ACESSO DO CLIENTE (autenticado): o time cria o link magico ----
    if (action === 'area_link') {
      if (req.method !== 'POST') { res.status(405).json({ error: 'metodo nao permitido' }); return; }
      const user = await requireAuth(req, res); if (!user) return;
      await ensurePropostas(); await ensureAcesso();
      let lb = req.body; if (typeof lb === 'string') { try { lb = JSON.parse(lb); } catch (_) { lb = {}; } } lb = lb || {};
      const propostaId = parseInt(lb.propostaId, 10) || null;
      let leadId = lb.leadId || null, tel = String(lb.whatsapp || '').replace(/\D/g, '') || null, imobId = null;
      if (propostaId) {
        const pr = user.isAdmin
          ? await db('select lead_id, whatsapp, imobiliaria_id from propostas where id=$1', [propostaId])
          : await db('select lead_id, whatsapp, imobiliaria_id from propostas where id=$1 and imobiliaria_id=$2', [propostaId, user.imobiliariaId]);
        const p = pr.rows[0]; if (!p) { res.status(404).json({ error: 'proposta nao encontrada' }); return; }
        leadId = p.lead_id || leadId; tel = String(p.whatsapp || '').replace(/\D/g, '') || tel; imobId = p.imobiliaria_id;
      } else {
        imobId = user.isAdmin ? (lb.imobiliariaId || null) : user.imobiliariaId;
      }
      if (!imobId) { res.status(400).json({ error: 'sem imobiliaria' }); return; }
      if (!user.isAdmin && String(imobId) !== String(user.imobiliariaId)) { res.status(403).json({ error: 'sem permissao' }); return; }
      if (!leadId && tel) { try { const lr = await db("select id from leads where imobiliaria_id=$1 and regexp_replace(coalesce(telefone,''),'\\D','','g')=$2 and deleted_at is null limit 1", [imobId, tel]); if (lr.rows[0]) leadId = lr.rows[0].id; } catch (_) {} }
      if (!leadId && !tel) { res.status(400).json({ error: 'informe o cliente (proposta, lead ou whatsapp)' }); return; }
      const token = crypto.randomBytes(24).toString('hex');
      await db("insert into cliente_acesso(token_hash, lead_id, whatsapp, imobiliaria_id, expira_em) values($1,$2,$3,$4, now() + interval '30 days')", [shaHex(token), leadId, tel, imobId]);
      const url = 'https://ailogichub.app/area?t=' + token;
      const msg = 'Olá! Acompanhe suas propostas e o andamento do seu imóvel por aqui: ' + url;
      res.status(200).json({ ok: true, url: url, whatsapp: tel ? ('https://wa.me/55' + tel + '?text=' + encodeURIComponent(msg)) : null });
      return;
    }
    // ---- SUBMETER PROPOSTA (publico, sem autenticacao) ----
    if (req.method && req.method !== 'POST') { res.status(405).json({ error: 'metodo nao permitido' }); return; }
    // anti-spam por IP (fail-open: sem Redis, nao bloqueia). Max 8 propostas por 10 min.
    const xff = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
    const ip = xff || (req.socket && req.socket.remoteAddress) || '';
    if (ip) {
      const rl = await rateAllow('rl:proposta:' + ip, 8, 600);
      if (!rl.allowed) { res.status(429).json({ error: 'Muitas propostas em sequencia. Aguarde alguns minutos.' }); return; }
    }

    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
    b = b || {};
    const codigo = clip(b.codigo || b.cod, 40);
    const cliente = clip(b.cliente || b.nome, 120);
    const whatsapp = clip(b.whatsapp || b.telefone, 40);
    const valorNum = (function () { const n = Number(String(b.valor == null ? '' : b.valor).replace(/[^\d]/g, '')); return isFinite(n) && n > 0 ? n : null; })();

    if (!cliente) { res.status(400).json({ error: 'Informe seu nome.' }); return; }
    if (whatsapp.replace(/\D/g, '').length < 10) { res.status(400).json({ error: 'Informe um WhatsApp valido com DDD.' }); return; }

    const imobId = await imobiliariaHub();
    if (!imobId) { res.status(200).json({ ok: true, semImobiliaria: true }); return; } // nao trava o cliente

    // parametros de locacao online (opcionais): prazo do contrato e tipo de garantia
    const prazo = clip(b.prazo, 20) || null;
    const garantia = clip(b.garantia, 40) || null;
    const finalidade = clip(b.finalidade, 20) || null;
    // guardrail do valor minimo (piso do proprietario). NUNCA revela o piso ao cliente:
    // classifica a oferta como dentro/abaixo da margem para o time e a IA negociarem.
    let margem = 'sem_referencia', vmin = null;
    try {
      if (codigo) {
        const im = await db("select extra->>'valor_minimo' as vmin from imoveis where lower(codigo)=lower($1) and deleted_at is null limit 1", [codigo]);
        const raw = im.rows[0] && im.rows[0].vmin; vmin = (raw != null && raw !== '') ? Number(raw) : null;
      }
    } catch (_) {}
    if (valorNum && vmin != null && isFinite(vmin) && vmin > 0) margem = (valorNum >= vmin) ? 'dentro' : 'abaixo';

    await ensurePropostas();
    const interesse = 'Proposta pelo site' + (codigo ? ' para o imovel ' + codigo : '') + (valorNum ? ' no valor de R$ ' + valorNum.toLocaleString('pt-BR') : '') + (prazo ? ' | prazo ' + prazo : '') + (garantia ? ' | garantia ' + garantia : '');
    const leadId = await garantirLead(imobId, cliente, whatsapp, interesse);
    await db(`insert into propostas(imobiliaria_id,imovel_codigo,cliente,whatsapp,valor,lead_id,extra)
      values($1,$2,$3,$4,$5,$6,jsonb_build_object('origem','site','prazo',$7::text,'garantia',$8::text,'finalidade',$9::text,'margem',$10::text))`,
      [imobId, codigo || null, cliente, whatsapp || null, valorNum, leadId || null, prazo, garantia, finalidade, margem]);

    // devolve so a classificacao (nunca o piso). Cliente ve mensagem generica.
    res.status(200).json({ ok: true, margem: margem });
  } catch (e) {
    console.error('[proposta]', (e && e.stack) || e);
    res.status(500).json({ error: 'Nao foi possivel registrar a proposta agora.' });
  }
};
