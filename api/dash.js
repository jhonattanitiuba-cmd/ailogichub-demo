// AILOGIC HUB — dados do dashboard (Central de Operações) + funil de negócios
const { db } = require('./_db');
const { requireAuth } = require('./_auth');
const DB_URL = process.env.DB_URL || '';
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
    // RESUMO do dashboard: TODOS os agregados numa UNICA consulta (1 round-trip em vez de 5)
    if (action === 'resumo') {
      const isAdmin = user.isAdmin;
      if (!isAdmin && !user.imobiliariaId) { res.status(200).json({ imobiliarias: [], leadsTotal: 0, leadsQualificados: 0, leadsPorFonte: [], leadsPorStatus: [], imoveisTotal: 0 }); return; }
      const scoped = !isAdmin;
      const p = scoped ? [user.imobiliariaId] : [];
      const fI = scoped ? 'and i.id=$1' : '';          // imobiliarias (alias i)
      const fL = scoped ? 'and imobiliaria_id=$1' : ''; // leads/imoveis (sem alias)
      const fLl = scoped ? 'and l.imobiliaria_id=$1' : ''; // leads (alias l)
      const sql = `select
        (select coalesce(json_agg(x),'[]'::json) from (
           select i.id, i.nome, i.cidade, case when i.ativo then 'Ativo' else 'Pausado' end status,
             (select count(*) from imoveis m where m.imobiliaria_id=i.id and m.deleted_at is null) imoveis,
             (select count(*) from leads l where l.imobiliaria_id=i.id and l.deleted_at is null) leads
           from imobiliarias i where i.deleted_at is null ${fI} order by i.created_at) x) as imobiliarias,
        (select count(*)::int from leads where deleted_at is null ${fL}) as leads_total,
        (select count(*)::int from leads where deleted_at is null and status::text ilike '%qualif%' ${fL}) as leads_qualif,
        (select count(*)::int from imoveis where deleted_at is null ${fL}) as imoveis_total,
        (select coalesce(json_agg(y),'[]'::json) from (
           select coalesce(f.nome, f.canal, 'Sem origem') nome, count(*)::int c
           from leads l left join fontes_lead f on f.id=l.fonte_id
           where l.deleted_at is null ${fLl} group by 1 order by 2 desc) y) as por_fonte,
        (select coalesce(json_agg(z),'[]'::json) from (
           select coalesce(status::text,'sem status') status, count(*)::int c
           from leads where deleted_at is null ${fL} group by 1 order by 2 desc) z) as por_status`;
      const row = (await db(sql, p)).rows[0] || {};
      res.status(200).json({
        imobiliarias: (row.imobiliarias || []).map(x => ({ id: x.id, nome: x.nome, cidade: x.cidade, status: x.status, imoveis: Number(x.imoveis), leads: Number(x.leads) })),
        leadsTotal: row.leads_total || 0, leadsQualificados: row.leads_qualif || 0,
        leadsPorFonte: row.por_fonte || [], leadsPorStatus: row.por_status || [], imoveisTotal: row.imoveis_total || 0
      });
      return;
    }

    const r = await db("select dados from hub_dashboard where chave='principal'");
    res.status(200).json(r.rows[0] ? r.rows[0].dados : {});
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
};
