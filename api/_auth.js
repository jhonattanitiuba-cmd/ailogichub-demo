// AILOGIC HUB — Guard de autenticação + RBAC (Supabase Auth / GoTrue)
// Verifica o access_token do usuário e resolve perfil + imobiliária para
// permitir que cada API filtre os dados por permissão.
// Config via env vars: SUPABASE_URL, SUPABASE_ANON_KEY, DB_URL.
const { db } = require('./_db');
const { cacheGet, cacheSet } = require('./_cache');
const crypto = require('crypto');
// hash do token (nunca o token em claro em chave/log)
function tokenHash(t) { try { return crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 32); } catch (_) { return null; } }
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// Segredo JWT do GoTrue (mesmo que gerou a anon key). Quando presente, validamos o
// token LOCALMENTE (HS256) sem depender do /auth/v1/user do provedor — mais rapido e
// resiliente. Nao vai para o cliente (so backend). Aceita alguns nomes comuns de env.
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.GOTRUE_JWT_SECRET || process.env.JWT_SECRET || '';
const DB_URL = process.env.DB_URL || '';

// base64url -> objeto JSON (sem validar assinatura)
function decodeJwtPart(part) {
  try { return JSON.parse(Buffer.from(String(part).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); }
  catch (_) { return null; }
}
// Verificacao LOCAL do access_token (HS256) usando o segredo do GoTrue.
// Retorna { ok, reason, user }. user tem o formato que resolveScope espera.
function localVerify(token) {
  if (!JWT_SECRET) return { ok: false, reason: 'sem_segredo' };
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return { ok: false, reason: 'formato' };
    const header = decodeJwtPart(parts[0]);
    if (!header || String(header.alg).toUpperCase() !== 'HS256') return { ok: false, reason: 'alg_' + (header && header.alg) };
    const data = parts[0] + '.' + parts[1];
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const got = parts[2];
    // comparacao em tempo constante
    const a = Buffer.from(expected), b = Buffer.from(got);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'assinatura' };
    const claims = decodeJwtPart(parts[1]);
    if (!claims) return { ok: false, reason: 'claims' };
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) return { ok: false, reason: 'expirado' };
    if (!claims.sub) return { ok: false, reason: 'sem_sub' };
    const user = { id: claims.sub, email: claims.email || null, user_metadata: claims.user_metadata || {}, aud: claims.aud || null, role: claims.role || null };
    return { ok: true, reason: 'ok', user: user };
  } catch (e) { return { ok: false, reason: 'erro:' + String((e && e.message) || e) }; }
}

// perfis com acesso total (veem todas as imobiliárias)
const ADMIN_ROLES = ['admin', 'administrador', 'diretor', 'diretoria', 'dono', 'owner', 'super'];
function isAdminRole(p) { return ADMIN_ROLES.indexOf(String(p || '').toLowerCase()) >= 0; }
// perfis de advogado/associado: NÃO veem o geral; só os negócios atribuídos a eles
const LAWYER_ROLES = ['advogado', 'associado', 'juridico', 'jurídico'];
function isLawyerRole(p) { return LAWYER_ROLES.indexOf(String(p || '').toLowerCase()) >= 0; }
// perfis "self": corretor/autônomo veem só os proprios registros (responsavel_id),
// diferente do gestor/comercial que veem a imobiliaria inteira.
const SELF_ROLES = ['corretor', 'parceiro'];
function isSelfRole(p) { return SELF_ROLES.indexOf(String(p || '').toLowerCase()) >= 0; }
// ids dos negócios atribuídos a um advogado (join negocio_advogado)
async function negociosDoAdvogado(usuarioId) {
  if (!usuarioId) return [];
  try { const r = await db('select negocio_id from negocio_advogado where advogado_id=$1', [usuarioId]); return (r.rows || []).map(x => x.negocio_id).filter(Boolean); }
  catch (_) { return []; }
}

// departamento amigável para a assinatura das mensagens (Nome / Departamento).
// Deriva do perfil; sobrescrevível por usuarios.extra.departamento.
const DEPT_MAP = {
  diretoria: 'Diretoria', diretor: 'Diretoria', dono: 'Diretoria', owner: 'Diretoria',
  admin: 'Diretoria', administrador: 'Diretoria', super: 'Diretoria',
  gestor: 'Gestão', corretor: 'Comercial', comercial: 'Comercial',
  advogado: 'Jurídico', juridico: 'Jurídico', 'jurídico': 'Jurídico',
  marketing: 'Marketing', financeiro: 'Financeiro', parceiro: 'Parceria', suporte: 'Suporte'
};
function departamentoDe(perfil, extra) {
  try { if (extra && extra.departamento) return String(extra.departamento); } catch (_) {}
  return DEPT_MAP[String(perfil || '').toLowerCase()] || 'Atendimento';
}

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

