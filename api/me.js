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
  const b64url = function (s) { try { return JSON.parse(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (_) { return null; } };
  const anonClaims = anon ? b64url((anon.split('.')[1] || '')) : null;
  const out = {
    supabase_url_host: (function () { try { return new URL(url).host; } catch (_) { return null; } })(),
    anon_key_set: !!anon, token_present: !!token,
    anon_key: anonClaims ? { iss: anonClaims.iss || null, ref: anonClaims.ref || null, role: anonClaims.role || null } : null
  };
  if (!token) { res.status(200).json(out); return; }
  const parts = token.split('.');
  // header (parte 1): revela o algoritmo de assinatura (HS256 simetrico vs ES256/RS256 assimetrico) e a chave (kid)
  const header = b64url(parts[0] || '');
  out.jwt_header = header ? { alg: header.alg || null, kid: header.kid || null, typ: header.typ || null } : null;
  // claims (parte 2), sem validar assinatura, so para inspecao
  const claims = b64url(parts[1] || '');
  if (claims) {
    const now = Math.floor(Date.now() / 1000);
    out.claims = {
      iss: claims.iss || null, aud: claims.aud || null, role: claims.role || null,
      ref: claims.ref || null, sub: claims.sub || null,
      exp: claims.exp || null, iat: claims.iat || null,
      expirado: claims.exp ? (claims.exp < now) : null,
      exp_em_min: claims.exp ? Math.round((claims.exp - now) / 60) : null,
      email: claims.email || null
    };
  } else { out.claims_error = 'nao decodificou'; }
  // Teste A: /user COM apikey + Authorization (exatamente como o _auth.js faz hoje)
  try {
    const r = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token } });
    out.teste_A_com_apikey = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch (e) { out.teste_A_com_apikey = { erro: String((e && e.message) || e) }; }
  // Teste B: /user SO com Authorization (sem apikey) -> isola se a anon key e a causa do "Bad request"
  try {
    const r = await fetch(url + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + token } });
    out.teste_B_sem_apikey = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch (e) { out.teste_B_sem_apikey = { erro: String((e && e.message) || e) }; }
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
