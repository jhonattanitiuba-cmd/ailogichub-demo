// AILOGIC HUB — Vitrine PÚBLICA de imóveis (sem autenticação, somente leitura).
// Alimenta a página /vitrine (feed estilo TikTok) para clientes finais.
// Retorna apenas imóveis disponíveis e campos seguros de exibição (sem endereço exato,
// sem dados internos). Segredo DB_URL em env var da Vercel.
const { db } = require('./_db');
const DB_URL = process.env.DB_URL || '';

// só campos públicos; endereço exato e ids internos ficam de fora
function pubOut(r) {
  const e = r.extra || {};
  const fotos = Array.isArray(e.fotos) ? e.fotos.filter(Boolean) : [];
  const foto = e.foto || fotos[0] || '';
  return {
    id: r.id,
    titulo: r.titulo,
    codigo: r.codigo,
    tipo: r.tipo,
    finalidade: r.finalidade,
    preco: r.preco != null ? Number(r.preco) : null,
    area: r.area_util != null ? Number(r.area_util) : null,
    quartos: r.quartos, suites: r.suites, banheiros: r.banheiros, vagas: r.vagas,
    bairro: r.bairro, cidade: r.cidade,
    descricao: r.descricao,
    foto: foto,
    fotos: fotos.length ? fotos : (foto ? [foto] : []),
    imobiliaria: r.imob_nome || ''
  };
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
  if (!DB_URL) { res.status(200).json({ rows: [] }); return; }
  try {
    const r = await db(
      `select i.id, i.titulo, i.codigo, i.tipo, i.finalidade, i.status,
              i.preco, i.area_util, i.quartos, i.suites, i.banheiros, i.vagas,
              i.bairro, i.cidade, i.descricao, i.extra, m.nome as imob_nome
         from imoveis i
         left join imobiliarias m on m.id = i.imobiliaria_id
        where i.deleted_at is null
          and i.status = 'disponivel'
        order by i.created_at desc
        limit 200`
    );
    res.status(200).json({ rows: r.rows.map(pubOut) });
  } catch (e) {
    res.status(200).json({ rows: [], error: 'indisponivel' });
  }
};
