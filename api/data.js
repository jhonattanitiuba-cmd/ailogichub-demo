// AI LOGIC HUB — CRUD de imobiliárias e imóveis no Supabase (Serverless Vercel)
// Colunas escalares populadas + coluna `extra jsonb` com os campos do formulário.
// Segredo DB_URL em env var da Vercel.
const { Client } = require('pg');
const { requireAuth } = require('./_auth');
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
function corOut(r) {
  const e = r.extra || {};
  return Object.assign({
    id: r.id, imobiliaria_id: r.imobiliaria_id, nome: r.nome, email: r.email,
    telefone: r.telefone, creci: r.creci, perfil: r.perfil, status: (r.ativo ? 'Ativo' : 'Inativo')
  }, e);
}
function leadOut(r) {
  const e = r.extra || {};
  return Object.assign({
    id: r.id, imobiliaria_id: r.imobiliaria_id, nome: r.nome, telefone: r.telefone, email: r.email,
    status: r.status, fonte_id: r.fonte_id, responsavel_id: r.responsavel_id, score: r.score,
    interesse: r.interesse, motivo_perda: r.motivo_perda, ultimo_contato: r.ultimo_contato, created_at: r.created_at
  }, e);
}
function fonteOut(r) {
  return { id: r.id, imobiliaria_id: r.imobiliaria_id, nome: r.nome, canal: r.canal, ativo: r.ativo };
}
function negOut(r) {
  return {
    id: r.id, imobiliaria_id: r.imobiliaria_id, lead_id: r.lead_id, imovel_id: r.imovel_id,
    responsavel_id: r.responsavel_id, etapa_funil: r.etapa_funil,
    valor: r.valor != null ? Number(r.valor) : null, comissao: r.comissao != null ? Number(r.comissao) : null,
    rlor: r.rlor != null ? Number(r.rlor) : null, motivo_perda: r.motivo_perda,
    fechado_em: r.fechado_em, created_at: r.created_at
  };
}
function atividadeOut(r) {
  return { id: r.id, imobiliaria_id: r.imobiliaria_id, lead_id: r.lead_id, negocio_id: r.negocio_id, responsavel_id: r.responsavel_id, titulo: r.titulo, tipo: r.tipo, inicio: r.inicio, fim: r.fim, concluida: r.concluida, created_at: r.created_at };
}
function contratoOut(r) {
  return { id: r.id, imobiliaria_id: r.imobiliaria_id, negocio_id: r.negocio_id, status_assinatura: r.status_assinatura, assinado_em: r.assinado_em, url_assinado: r.url_assinado, created_at: r.created_at };
}
const TABLE = { imobiliarias: 'imobiliarias', imoveis: 'imoveis', corretores: 'usuarios', leads: 'leads', fontes: 'fontes_lead', negocios: 'negocios', agenda: 'atividades', contratos: 'contratos' };
const OUT = { imobiliarias: imobOut, imoveis: imovOut, corretores: corOut, leads: leadOut, fontes: fonteOut, negocios: negOut, agenda: atividadeOut, contratos: contratoOut };
// tabelas que têm coluna deleted_at (soft delete)
const SOFT = new Set(['imobiliarias', 'imoveis', 'usuarios', 'leads', 'negocios']);
// entidades somente-leitura (bloqueiam save)
const READONLY = new Set(['fontes', 'negocios', 'agenda', 'contratos']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await requireAuth(req, res); if (!user) return;
    if (!DB_URL) { res.status(500).json({ error: 'backend nao configurado (DB_URL)' }); return; }
    const ent = req.query && req.query.ent;
    const action = (req.query && req.query.action) || 'list';
    if (!TABLE[ent]) { res.status(400).json({ error: 'ent invalido' }); return; }
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};

    // ---- LIST ----
    if (action === 'list') {
      const where = SOFT.has(TABLE[ent]) ? 'where deleted_at is null' : '';
      const r = await db(`select * from ${TABLE[ent]} ${where} order by created_at`);
      res.status(200).json({ rows: r.rows.map(OUT[ent]) });
      return;
    }

    // ---- DELETE (hard; imobiliaria cascateia pros imoveis) ----
    if (action === 'delete') {
      const id = body.id || (req.query && req.query.id);
      if (!id) { res.status(400).json({ error: 'id obrigatorio' }); return; }
      if (ent === 'imobiliarias') {
        const vc = await db(`select (select count(*) from usuarios where imobiliaria_id=$1 and deleted_at is null) cor, (select count(*) from imoveis where imobiliaria_id=$1 and deleted_at is null) imo`, [id]);
        const cor = +vc.rows[0].cor, imo = +vc.rows[0].imo;
        if (cor > 0 || imo > 0) { res.status(409).json({ error: 'Imobiliária tem ' + cor + ' corretor(es) e ' + imo + ' imóvel(eis) vinculados. Remova ou realoque antes de excluir.' }); return; }
      }
      await db(`delete from ${TABLE[ent]} where id=$1`, [id]);
      res.status(200).json({ ok: true });
      return;
    }

    // ---- SAVE (insert/update) ----
    if (action === 'save') {
      if (READONLY.has(ent)) { res.status(400).json({ error: 'save nao suportado para ' + ent + ' (somente leitura)' }); return; }
      if (ent === 'leads') {
        const o = body;
        if (!o.nome) { res.status(400).json({ error: 'nome obrigatorio' }); return; }
        if (!o.imobiliaria_id) { res.status(400).json({ error: 'imobiliaria_id obrigatorio' }); return; }
        if (o.id) {
          const r = await db(`update leads set nome=$1,telefone=$2,email=$3,interesse=$4,updated_at=now() where id=$5 returning *`,
            [o.nome, o.telefone || null, o.email || null, o.interesse || null, o.id]);
          res.status(200).json({ row: leadOut(r.rows[0]) }); return;
        }
        const r = await db(`insert into leads(imobiliaria_id,nome,telefone,email,interesse) values($1,$2,$3,$4,$5) returning *`,
          [o.imobiliaria_id, o.nome, o.telefone || null, o.email || null, o.interesse || null]);
        res.status(200).json({ row: leadOut(r.rows[0]) }); return;
      }
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

      if (ent === 'corretores') {
        if (!o.nome) { res.status(400).json({ error: 'nome obrigatorio' }); return; }
        const ativo = o.status !== 'Inativo' && o.status !== 'Pausado';
        const perfil = o.perfil || 'corretor';
        const imob = o.imobiliaria_id || null;
        if (o.id) {
          const r = await db(`update usuarios set imobiliaria_id=$1,nome=$2,email=$3,telefone=$4,creci=$5,perfil=$6,ativo=$7,extra=$8,updated_at=now() where id=$9 returning *`,
            [imob, o.nome, o.email||null, o.telefone||null, o.creci||null, perfil, ativo, JSON.stringify(extra), o.id]);
          res.status(200).json({ row: corOut(r.rows[0]) }); return;
        }
        const r = await db(`insert into usuarios(imobiliaria_id,nome,email,telefone,creci,perfil,ativo,extra) values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
          [imob, o.nome, o.email||null, o.telefone||null, o.creci||null, perfil, ativo, JSON.stringify(extra)]);
        res.status(200).json({ row: corOut(r.rows[0]) }); return;
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
