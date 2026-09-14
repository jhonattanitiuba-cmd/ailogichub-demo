// AILOGIC HUB - diagnostico TEMPORARIO de auth/rede (sem expor segredos).
// Testa, do lado do servidor (Vercel), se da para alcancar o Supabase (SUPABASE_URL) e
// o que o GoTrue responde. Nao retorna a anon key nem token; so status e host.
// REMOVER apos o diagnostico.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const out = {
    supabase_url_set: !!url,
    supabase_url_host: url ? (function () { try { return new URL(url).host; } catch (_) { return '(url invalida)'; } })() : null,
    anon_key_set: !!anon,
    db_url_set: !!(process.env.DB_URL || ''),
    node: process.version
  };
  // 1) alcanca o /auth/v1/health? (sem auth) -> testa rede/DNS/cert do servidor ate o cloudfy.live
  try {
    const r = await fetch(url + '/auth/v1/health', { headers: anon ? { apikey: anon } : {} });
    out.health_status = r.status;
    out.health_body = (await r.text()).slice(0, 160);
  } catch (e) {
    out.health_error = String((e && e.message) || e);
    out.health_error_code = (e && e.cause && (e.cause.code || e.cause.message)) ? String(e.cause.code || e.cause.message) : null;
  }
  res.status(200).json(out);
};
