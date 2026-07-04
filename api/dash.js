// AI LOGIC HUB — dados do dashboard (Central de Operações) + funil de negócios
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
      await db('update funil_negocios set etapa=$1 where id=$2', [etapa, id]);
      res.status(200).json({ ok: true });
      return;
    }
    if (action === 'funil') {
      const r = await db('select id, imob_nome, lead_nome, imovel_desc, imovel_codigo, corretor_nome, valor, etapa, origem, tentativas, sla, status_label, ultimo_contato, motivo_perda from funil_negocios order by criado_em');
      res.status(200).json({ cards: r.rows.map(x => ({ ...x, valor: x.valor != null ? Number(x.valor) : null })) });
      return;
    }
    const r = await db("select dados from hub_dashboard where chave='principal'");
    res.status(200).json(r.rows[0] ? r.rows[0].dados : {});
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
};
