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
    // ---- LISTAR (autenticado): propostas escopadas por imobiliaria (admin ve todas) ----
    if (action === 'list') {
      const user = await requireAuth(req, res); if (!user) return;
      await ensurePropostas();
      const params = []; let where = '';
      if (!user.isAdmin) { if (!user.imobiliariaId) { res.status(200).json({ rows: [] }); return; } params.push(user.imobiliariaId); where = 'where imobiliaria_id=$1'; }
      const r = await db('select id, imovel_codigo, cliente, whatsapp, valor, status, lead_id, created_at from propostas ' + where + ' order by created_at desc limit 500', params);
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

    await ensurePropostas();
    const interesse = 'Proposta pelo site' + (codigo ? ' para o imovel ' + codigo : '') + (valorNum ? ' no valor de R$ ' + valorNum.toLocaleString('pt-BR') : '');
    const leadId = await garantirLead(imobId, cliente, whatsapp, interesse);
    await db(`insert into propostas(imobiliaria_id,imovel_codigo,cliente,whatsapp,valor,lead_id,extra)
      values($1,$2,$3,$4,$5,$6,jsonb_build_object('origem','site'))`,
      [imobId, codigo || null, cliente, whatsapp || null, valorNum, leadId || null]);

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[proposta]', (e && e.stack) || e);
    res.status(500).json({ error: 'Nao foi possivel registrar a proposta agora.' });
  }
};
