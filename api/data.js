// AI LOGIC HUB — CRUD de imobiliárias e imóveis no Supabase (Serverless Vercel)
// Colunas escalares populadas + coluna `extra jsonb` com os campos do formulário.
// Segredo DB_URL em env var da Vercel.
const { Client } = require('pg');
const DB_URL = process.env.DB_URL || '';

async function db(q, params) {
  const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
  await c.connect();
  try { return await c.query(q, params); }
  finally { try { await c.end(); } catch (_) {} }
}

function slugify(s) {
  return String(s || 'imob').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'imob';
}
const rid = () => Math.random().toString(36).slice(2, 6);
const numOrNull = v => (v != null && v !== '') ? Number(v) : null;
const intOrNull = v => (v != null && v !== '') ? parseInt(v) : null;

const MAP_TIPO = { 'Apartamento':'apartamento','Casa':'casa','Sala comercial':'sala_comercial','Loft':'loft','Cobertura':'cobertura','Terreno':'terreno','Galpão':'galpao','Outro':'outro' };
const MAP_FIN  = { 'Venda':'venda','Locação':'locacao','Temporada':'temporada' };
const MAP_ST   = { 'Disponível':'disponivel','Reservado':'reservado','Vendido':'vendido','Locado':'locado','Inativo':'inativo' };

function imobOut(r) {
  const e = r.extra || {};
  return Object.assign({
    id: r.id, nome: r.nome, creci: r.creci, telefone: r.telefone, email: r.email,
    site: r.site, instagram: r.instagram, endereco: r.endereco, cidade: r.cidade,
    lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
    raio: r.raio_atuacao_m, status: (r.ativo ? 'Implantando' : 'Pausado')
  }, e);
}
function imovOut(r) {
  const e = r.extra || {};
  return Object.assign({
    id: r.id, imobiliaria_id: r.imobiliaria_id, titulo: r.titulo, codigo: r.codigo,
    preco: r.preco != null ? Number(r.preco) : null, area: r.area_util != null ? Number(r.area_util) : null,
    quartos: r.quartos, suites: r.suites, banheiros: r.banheiros, vagas: r.vagas,
    endereco: r.endereco, bairro: r.bairro, cidade: r.cidade, descricao: r.descricao
  }, e);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!DB_URL) { res.status(500).json({ error: 'backend nao configurado (DB_URL)' }); return; }
    const ent = req.query && req.query.ent;
    const action = (req.query && req.query.action) || 'list';
    if (ent !== 'imobiliarias' && ent !== 'imoveis') { res.status(400).json({ error: 'ent invalido' }); return; }
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};

    // ---- LIST ----
    if (action === 'list') {
      const r = await db(`select * from ${ent} where deleted_at is null order by created_at`);
      res.status(200).json({ rows: r.rows.map(ent === 'imobiliarias' ? imobOut : imovOut) });
      return;
    }

    // ---- DELETE (hard; imobiliaria cascateia pros imoveis) ----
    if (action === 'delete') {
      const id = body.id || (req.query && req.query.id);
      if (!id) { res.status(400).json({ error: 'id obrigatorio' }); return; }
      await db(`delete from ${ent} where id=$1`, [id]);
      res.status(200).json({ ok: true });
      return;
    }

    // ---- SAVE (insert/update) ----
    if (action === 'save') {
      const o = body;
      const extra = { ...o }; delete extra.id;

      if (ent === 'imobiliarias') {
        if (!o.nome) { res.status(400).json({ error: 'nome obrigatorio' }); return; }
        const ativo = o.status !== 'Pausado';
        const raio = o.raio ? parseInt(o.raio) : 4500;
        const lat = numOrNull(o.lat), lng = numOrNull(o.lng);
        if (o.id) {
          const r = await db(`update imobiliarias set nome=$1,creci=$2,telefone=$3,email=$4,site=$5,instagram=$6,endereco=$7,cidade=$8,lat=$9,lng=$10,raio_atuacao_m=$11,ativo=$12,extra=$13,updated_at=now() where id=$14 returning *`,
            [o.nome, o.creci||null, o.telefone||null, o.email||null, o.site||null, o.instagram||null, o.endereco||null, o.cidade||null, lat, lng, raio, ativo, JSON.stringify(extra), o.id]);
          res.status(200).json({ row: imobOut(r.rows[0]) }); return;
        }
        const slug = slugify(o.nome) + '-' + rid();
        const r = await db(`insert into imobiliarias(nome,creci,slug,telefone,email,site,instagram,endereco,cidade,lat,lng,raio_atuacao_m,ativo,extra) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
          [o.nome, o.creci||null, slug, o.telefone||null, o.email||null, o.site||null, o.instagram||null, o.endereco||null, o.cidade||null, lat, lng, raio, ativo, JSON.stringify(extra)]);
        res.status(200).json({ row: imobOut(r.rows[0]) }); return;
      }

      // imoveis
      if (!o.titulo) { res.status(400).json({ error: 'titulo obrigatorio' }); return; }
      if (!o.imobiliaria_id) { res.status(400).json({ error: 'imobiliaria_id obrigatorio' }); return; }
      const tipo = MAP_TIPO[o.tipo] || 'outro', fin = MAP_FIN[o.finalidade] || 'venda', st = MAP_ST[o.status] || 'disponivel';
      const vals = [o.imobiliaria_id, o.titulo, o.codigo||null, tipo, fin, st, numOrNull(o.preco), numOrNull(o.area),
        intOrNull(o.quartos), intOrNull(o.suites), intOrNull(o.banheiros), intOrNull(o.vagas),
        o.endereco||null, o.bairro||null, o.cidade||null, o.descricao||null, JSON.stringify(extra)];
      if (o.id) {
        const r = await db(`update imoveis set imobiliaria_id=$1,titulo=$2,codigo=$3,tipo=$4,finalidade=$5,status=$6,preco=$7,area_util=$8,quartos=$9,suites=$10,banheiros=$11,vagas=$12,endereco=$13,bairro=$14,cidade=$15,descricao=$16,extra=$17,updated_at=now() where id=$18 returning *`,
          [...vals, o.id]);
        res.status(200).json({ row: imovOut(r.rows[0]) }); return;
      }
      const r = await db(`insert into imoveis(imobiliaria_id,titulo,codigo,tipo,finalidade,status,preco,area_util,quartos,suites,banheiros,vagas,endereco,bairro,cidade,descricao,extra) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning *`, vals);
      res.status(200).json({ row: imovOut(r.rows[0]) }); return;
    }

    res.status(400).json({ error: 'action invalida' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
