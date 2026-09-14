// AILOGIC HUB — entrega a config PÚBLICA do front (URL + anon key) como JS.
// Lê das env vars da Vercel; nada versionado. A anon key é pública por design.
// Com ?diag=1: retorna um diagnostico de rede/cert do servidor ate o Supabase (sem segredos),
// usado para investigar 401 em massa. Nao expoe a anon key nem token.
module.exports = async (req, res) => {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // ---- diagnostico (temporario): /api/config?diag=1 ----
  if (req.query && (req.query.diag === '1' || req.query.diag === 'true')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const out = {
      supabase_url_set: !!url,
      supabase_url_host: url ? (function () { try { return new URL(url).host; } catch (_) { return '(url invalida)'; } })() : null,
      anon_key_set: !!anon,
      db_url_set: !!(process.env.DB_URL || ''),
      node: process.version
    };
    try {
      const r = await fetch(url + '/auth/v1/health', { headers: anon ? { apikey: anon } : {} });
      out.health_status = r.status;
      out.health_body = (await r.text()).slice(0, 160);
    } catch (e) {
      out.health_error = String((e && e.message) || e);
      out.health_error_code = (e && e.cause && (e.cause.code || e.cause.message)) ? String(e.cause.code || e.cause.message) : null;
    }
    res.status(200).json(out);
    return;
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(
    'window.HUB_CONFIG=' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anon }) + ';'
  );
};
