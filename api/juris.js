// AILOGIC HUB — Módulo Jurídico (advogado/associado)
// Vínculo advogado<->negócio (negocio_advogado), assinatura -> resumo IA da proposta,
// dar andamento, e leitura do resumo do caso. Escopo por negócio (não vê o geral).
const { db } = require('./_db');
const { requireAuth, isLawyerRole } = require('./_auth');
const { cacheDel } = require('./_cache');
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

// DDL idempotente (padrão do projeto: "... if not exists")
let _ddlOk = false;
async function ensureDDL() {
  if (_ddlOk) return;
  try {
    await db(`create table if not exists negocio_advogado(negocio_id uuid not null, advogado_id uuid not null, honorario_pct numeric, resumo_ia text, resumo_em timestamptz, criado_em timestamptz default now(), primary key(negocio_id, advogado_id))`);
    await db(`alter table negocio_advogado add column if not exists honorario_pct numeric`);
    await db(`alter table negocio_advogado add column if not exists resumo_ia text`);
    await db(`alter table negocio_advogado add column if not exists resumo_em timestamptz`);
    _ddlOk = true;
  } catch (_) {}
}

async function honorarioPctDe(advId) {
  try { const r = await db(`select extra->>'honorario_pct' hp from usuarios where id=$1`, [advId]); const v = parseFloat((r.rows[0] || {}).hp); return isFinite(v) ? v : 20; }
  catch (_) { return 20; }
}
async function contextoNegocio(negocioId) {
  try {
    const r = await db(`select n.id, n.valor, n.comissao, n.rlor, n.etapa_funil, n.fechado_em,
        l.nome lead_nome, l.interesse,
        im.titulo imovel, im.codigo, im.tipo, im.finalidade, im.preco, im.bairro, im.cidade,
        ib.nome imob_nome
      from negocios n
        left join leads l on l.id=n.lead_id
        left join imoveis im on im.id=n.imovel_id
        left join imobiliarias ib on ib.id=n.imobiliaria_id
      where n.id=$1`, [negocioId]);
    return r.rows[0] || {};
  } catch (_) { return {}; }
}
async function gerarResumoIA(ctx) {
  const dados = 'Cliente: ' + (ctx.lead_nome || '—') + '\nInteresse: ' + (ctx.interesse || '—') +
    '\nImóvel: ' + (ctx.imovel || '—') + ' (' + (ctx.tipo || '') + '/' + (ctx.finalidade || '') + ') cód ' + (ctx.codigo || '—') + ', ' + (ctx.bairro || '') + ' ' + (ctx.cidade || '') + ', preço R$ ' + (ctx.preco || '—') +
    '\nImobiliária: ' + (ctx.imob_nome || '—') +
    '\nValor do negócio: R$ ' + (ctx.valor || '—') + ' · Comissão: R$ ' + (ctx.comissao || '—') +
    '\nEtapa atual: ' + (ctx.etapa_funil || '—');
  if (!OPENAI_KEY) {
    return 'RESUMO DA PROPOSTA (gerado automaticamente)\n\n' + dados + '\n\nPontos de atenção jurídicos: conferir documentação do cliente e do imóvel, validar cláusulas e garantias da proposta.\nPróximos passos: dar andamento à minuta do contrato.';
  }
  try {
    const sys = 'Você é um assistente jurídico imobiliário. Gere um RESUMO objetivo e profissional da proposta assinada, para o advogado dar andamento. Não use travessão. Estruture em seções curtas: Partes, Objeto, Valores, Pontos de atenção jurídicos, Próximos passos. Seja conciso e prático.';
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + OPENAI_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 420, temperature: 0.4, messages: [{ role: 'system', content: sys }, { role: 'user', content: 'Proposta assinada. Dados do negócio:\n' + dados }] })
    });
    const j = await r.json();
    const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return (String(txt || '').replace(/\s*[—–]\s*/g, ', ').trim()) || dados;
  } catch (_) { return dados; }
}
function invalidaAdv(advId) { cacheDel('data:negocios:law:' + advId, 'data:contratos:law:' + advId, 'data:agenda:law:' + advId, 'dash:funil:law:' + advId, 'dash:resumo:law:' + advId); }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await requireAuth(req, res); if (!user) return;
    await ensureDDL();
    const action = (req.query && req.query.action) || '';
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } } b = b || {};
    const admin = user.isAdmin;

    // ---- ATRIBUIR advogado a um negócio (diretoria) ----
    if (action === 'atribuir') {
      if (!admin) { res.status(403).json({ error: 'apenas diretoria' }); return; }
      const negocioId = b.negocioId, advId = b.advogadoId;
      if (!negocioId || !advId) { res.status(400).json({ error: 'negocioId e advogadoId' }); return; }
      const pct = await honorarioPctDe(advId);
      await db(`insert into negocio_advogado(negocio_id,advogado_id,honorario_pct) values($1,$2,$3) on conflict(negocio_id,advogado_id) do update set honorario_pct=excluded.honorario_pct`, [negocioId, advId, pct]);
      invalidaAdv(advId);
      res.status(200).json({ ok: true, honorario_pct: pct }); return;
    }

    // ---- REMOVER advogado de um negócio (diretoria) ----
    if (action === 'desatribuir') {
      if (!admin) { res.status(403).json({ error: 'apenas diretoria' }); return; }
      const negocioId = b.negocioId, advId = b.advogadoId;
      if (!negocioId || !advId) { res.status(400).json({ error: 'negocioId e advogadoId' }); return; }
      await db('delete from negocio_advogado where negocio_id=$1 and advogado_id=$2', [negocioId, advId]);
      invalidaAdv(advId);
      res.status(200).json({ ok: true }); return;
    }

    // ---- MARCAR PROPOSTA ASSINADA (diretoria) -> auto-atribui + resumo IA ----
    if (action === 'assinar') {
      if (!admin) { res.status(403).json({ error: 'apenas diretoria' }); return; }
      const contratoId = b.contratoId, advId = b.advogadoId || null;
      if (!contratoId) { res.status(400).json({ error: 'contratoId' }); return; }
      const cr = await db('select id, negocio_id from contratos where id=$1', [contratoId]);
      const contrato = cr.rows[0]; if (!contrato) { res.status(404).json({ error: 'contrato' }); return; }
      await db(`update contratos set status_assinatura='assinado', assinado_em=now() where id=$1`, [contratoId]);
      const negocioId = contrato.negocio_id;
      if (advId && negocioId) { const pct = await honorarioPctDe(advId); await db(`insert into negocio_advogado(negocio_id,advogado_id,honorario_pct) values($1,$2,$3) on conflict(negocio_id,advogado_id) do update set honorario_pct=excluded.honorario_pct`, [negocioId, advId, pct]); }
      let resumo = '';
      if (negocioId) {
        resumo = await gerarResumoIA(await contextoNegocio(negocioId));
        await db('update negocio_advogado set resumo_ia=$1, resumo_em=now() where negocio_id=$2', [resumo, negocioId]);
        try { const adv = await db('select advogado_id from negocio_advogado where negocio_id=$1', [negocioId]); (adv.rows || []).forEach(a => invalidaAdv(a.advogado_id)); } catch (_) {}
      }
      res.status(200).json({ ok: true, negocio_id: negocioId, resumo_gerado: !!resumo, motor: OPENAI_KEY ? 'openai' : 'template' }); return;
    }

    // ---- DAR ANDAMENTO (advogado, só nos casos dele) ----
    if (action === 'andamento') {
      const negocioId = b.negocioId, etapa = b.etapa;
      if (!negocioId || !etapa) { res.status(400).json({ error: 'negocioId e etapa' }); return; }
      if (!admin) {
        if (!isLawyerRole(user.perfil)) { res.status(403).json({ error: 'sem permissao' }); return; }
        const chk = await db('select 1 from negocio_advogado where negocio_id=$1 and advogado_id=$2', [negocioId, user.usuarioId]);
        if (!chk.rows[0]) { res.status(403).json({ error: 'este caso não é seu' }); return; }
      }
      try { await db('update funil_negocios set etapa=$1 where id=$2', [etapa, negocioId]); } catch (_) {}
      try { await db('update negocios set etapa_funil=$1, updated_at=now() where id=$2', [etapa, negocioId]); } catch (_) {}   // enum-safe
      if (user.usuarioId) invalidaAdv(user.usuarioId);
      res.status(200).json({ ok: true }); return;
    }

    // ---- RESUMO / casos do advogado ----
    if (action === 'resumo') {
      const negocioId = req.query && req.query.negocioId;
      if (!negocioId) {
        const r = await db(`select na.negocio_id, na.resumo_ia, na.resumo_em, na.honorario_pct, n.valor, n.comissao, n.etapa_funil, l.nome lead_nome, im.titulo imovel, c.assinado_em
          from negocio_advogado na
            left join negocios n on n.id=na.negocio_id
            left join leads l on l.id=n.lead_id
            left join imoveis im on im.id=n.imovel_id
            left join contratos c on c.negocio_id=na.negocio_id
          where na.advogado_id=$1 order by na.criado_em desc`, [user.usuarioId]);
        res.status(200).json({ casos: (r.rows || []).map(x => ({
          negocio_id: x.negocio_id, resumo: x.resumo_ia || '', resumo_em: x.resumo_em,
          lead_nome: x.lead_nome, imovel: x.imovel, etapa: x.etapa_funil, assinado_em: x.assinado_em,
          valor: x.valor != null ? Number(x.valor) : null, comissao: x.comissao != null ? Number(x.comissao) : null,
          honorario_pct: x.honorario_pct != null ? Number(x.honorario_pct) : null,
          ganho: (x.comissao != null && x.honorario_pct != null) ? Number(x.comissao) * Number(x.honorario_pct) / 100 : null
        })) }); return;
      }
      const r = await db('select resumo_ia, resumo_em from negocio_advogado where negocio_id=$1 and advogado_id=$2', [negocioId, user.usuarioId]);
      res.status(200).json({ resumo: (r.rows[0] || {}).resumo_ia || '', resumo_em: (r.rows[0] || {}).resumo_em || null }); return;
    }

    // ---- lista de advogados (dropdown de atribuição, diretoria) ----
    if (action === 'advogados') {
      if (!admin) { res.status(403).json({ error: 'apenas diretoria' }); return; }
      const r = await db(`select id, nome, email from usuarios where deleted_at is null and ativo is not false and lower(perfil) in ('advogado','associado','juridico','jurídico') order by nome`);
      res.status(200).json({ advogados: r.rows || [] }); return;
    }

    res.status(400).json({ error: 'action invalida' });
  } catch (e) { res.status(500).json({ error: 'erro', detalhe: String((e && e.message) || e) }); }
};
