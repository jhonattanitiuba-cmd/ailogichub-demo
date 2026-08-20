import './env.mjs';
import pg from 'pg';
const SB = process.env.SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC };
const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: false });
const q = (s, p) => c.query(s, p);
const demo = ['diretoria','gestor','comercial','comercial-rep','corretor','autonomo','juridico','financeiro','marketing','proprietario','anunciante','cliente'].map(x => x + '@ailogichub.app');
try {
  await c.connect();
  console.log('=== usuarios com auth_user_id (todos) ===');
  console.log(JSON.stringify((await q(`select email, auth_user_id, perfil from usuarios where auth_user_id is not null order by email`)).rows, null, 0));
  console.log('\n=== usuarios rows dos e-mails demo ===');
  console.log(JSON.stringify((await q(`select email, perfil, imobiliaria_id, auth_user_id from usuarios where lower(email)=any($1) order by email`, [demo])).rows, null, 0));
  console.log('\n=== Auth admin: id por e-mail demo ===');
  for (const e of demo) {
    const g = await fetch(`${SB}/auth/v1/admin/users?per_page=500&email=${encodeURIComponent(e)}`, { headers: H });
    const gj = await g.json(); const list = Array.isArray(gj) ? gj : (gj.users || []);
    const matches = list.filter(u => (u.email || '').toLowerCase() === e);
    console.log(e, '-> matches:', matches.length, matches.map(m => m.id).join(','), '| lista total retornada:', list.length);
  }
} catch (e) { console.error('ERRO:', e.message); }
finally { await c.end(); }
