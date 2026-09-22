// AILOGIC HUB — dados do dashboard (Central de Operações) + funil de negócios
const { db } = require('./_db');
const { requireAuth, isLawyerRole, isSelfRole } = require('./_auth');
const { cacheGet, cacheSet, cacheDel } = require('./_cache');
const DB_URL = process.env.DB_URL || '';
// Etapas padrao do funil (Revisao 3): sem "distribuido" como rotulo; renomear/ordenar nao migra dados (etapa e texto livre).
const DEFAULT_ETAPAS = [
  { key: 'novo', nome: 'Novo lead' },
  { key: 'atendimento', nome: 'Atendimento' },
  { key: 'qualif_ia', nome: 'Qualificacao IA' },
  { key: 'distribuido', nome: 'Envio de imoveis' },
  { key: 'visita', nome: 'Visita' },
  { key: 'proposta', nome: 'Proposta' },
  { key: 'documentacao', nome: 'Documentacao' },
  { key: 'fechado', nome: 'Fechado' },
  { key: 'perdido', nome: 'Perdido' }
];
// Duas visoes de funil (definidas na reuniao). A Diretoria (admin) ve o funil completo do Hub;
// a imobiliaria ve o funil operacional dela. Chaves reaproveitadas dos cards existentes quando
// possivel (novo, atendimento, qualif_ia, distribuido, visita, proposta, documentacao, fechado, perdido)
// para nao perder cards; chaves novas nascem como colunas vazias.
// Sequencias definidas pelo cliente (exatas). "Fechamento" usa a chave 'fechado' (reflete no financeiro).
const DEFAULT_ETAPAS_HUB = [ // Diretoria
  { key: 'atendimento', nome: 'Atendimento' },
  { key: 'distribuido', nome: 'Envio de imóveis' },
  { key: 'visita', nome: 'Visita' },
  { key: 'proposta', nome: 'Proposta' },
  { key: 'documentacao', nome: 'Documentação' },
  { key: 'contrato', nome: 'Contrato' },
  { key: 'pagamentos', nome: 'Pagamentos' },
  { key: 'fechado', nome: 'Fechamento' },
  { key: 'pesquisa', nome: 'Pesquisa' },
  { key: 'perdido', nome: 'Perdido' }
];
const DEFAULT_ETAPAS_IMOB = [ // Imobiliaria e Corretor (mesma sequencia)
  { key: 'atendimento', nome: 'Atendimento' },
  { key: 'distribuido', nome: 'Envio de imóveis' },
  { key: 'visita', nome: 'Visita' },
  { key: 'proposta', nome: 'Proposta' },
  { key: 'documentacao', nome: 'Documentação' },
  { key: 'contrato', nome: 'Contrato' },
  { key: 'pagamentos', nome: 'Pagamentos' },
  { key: 'fechado', nome: 'Fechamento' },
  { key: 'perdido', nome: 'Perdido' }
];
const DEFAULT_ETAPAS_JURIDICO = [ // Juridico (ativa apos a proposta assinada)
  { key: 'proposta_assinada', nome: 'Proposta assinada' },
  { key: 'documentacao', nome: 'Documentação' },
  { key: 'contrato', nome: 'Contrato' },
  { key: 'pagamentos', nome: 'Pagamentos' },
  { key: 'fechado', nome: 'Fechamento' },
  { key: 'escritura', nome: 'Assinatura de escritura' }
];
async function ensureFunilConfig() { try { await db("create table if not exists funil_config(scope text primary key, etapas jsonb not null default '[]', updated_at timestamptz not null default now())"); } catch (_) {} }
// Fase 1 da unificacao do funil: coluna de fechamento no card + tabela de historico de etapas.
// Aditivo e idempotente (create/alter if not exists); nao toca em negocios nem no financeiro.
let _funilExtras = false;
async function ensureFunilExtras() {
  if (_funilExtras) return;
  try { await db('alter table funil_negocios add column if not exists fechado_em timestamptz'); } catch (_) {}
  try { await db('alter table funil_negocios add column if not exists negocio_id uuid'); } catch (_) {}   // vinculo card -> negocio (Fase 2)
  try { await db('alter table funil_negocios add column if not exists lead_id text'); } catch (_) {}       // B3: vinculo card -> pessoa (lead)
  try { await db('alter table funil_negocios add column if not exists corretor_perfil text'); } catch (_) {} // B5: perfil do responsavel (cor por perfil)
  try { await db("alter table funil_negocios add column if not exists documentos jsonb not null default '[]'"); } catch (_) {} // B4: documentos anexados ao card
  try { await db('create table if not exists funil_historico(id bigserial primary key, card_id text, imobiliaria_id text, etapa_de text, etapa_para text, autor_id text, autor_nome text, criado_em timestamptz not null default now())'); } catch (_) {}
  _funilExtras = true;
}
// etapa do board que representa negocio FECHADO/ganho. "perdido" nao conta como fechado.
function etapaFechada(k) { return /^(fechad|ganho)/i.test(String(k || '')); }
// rotulo do enum negocio_etapa para negocio ganho (confirmado no banco: LEAD..GANHO,PERDIDO)
const ENUM_GANHO = 'GANHO';
// C2: conjunto de lead_ids com contato liberado (visita realizada) — mesma regra da mascara em data.js.
// Para nao-admin, o telefone do card so aparece apos a visita; o admin (Hub) sempre ve.
async function leadsLiberadosSetDash() {
  try {
    const r = await db("select distinct lead_id from atividades where lead_id is not null and lower(coalesce(tipo,'')) like '%visita%' and (concluida = true or (inicio is not null and inicio < now()))");
    return new Set((r.rows || []).map(function (x) { return String(x.lead_id); }));
  } catch (_) { return new Set(); }
}
async function loadEtapas(scope, view) {
  let et = null;
  try {
    if (scope) { const r = await db('select etapas from funil_config where scope=$1', [scope]); if (r.rows[0] && Array.isArray(r.rows[0].etapas) && r.rows[0].etapas.length) et = r.rows[0].etapas; }
  } catch (_) {}
  if (et) return et.slice();
  // sem customizacao salva: escolhe a visao padrao pelo perfil (Diretoria=Hub, Juridico, imobiliaria/corretor=Imob)
  const base = view === 'hub' ? DEFAULT_ETAPAS_HUB : (view === 'juridico' ? DEFAULT_ETAPAS_JURIDICO : DEFAULT_ETAPAS_IMOB);
  return base.map((e, i) => ({ key: e.key, nome: e.nome, ordem: i, hidden: false }));
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await requireAuth(req, res); if (!user) return;
    if (!DB_URL) { res.status(500).json({ error: 'env' }); return; }
    const action = (req.query && req.query.action) || 'dash';
    // B2: gera um card no funil a partir de um imovel (e, opcionalmente, de um contato)
    if (action === 'novo') {
      let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};
      await ensureFunilExtras();
      const imovelId = body.imovel_id;
      if (!imovelId) { res.status(400).json({ error: 'imovel_id obrigatorio' }); return; }
      let iv = null;
      try { const r = await db('select i.titulo, i.codigo, i.preco, i.imobiliaria_id, m.nome imob from imoveis i left join imobiliarias m on m.id=i.imobiliaria_id where i.id=$1 and i.deleted_at is null', [imovelId]); iv = r.rows[0]; } catch (_) {}
      if (!iv) { res.status(404).json({ error: 'imovel nao encontrado' }); return; }
      if (!user.isAdmin && (!user.imobiliariaId || String(user.imobiliariaId) !== String(iv.imobiliaria_id))) { res.status(403).json({ error: 'sem permissao sobre este imovel' }); return; }
      let etapa = 'atendimento';
      try { const et = await loadEtapas(iv.imobiliaria_id || 'global', 'imob'); if (et && et[0] && et[0].key) etapa = et[0].key; } catch (_) {}
      const desc = iv.titulo || ('Imovel ' + (iv.codigo || ''));
      let leadNome = body.lead_nome ? String(body.lead_nome).slice(0, 120) : null;
      let leadId = body.lead_id ? String(body.lead_id) : null;
      // B3: vincular uma pessoa (lead) ja cadastrada, sem recadastro. Busca o nome pelo id e valida o escopo.
      if (leadId) {
        try {
          const lr = await db('select id, nome, imobiliaria_id from leads where id=$1 and deleted_at is null', [leadId]);
          const lead = lr.rows[0];
          if (!lead) { leadId = null; }
          else {
            if (!user.isAdmin && String(lead.imobiliaria_id) !== String(iv.imobiliaria_id)) { res.status(403).json({ error: 'pessoa de outra imobiliaria' }); return; }
            leadNome = lead.nome || leadNome;
          }
        } catch (_) { leadId = null; }
      }
      try {
        const r = await db(`insert into funil_negocios (imobiliaria_id, imob_nome, lead_nome, lead_id, imovel_desc, imovel_codigo, corretor_nome, corretor_perfil, valor, etapa, origem, tentativas, sla, status_label, ultimo_contato, motivo_perda)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`,
          [iv.imobiliaria_id, iv.imob || null, leadNome, leadId, desc, iv.codigo || null, user.nome || null, user.perfil || null, (iv.preco != null ? iv.preco : null), etapa, 'Hub', 1, null, 'Novo negocio', 'Agora', null]);
        res.status(200).json({ ok: true, id: r.rows[0] && r.rows[0].id, etapa: etapa });
      } catch (e) { console.error('[dash novo]', (e && e.message) || e); res.status(500).json({ error: 'nao foi possivel gerar o negocio' }); }
      return;
    }
    // B8: "solicitar parceria" no site. Usuario logado pede parceria num imovel (de qualquer imobiliaria);
    // gera um card no funil da imobiliaria DONA do imovel, com origem Parceria e o nome do solicitante.
    if (action === 'parceria') {
      await ensureFunilExtras();
      let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};
      const imovelId = body.imovel_id;
      if (!imovelId) { res.status(400).json({ error: 'imovel_id obrigatorio' }); return; }
      let iv = null;
      try { const r = await db('select i.titulo, i.codigo, i.preco, i.imobiliaria_id, m.nome imob from imoveis i left join imobiliarias m on m.id=i.imobiliaria_id where i.id=$1 and i.deleted_at is null', [imovelId]); iv = r.rows[0]; } catch (_) {}
      if (!iv) { res.status(404).json({ error: 'imovel nao encontrado' }); return; }
      let etapa = 'atendimento';
      try { const et = await loadEtapas(iv.imobiliaria_id || 'global', 'imob'); if (et && et[0] && et[0].key) etapa = et[0].key; } catch (_) {}
      const solicitante = (user.nome || user.email || 'Parceiro').toString().slice(0, 120);
      const desc = (iv.titulo || ('Imovel ' + (iv.codigo || ''))) + ' · parceria solicitada por ' + solicitante;
      try {
        const r = await db(`insert into funil_negocios (imobiliaria_id, imob_nome, lead_nome, imovel_desc, imovel_codigo, corretor_nome, corretor_perfil, valor, etapa, origem, tentativas, sla, status_label, ultimo_contato, motivo_perda)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
          [iv.imobiliaria_id, iv.imob || null, solicitante, desc, iv.codigo || null, solicitante, user.perfil || null, (iv.preco != null ? iv.preco : null), etapa, 'Parceria (site)', 1, null, 'Solicitacao de parceria', 'Agora', null]);
        try { cacheDel('dash:funil:all', 'dash:funil:' + (iv.imobiliaria_id || '')); } catch (_) {}
        res.status(200).json({ ok: true, id: r.rows[0] && r.rows[0].id });
      } catch (e) { console.error('[dash parceria]', (e && e.message) || e); res.status(500).json({ error: 'nao foi possivel registrar a parceria' }); }
      return;
    }
    if (action === 'move') {
      let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};
      const id = body.id, etapa = body.etapa;
      if (!id || !etapa) { res.status(400).json({ error: 'id e etapa obrigatorios' }); return; }
      if (!user.isAdmin) {
        if (isLawyerRole(user.perfil)) {
          const chkA = await db('select 1 from negocio_advogado where negocio_id=$1 and advogado_id=$2', [id, user.usuarioId]);
          if (!chkA.rows[0]) { res.status(403).json({ error: 'sem permissao sobre este caso' }); return; }
        } else {
          // B5: corretor autonomo (self) tem permissao de edicao dos proprios cards, seja pela imobiliaria
          // ou por ser o responsavel (corretor_nome). Assim quem atua sem imobiliaria fixa ainda move o seu funil.
          const self = isSelfRole(user.perfil);
          let ok = false;
          if (user.imobiliariaId) { const chk = await db('select 1 from funil_negocios where id=$1 and imobiliaria_id=$2', [id, user.imobiliariaId]); ok = !!chk.rows[0]; }
          if (!ok && self && user.nome) { const chk2 = await db('select 1 from funil_negocios where id=$1 and corretor_nome=$2', [id, user.nome]); ok = !!chk2.rows[0]; }
          if (!ok) { res.status(403).json({ error: 'sem permissao sobre este registro' }); return; }
        }
      }
      await ensureFunilExtras();
      // etapa anterior (para o historico), escopo do card e vinculo com o negocio
      let etapaDe = null, cardImob = null, negocioId = null;
      try { const cur = await db('select etapa, imobiliaria_id, negocio_id from funil_negocios where id=$1', [id]); if (cur.rows[0]) { etapaDe = cur.rows[0].etapa; cardImob = cur.rows[0].imobiliaria_id; negocioId = cur.rows[0].negocio_id; } } catch (_) {}
      const won = etapaFechada(etapa);
      const perdido = /^(perdid|recus)/i.test(String(etapa || ''));
      const motivo = perdido ? (body.motivo ? String(body.motivo).slice(0, 200) : null) : null;
      // marca fechado_em ao entrar em etapa fechada (mantem o 1o carimbo); limpa se sair dela.
      // grava o motivo ao entrar em Perdido/Recusado; limpa ao sair dessa etapa.
      await db('update funil_negocios set etapa=$1, fechado_em = case when $3 then coalesce(fechado_em, now()) else null end, motivo_perda = case when $4 then $5 else null end where id=$2', [etapa, id, won, perdido, motivo]);
      // registra o historico (de/para, autor, quando). Nunca quebra o move.
      try {
        await db('insert into funil_historico(card_id, imobiliaria_id, etapa_de, etapa_para, autor_id, autor_nome) values($1,$2,$3,$4,$5,$6)',
          [String(id), cardImob != null ? String(cardImob) : null, etapaDe, etapa, user.usuarioId != null ? String(user.usuarioId) : null, user.nome || null]);
      } catch (_) {}
      // Fase 2: se o card esta vinculado a um negocio e foi ganho, propaga para o financeiro.
      // INERTE ate o backfill preencher negocio_id (ver docs/MIGRACAO_FUNIL_FASE2.md). Nunca quebra o move.
      let propagado = false;
      if (won && negocioId) {
        try {
          // Comissao pela tabela do cliente: 6% em compra e venda; primeiro aluguel (1x o valor) na locacao/temporada.
          // Preserva a comissao ja gravada (coalesce), so calcula quando ainda estava vazia.
          const up = await db(
            "update negocios set etapa_funil=$1::negocio_etapa, fechado_em=coalesce(negocios.fechado_em, now()), comissao=coalesce(negocios.comissao, round(coalesce(negocios.valor,0) * (case when lower(coalesce((select i.finalidade from imoveis i where i.id=negocios.imovel_id),'venda')) like 'loca%' or lower(coalesce((select i.finalidade from imoveis i where i.id=negocios.imovel_id),'venda')) like 'tempor%' then 1.0 else 0.06 end))), updated_at=now() where negocios.id=$2 and negocios.deleted_at is null returning id",
            [ENUM_GANHO, negocioId]);
          propagado = !!up.rows[0];
        } catch (_) {}
      }
      res.status(200).json({ ok: true, fechado: won, propagado: propagado });
      return;
    }
    // historico de etapas de um card (auditoria da movimentacao)
    if (action === 'historico') {
      await ensureFunilExtras();
      const id = (req.query && req.query.id) || '';
      if (!id) { res.status(400).json({ error: 'id obrigatorio' }); return; }
      if (!user.isAdmin) {
        if (!user.imobiliariaId) { res.status(200).json({ rows: [] }); return; }
        const chk = await db('select 1 from funil_negocios where id=$1 and imobiliaria_id=$2', [id, user.imobiliariaId]);
        if (!chk.rows[0]) { res.status(403).json({ error: 'sem permissao sobre este registro' }); return; }
      }
      const r = await db('select etapa_de, etapa_para, autor_nome, criado_em from funil_historico where card_id=$1 order by criado_em desc limit 200', [String(id)]);
      res.status(200).json({ rows: r.rows });
      return;
    }
    // B4: documentos (contrato, proposta, ficha de visita) anexados ao card do funil.
    // Guardados em funil_negocios.documentos (jsonb array). O arquivo em si sobe por /api/data?action=upload.
    if (action === 'docs' || action === 'doc_add' || action === 'doc_del') {
      await ensureFunilExtras();
      let dbody = req.body; if (typeof dbody === 'string') { try { dbody = JSON.parse(dbody); } catch (_) { dbody = {}; } } dbody = dbody || {};
      const cardId = (req.query && req.query.id) || dbody.id;
      if (!cardId) { res.status(400).json({ error: 'id obrigatorio' }); return; }
      // escopo: admin ve tudo; senao o card precisa ser da imobiliaria do usuario
      if (!user.isAdmin) {
        if (!user.imobiliariaId) { res.status(403).json({ error: 'sem permissao' }); return; }
        const chk = await db('select 1 from funil_negocios where id=$1 and imobiliaria_id=$2', [cardId, user.imobiliariaId]);
        if (!chk.rows[0]) { res.status(403).json({ error: 'sem permissao sobre este registro' }); return; }
      }
      if (action === 'docs') {
        const r = await db('select coalesce(documentos, $2::jsonb) docs from funil_negocios where id=$1', [cardId, '[]']);
        res.status(200).json({ docs: (r.rows[0] && r.rows[0].docs) || [] });
        return;
      }
      const TIPOS = { contrato: 'Contrato', proposta: 'Proposta', ficha_visita: 'Ficha de visita', outro: 'Outro' };
      if (action === 'doc_add') {
        const tipo = TIPOS[dbody.tipo] ? dbody.tipo : 'outro';
        const url = String(dbody.url || '').trim();
        const nome = String(dbody.nome || '').slice(0, 160).trim() || TIPOS[tipo];
        if (!url || !/^https?:\/\//i.test(url)) { res.status(400).json({ error: 'url do documento invalida' }); return; }
        const doc = { id: Math.random().toString(36).slice(2, 10), tipo: tipo, tipo_label: TIPOS[tipo], nome: nome, url: url, autor: user.nome || null, criado_em: new Date().toISOString() };
        const r = await db("update funil_negocios set documentos = coalesce(documentos,'[]'::jsonb) || $2::jsonb where id=$1 returning coalesce(documentos,'[]'::jsonb) docs", [cardId, JSON.stringify([doc])]);
        try { cacheDel('dash:funil:all', 'dash:funil:' + (user.imobiliariaId || '')); } catch (_) {}
        res.status(200).json({ ok: true, doc: doc, docs: (r.rows[0] && r.rows[0].docs) || [] });
        return;
      }
      if (action === 'doc_del') {
        const docId = String(dbody.doc_id || '');
        if (!docId) { res.status(400).json({ error: 'doc_id obrigatorio' }); return; }
        const r = await db("select coalesce(documentos,'[]'::jsonb) docs from funil_negocios where id=$1", [cardId]);
        const arr = ((r.rows[0] && r.rows[0].docs) || []).filter(function (d) { return String(d && d.id) !== docId; });
        const u = await db('update funil_negocios set documentos=$2::jsonb where id=$1 returning documentos docs', [cardId, JSON.stringify(arr)]);
        try { cacheDel('dash:funil:all', 'dash:funil:' + (user.imobiliariaId || '')); } catch (_) {}
        res.status(200).json({ ok: true, docs: (u.rows[0] && u.rows[0].docs) || [] });
        return;
      }
    }
    if (action === 'etapas_save') {
      let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};
      if (!user.isAdmin && (isLawyerRole(user.perfil) || !user.imobiliariaId)) { res.status(403).json({ error: 'sem permissao' }); return; }
      const arr = Array.isArray(body.etapas) ? body.etapas : [];
      if (!arr.length) { res.status(400).json({ error: 'etapas vazias' }); return; }
      const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      const seen = {};
      const clean = arr.slice(0, 30).map((e, i) => {
        let key = slug(e.key) || slug(e.nome) || ('etapa_' + i);
        while (seen[key]) key = key + '_' + i;
        seen[key] = 1;
        return { key, nome: String(e.nome || e.key || '').trim().slice(0, 40) || key, ordem: i, hidden: !!e.hidden };
      });
      const scope = user.isAdmin ? 'global' : String(user.imobiliariaId);
      await ensureFunilConfig();
      await db('insert into funil_config(scope,etapas,updated_at) values($1,$2,now()) on conflict(scope) do update set etapas=$2, updated_at=now()', [scope, JSON.stringify(clean)]);
      try { cacheDel('dash:funil:all', 'dash:funil:' + (user.imobiliariaId || '')); } catch (_) {}
      res.status(200).json({ ok: true, etapas: clean });
      return;
    }
    if (action === 'funil') {
      const lawyer = isLawyerRole(user.perfil) && !user.isAdmin;
      if (!user.isAdmin && !lawyer && !user.imobiliariaId) { res.status(200).json({ cards: [] }); return; }
      if (lawyer && !user.usuarioId) { res.status(200).json({ cards: [] }); return; }
      const fkey = 'dash:funil:' + (user.isAdmin ? 'all' : (lawyer ? ('law:' + user.usuarioId) : user.imobiliariaId));
      const fcached = await cacheGet(fkey);
      if (fcached) { res.status(200).json(fcached); return; }   // hit no Redis
      // advogado: só os negócios atribuídos a ele; senão escopo por imobiliária
      await ensureFunilExtras();
      const scope = lawyer ? ' where f.id in (select negocio_id from negocio_advogado where advogado_id=$1)' : ((!user.isAdmin) ? ' where f.imobiliaria_id=$1' : '');
      const params = (!user.isAdmin) ? [lawyer ? user.usuarioId : user.imobiliariaId] : [];
      // C2: traz o telefone da pessoa vinculada (lead) para o card, para o WhatsApp direto.
      const r = await db('select f.id, f.imob_nome, f.lead_nome, f.lead_id, f.imovel_desc, f.imovel_codigo, f.corretor_nome, f.corretor_perfil, f.valor, f.etapa, f.origem, f.tentativas, f.sla, f.status_label, f.ultimo_contato, f.motivo_perda, coalesce(jsonb_array_length(f.documentos),0) docs, l.telefone lead_telefone from funil_negocios f left join leads l on l.id::text = f.lead_id' + scope + ' order by f.criado_em', params);
      // seguranca juridica: para nao-admin, so revela o telefone apos a visita (mesma porta da mascara de leads)
      let liberados = null;
      if (!user.isAdmin) { liberados = await leadsLiberadosSetDash(); }
      const fout = {
        cards: r.rows.map(function (x) {
          const c = Object.assign({}, x, { valor: x.valor != null ? Number(x.valor) : null, docs: Number(x.docs) || 0 });
          if (!user.isAdmin && (!c.lead_id || !liberados || !liberados.has(String(c.lead_id)))) c.lead_telefone = null;
          return c;
        })
      };
      // etapas configuraveis (nome/ordem) por visao + garante coluna para toda etapa presente nos cards
      const view = user.isAdmin ? 'hub' : (lawyer ? 'juridico' : 'imob');
      const escopoEt = user.isAdmin ? 'global' : (lawyer ? 'juridico' : (user.imobiliariaId || null));
      const etapas = await loadEtapas(escopoEt, view);
      const known = {}; etapas.forEach(e => { known[e.key] = 1; });
      const vis = {};
      r.rows.forEach(x => { const k = x.etapa; if (k && !known[k] && !vis[k]) { vis[k] = 1; etapas.push({ key: k, nome: k, ordem: etapas.length, hidden: false }); } });
      fout.etapas = etapas.filter(e => !e.hidden).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      cacheSet(fkey, fout, 60);
      res.status(200).json(fout);
      return;
    }
    // RESUMO do dashboard: TODOS os agregados numa UNICA consulta (1 round-trip em vez de 5)
    if (action === 'resumo') {
      const isAdmin = user.isAdmin;
      // advogado: resumo restrito aos negócios atribuídos (não vê o geral)
      if (isLawyerRole(user.perfil) && !isAdmin) {
        const empty = { imobiliarias: [], leadsTotal: 0, leadsQualificados: 0, leadsPorFonte: [], leadsPorStatus: [], imoveisTotal: 0 };
        if (!user.usuarioId) { res.status(200).json(empty); return; }
        const lkey = 'dash:resumo:law:' + user.usuarioId;
        const lc = await cacheGet(lkey); if (lc) { res.status(200).json(lc); return; }
        const sub = '(select negocio_id from negocio_advogado where advogado_id=$1)';
        var lrow = {};
        try {
          lrow = (await db(`select
            (select coalesce(json_agg(x),'[]'::json) from (
               select i.id, i.nome, i.cidade, case when i.ativo then 'Ativo' else 'Pausado' end status, 0 imoveis, 0 leads
               from imobiliarias i where i.id in (select imobiliaria_id from negocios where id in ${sub})) x) imobiliarias,
            (select count(distinct lead_id)::int from negocios where id in ${sub}) leads_total,
            (select count(distinct imovel_id)::int from negocios where id in ${sub}) imoveis_total`, [user.usuarioId])).rows[0] || {};
        } catch (_) {}
        const lout = { imobiliarias: lrow.imobiliarias || [], leadsTotal: lrow.leads_total || 0, leadsQualificados: 0, leadsPorFonte: [], leadsPorStatus: [], imoveisTotal: lrow.imoveis_total || 0 };
        cacheSet(lkey, lout, 60); res.status(200).json(lout); return;
      }
      if (!isAdmin && !user.imobiliariaId) { res.status(200).json({ imobiliarias: [], leadsTotal: 0, leadsQualificados: 0, leadsPorFonte: [], leadsPorStatus: [], imoveisTotal: 0 }); return; }
      // self: corretor/autonomo -> os agregados de LEADS contam so os proprios (responsavel_id);
      // imoveis segue o acervo da imobiliaria (compartilhado). Chave de cache inclui o usuarioId.
      const self = !isAdmin && isSelfRole(user.perfil) && !!user.usuarioId;
      const ckey = 'dash:resumo:' + (isAdmin ? 'all' : (self ? ('self:' + user.usuarioId + ':' + user.imobiliariaId) : user.imobiliariaId));
      const cached = await cacheGet(ckey);
      if (cached) { res.status(200).json(cached); return; }   // hit no Redis -> instantaneo
      const scoped = !isAdmin;
      const p = scoped ? [user.imobiliariaId] : [];
      if (self) p.push(user.usuarioId);                 // $2 = usuarioId (so quando self)
      const fI = scoped ? 'and i.id=$1' : '';           // imobiliarias (alias i)
      const fImob = scoped ? 'and imobiliaria_id=$1' : '';                                        // imoveis (so imobiliaria)
      const fLeads = scoped ? ('and imobiliaria_id=$1' + (self ? ' and responsavel_id=$2' : '')) : '';    // leads (sem alias)
      const fLeadsL = scoped ? ('and l.imobiliaria_id=$1' + (self ? ' and l.responsavel_id=$2' : '')) : ''; // leads (alias l)
      const sql = `select
        (select coalesce(json_agg(x),'[]'::json) from (
           select i.id, i.nome, i.cidade, case when i.ativo then 'Ativo' else 'Pausado' end status,
             (select count(*) from imoveis m where m.imobiliaria_id=i.id and m.deleted_at is null) imoveis,
             (select count(*) from leads l where l.imobiliaria_id=i.id and l.deleted_at is null) leads
           from imobiliarias i where i.deleted_at is null ${fI} order by i.created_at) x) as imobiliarias,
        (select count(*)::int from leads where deleted_at is null ${fLeads}) as leads_total,
        (select count(*)::int from leads where deleted_at is null and status::text ilike '%qualif%' ${fLeads}) as leads_qualif,
        (select count(*)::int from imoveis where deleted_at is null ${fImob}) as imoveis_total,
        (select coalesce(json_agg(y),'[]'::json) from (
           select coalesce(f.nome, f.canal, 'Sem origem') nome, count(*)::int c
           from leads l left join fontes_lead f on f.id=l.fonte_id
           where l.deleted_at is null ${fLeadsL} group by 1 order by 2 desc) y) as por_fonte,
        (select coalesce(json_agg(z),'[]'::json) from (
           select coalesce(status::text,'sem status') status, count(*)::int c
           from leads where deleted_at is null ${fLeads} group by 1 order by 2 desc) z) as por_status`;
      const row = (await db(sql, p)).rows[0] || {};
      const out = {
        imobiliarias: (row.imobiliarias || []).map(x => ({ id: x.id, nome: x.nome, cidade: x.cidade, status: x.status, imoveis: Number(x.imoveis), leads: Number(x.leads) })),
        leadsTotal: row.leads_total || 0, leadsQualificados: row.leads_qualif || 0,
        leadsPorFonte: row.por_fonte || [], leadsPorStatus: row.por_status || [], imoveisTotal: row.imoveis_total || 0
      };
      cacheSet(ckey, out, 60);
      res.status(200).json(out);
      return;
    }

    const r = await db("select dados from hub_dashboard where chave='principal'");
    res.status(200).json(r.rows[0] ? r.rows[0].dados : {});
  } catch (e) { console.error('[dash]', (e && e.stack) || e); res.status(500).json({ error: 'Erro interno. Tente novamente.' }); }
};
