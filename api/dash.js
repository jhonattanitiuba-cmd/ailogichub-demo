// AILOGIC HUB — dados do dashboard (Central de Operações) + funil de negócios
const { Client } = require('pg');
const { requireAuth } = require('./_auth');
const DB_URL = process.env.DB_URL || '';
async function db(q, p) {
  const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
  await c.connect(); try { return await c.query(q, p); } finally { try { await c.end(); } catch (_) {} }
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await requireAuth(req, res); if (!user) return;
    if (!DB_URL) { res.status(500).json({ error: 'env' }); return; }
    const action = (req.query && req.query.action) || 'dash';
    if (action === 'move') {
      let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};
      const id = body.id, etapa = body.etapa;
      if (!id || !etapa) { res.status(400).json({ error: 'id e etapa obrigatorios' }); return; }
      if (!user.isAdmin) {
        if (!user.imobiliariaId) { res.status(403).json({ error: 'sem permissao' }); return; }
        const chk = await db('select 1 from funil_negocios where id=$1 and imobiliaria_id=$2', [id, user.imobiliariaId]);
        if (!chk.rows[0]) { res.status(403).json({ error: 'sem permissao sobre este registro' }); return; }
      }
      await db('update funil_negocios set etapa=$1 where id=$2', [etapa, id]);
      res.status(200).json({ ok: true });
      return;
    }
    if (action === 'funil') {
      if (!user.isAdmin && !user.imobiliariaId) { res.status(200).json({ cards: [] }); return; }
      const scope = (!user.isAdmin) ? ' where imobiliaria_id=$1' : '';
      const params = (!user.isAdmin) ? [user.imobiliariaId] : [];
      const r = await db('select id, imob_nome, lead_nome, imovel_desc, imovel_codigo, corretor_nome, valor, etapa, origem, tentativas, sla, status_label, ultimo_contato, motivo_perda from funil_negocios' + scope + ' order by criado_em', params);
      res.status(200).json({ cards: r.rows.map(x => ({ ...x, valor: x.valor != null ? Number(x.valor) : null })) });
      return;
    }
    // RESUMO do dashboard: todos os agregados numa UNICA conexao (evita 4 pulls de tabela cheia no cliente)
    if (action === 'resumo') {
      const isAdmin = user.isAdmin;
      if (!isAdmin && !user.imobiliariaId) { res.status(200).json({ imobiliarias: [], leadsTotal: 0, leadsQualificados: 0, leadsPorFonte: [], leadsPorStatus: [], imoveisTotal: 0 }); return; }
      const p = isAdmin ? [] : [user.imobiliariaId];
      const fLead = isAdmin ? '' : ' and imobiliaria_id=$1';      // leads/imoveis
      const fLeadL = isAdmin ? '' : ' and l.imobiliaria_id=$1';   // leads com alias l
      const imobWhere = isAdmin ? 'deleted_at is null' : 'deleted_at is null and id=$1';
      const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
      await c.connect();
      try {
        const imobs = (await c.query(
          `select i.id, i.nome, i.cidade, case when i.ativo then 'Ativo' else 'Pausado' end as status,
             (select count(*) from imoveis m where m.imobiliaria_id=i.id and m.deleted_at is null) as imoveis,
             (select count(*) from leads l where l.imobiliaria_id=i.id and l.deleted_at is null) as leads
           from imobiliarias i where ${imobWhere} order by i.created_at`, p)).rows;
        const la = (await c.query(
          `select count(*)::int total, count(*) filter (where status::text ilike '%qualif%')::int qualificados
           from leads where deleted_at is null${fLead}`, p)).rows[0] || { total: 0, qualificados: 0 };
        const porFonte = (await c.query(
          `select coalesce(f.nome, f.canal, 'Sem origem') nome, count(*)::int c
           from leads l left join fontes_lead f on f.id=l.fonte_id
           where l.deleted_at is null${fLeadL} group by 1 order by 2 desc`, p)).rows;
        const porStatus = (await c.query(
          `select coalesce(status::text,'sem status') status, count(*)::int c
           from leads where deleted_at is null${fLead} group by 1 order by 2 desc`, p)).rows;
        const imoveisTotal = (await c.query(
          `select count(*)::int c from imoveis where deleted_at is null${fLead}`, p)).rows[0].c;
        res.status(200).json({
          imobiliarias: imobs.map(x => ({ id: x.id, nome: x.nome, cidade: x.cidade, status: x.status, imoveis: Number(x.imoveis), leads: Number(x.leads) })),
          leadsTotal: la.total, leadsQualificados: la.qualificados,
          leadsPorFonte: porFonte, leadsPorStatus: porStatus, imoveisTotal
        });
      } finally { try { await c.end(); } catch (_) {} }
      return;
    }

    const r = await db("select dados from hub_dashboard where chave='principal'");
    res.status(200).json(r.rows[0] ? r.rows[0].dados : {});
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
};
