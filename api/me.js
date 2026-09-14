// AILOGIC HUB — perfil resolvido do usuario logado (fonte de verdade: tabela usuarios).
// Usado pelo front para (a) restringir o menu por perfil e (b) bloquear acesso direto
// a telas que o perfil nao pode ver. A isolacao por imobiliaria continua sendo feita
// no escopo das queries (api/_auth.js). Este endpoint nunca confia no user_metadata.
const { requireAuth } = require('./_auth');

// Diagnostico temporario (/api/me?diag=token): NAO passa pelo requireAuth.
// Le o Bearer enviado pelo navegador, decodifica os claims (sem validar assinatura),
// chama o GoTrue /auth/v1/user com esse token e devolve status + corpo. Sem segredos:
// nao expoe apikey nem o token em claro. Serve para descobrir por que o 401 acontece.
async function diagToken(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  const token = m ? m[1].trim() : null;
  const out = { supabase_url_host: (function () { try { return new URL(url).host; } catch (_) { return null; } })(), anon_key_set: !!anon, token_present: !!token };
  if (!token) { res.status(200).json(out); return; }
  // claims (parte 2 do JWT), sem validar assinatura, so para inspecao
  try {
    const p = token.split('.')[1];
    const claims = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    out.claims = {
      iss: claims.iss || null, aud: claims.aud || null, role: claims.role || null,
      exp: claims.exp || null, iat: claims.iat || null,
      expirado: claims.exp ? (claims.exp < now) : null,
      exp_em_min: claims.exp ? Math.round((claims.exp - now) / 60) : null,
      email: claims.email || null
    };
  } catch (e) { out.claims_error = String((e && e.message) || e); }
  // valida no GoTrue exatamente como o _auth.js faz
  try {
    const r = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token } });
    out.gotrue_status = r.status;
    out.gotrue_body = (await r.text()).slice(0, 300);
  } catch (e) {
    out.gotrue_error = String((e && e.message) || e);
    out.gotrue_error_code = (e && e.cause && (e.cause.code || e.cause.message)) ? String(e.cause.code || e.cause.message) : null;
  }
  res.status(200).json(out);
}

module.exports = async (req, res) => {
  if (req.query && (req.query.diag === 'token')) { return diagToken(req, res); }
  res.setHeader('Cache-Control', 'no-store');
  const ctx = await requireAuth(req, res);
  if (!ctx) return; // requireAuth ja respondeu 401
  res.status(200).json({
    perfil: ctx.perfil || null,
    isAdmin: !!ctx.isAdmin,
    imobiliariaId: ctx.imobiliariaId || null,
    nome: ctx.nome || null,
    departamento: ctx.departamento || null
  });
};
