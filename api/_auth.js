// AI LOGIC HUB — Guard de autenticação server-side (Supabase Auth / GoTrue)
// Verifica o access_token (JWT) do usuário chamando o GoTrue self-hosted.
// Segredos/config via env vars da Vercel: SUPABASE_URL, SUPABASE_ANON_KEY.
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function bearer(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

// Retorna o usuário autenticado (objeto do GoTrue) ou null.
async function getUser(req) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    const token = bearer(req);
    if (!token) return null;
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

// Uso no handler:  const user = await requireAuth(req, res); if (!user) return;
async function requireAuth(req, res) {
  const user = await getUser(req);
  if (!user) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(401).json({ error: 'nao autenticado' });
    return null;
  }
  return user;
}

module.exports = { getUser, requireAuth };