// valida o token no GoTrue e retorna o usuário do Supabase (ou null)
async function getUser(req) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('[auth] getUser: env ausente', { hasUrl: !!SUPABASE_URL, hasAnon: !!SUPABASE_ANON_KEY }); return null; }
    const token = bearer(req);
    if (!token) return null;   // requisicao sem token e fluxo normal (nao loga)
    // 1) validacao LOCAL (HS256) quando ha segredo: rapida e independente do /user do provedor.
    const lv = localVerify(token);
    if (lv.ok) return lv.user;
    if (JWT_SECRET && lv.reason !== 'sem_segredo') {
      // segredo configurado mas o token nao passou -> loga o motivo e NAO tenta o /user
      // (evita mascarar um segredo errado com o endpoint quebrado). So expirado/assinatura chegam aqui.
      console.error('[auth] getUser: verificacao local falhou', { reason: lv.reason });
      // segue para o fallback abaixo apenas se NAO for erro de assinatura (pode ser divergencia de config)
      if (lv.reason === 'assinatura') return null;
    }
    // 2) fallback: valida no GoTrue /auth/v1/user (comportamento original)
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) {
      let body = ''; try { body = (await r.text()).slice(0, 220); } catch (_) {}
      let claims = null; try { const p = token.split('.')[1]; claims = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (_) {}
      const now = Math.floor(Date.now() / 1000);
      console.error('[auth] getUser: GoTrue rejeitou o token', {
        status: r.status, gotrue_body: body,
        token_iss: claims && claims.iss, token_aud: claims && claims.aud,
        token_exp: claims && claims.exp, agora: now,
        expirado: (claims && claims.exp) ? (claims.exp < now) : null
      });
      return null;
    }
    return await r.json();
  } catch (e) { console.error('[auth] getUser: falha ao validar (rede/cert?)', String((e && e.message) || e), 'url=' + SUPABASE_URL); return null; }
}

// resolve perfil + imobiliaria_id a partir da tabela usuarios (fonte de
// verdade) com fallback para o user_metadata do Supabase.
async function resolveScope(user) {
  const meta = (user && user.user_metadata) || {};
  const email = (user && user.email) || null;
  let perfil = null;              // SEGURANCA: perfil NUNCA vem do user_metadata (cliente controla) — so da tabela usuarios ou founder
  let imobiliariaId = null;       // SEGURANCA: idem — escopo de tenant so vem da tabela usuarios
  let usuarioId = null, nome = meta.nome || null, extra = null;
  try {
    if (DB_URL && user && user.id) {
      // 1) fonte de verdade: linha ligada ao login (auth_user_id)
      let r = await db('select id, nome, perfil, imobiliaria_id, extra from usuarios where auth_user_id=$1 and deleted_at is null limit 1', [user.id]);
      // 2) fallback por e-mail (verificado pelo GoTrue): liga o perfil sem depender de auth_user_id
      if (!r.rows[0] && email) {
        r = await db('select id, nome, perfil, imobiliaria_id, extra from usuarios where lower(email)=lower($1) and deleted_at is null order by created_at limit 1', [email]);
        if (r.rows[0]) {
          // backfill: torna o vínculo permanente para os próximos acessos
          try { await db('update usuarios set auth_user_id=$1 where id=$2 and auth_user_id is null', [user.id, r.rows[0].id]); } catch (_) {}
        }
      }
      if (r.rows[0]) {
        usuarioId = r.rows[0].id || null;
        nome = r.rows[0].nome || nome;
        perfil = r.rows[0].perfil || perfil;
        extra = r.rows[0].extra || null;
        if (r.rows[0].imobiliaria_id) imobiliariaId = r.rows[0].imobiliaria_id;
      }
    }
  } catch (_) {}
  // 3) bootstrap de fundador: e-mail do dono entra como admin do Hub
  let isAdmin = isAdminRole(perfil);
  if (!isAdmin && isFounder(email)) { perfil = perfil || 'admin'; isAdmin = true; }
  return {
    user: user, authId: user && user.id, email: email, nome: nome,
    usuarioId: usuarioId, perfil: perfil, departamento: departamentoDe(perfil, extra),
    imobiliariaId: imobiliariaId, isAdmin: isAdmin
  };
}

// Uso no handler:  const ctx = await requireAuth(req, res); if (!ctx) return;
// ctx.isAdmin -> vê tudo;  ctx.imobiliariaId -> escopo do usuário.
async function requireAuth(req, res) {
  // cache do escopo por hash do token (warm hit pula GoTrue + queries de escopo).
  // Se o Redis estiver off, ck=null e segue o fluxo normal (fallback intacto).
  const tok = bearer(req);
  const ck = tok ? ('auth:' + tokenHash(tok)) : null;
  if (ck) { try { const hit = await cacheGet(ck); if (hit) return hit; } catch (_) {} }

  const user = await getUser(req);
  if (!user) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(401).json({ error: 'nao autenticado' });
    return null;
  }
  const scope = await resolveScope(user);
  if (ck && scope) { try { await cacheSet(ck, scope, 60); } catch (_) {} }   // TTL 60s
  return scope;
}

module.exports = { getUser, requireAuth, isAdminRole, isLawyerRole, isSelfRole, negociosDoAdvogado, departamentoDe, localVerify };
