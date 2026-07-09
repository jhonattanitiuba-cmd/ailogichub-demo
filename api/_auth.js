// AILOGIC HUB — Guard de autenticação + RBAC (Supabase Auth / GoTrue)
// Verifica o access_token do usuário e resolve perfil + imobiliária para
// permitir que cada API filtre os dados por permissão.
// Config via env vars: SUPABASE_URL, SUPABASE_ANON_KEY, DB_URL.
const { Client } = require('pg');
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const DB_URL = process.env.DB_URL || '';

// perfis com acesso total (veem todas as imobiliárias)
const ADMIN_ROLES = ['admin', 'administrador', 'diretor', 'diretoria', 'dono', 'owner', 'super'];
function isAdminRole(p) { return ADMIN_ROLES.indexOf(String(p || '').toLowerCase()) >= 0; }

// e-mails "fundadores" que entram como admin do Hub mesmo sem linha em usuarios
// (bootstrap do primeiro acesso). Pode ser sobrescrito por env FOUNDER_EMAILS.
const FOUNDER_EMAILS = (process.env.FOUNDER_EMAILS || 'tecnologia@ailogichub.app')
  .split(',').map(function (e) { return e.trim().toLowerCase(); }).filter(Boolean);
function isFounder(email) { return !!email && FOUNDER_EMAILS.indexOf(String(email).toLowerCase()) >= 0; }

function bearer(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

async function db(q, p) {
  const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
  await c.connect();
  try { return await c.query(q, p); } finally { try { await c.end(); } catch (_) {} }
}

// valida o token no GoTrue e retorna o usuário do Supabase (ou null)
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

// resolve perfil + imobiliaria_id a partir da tabela usuarios (fonte de
// verdade) com fallback para o user_metadata do Supabase.
async function resolveScope(user) {
  const meta = (user && user.user_metadata) || {};
  const email = (user && user.email) || null;
  let perfil = meta.perfil || null;
  let imobiliariaId = meta.imobiliaria_id || null;
  try {
    if (DB_URL && user && user.id) {
      // 1) fonte de verdade: linha ligada ao login (auth_user_id)
      let r = await db('select id, perfil, imobiliaria_id from usuarios where auth_user_id=$1 and deleted_at is null limit 1', [user.id]);
      // 2) fallback por e-mail (verificado pelo GoTrue): liga o perfil sem depender de auth_user_id
      if (!r.rows[0] && email) {
        r = await db('select id, perfil, imobiliaria_id from usuarios where lower(email)=lower($1) and deleted_at is null order by created_at limit 1', [email]);
        if (r.rows[0]) {
          // backfill: torna o vínculo permanente para os próximos acessos
          try { await db('update usuarios set auth_user_id=$1 where id=$2 and auth_user_id is null', [user.id, r.rows[0].id]); } catch (_) {}
        }
      }
      if (r.rows[0]) {
        perfil = r.rows[0].perfil || perfil;
        if (r.rows[0].imobiliaria_id) imobiliariaId = r.rows[0].imobiliaria_id;
      }
    }
  } catch (_) {}
  // 3) bootstrap de fundador: e-mail do dono entra como admin do Hub
  let isAdmin = isAdminRole(perfil);
  if (!isAdmin && isFounder(email)) { perfil = perfil || 'admin'; isAdmin = true; }
  return {
    user: user, authId: user && user.id, email: email,
    perfil: perfil, imobiliariaId: imobiliariaId, isAdmin: isAdmin
  };
}

// Uso no handler:  const ctx = await requireAuth(req, res); if (!ctx) return;
// ctx.isAdmin -> vê tudo;  ctx.imobiliariaId -> escopo do usuário.
async function requireAuth(req, res) {
  const user = await getUser(req);
  if (!user) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(401).json({ error: 'nao autenticado' });
    return null;
  }
  return await resolveScope(user);
}

module.exports = { getUser, requireAuth, isAdminRole };
