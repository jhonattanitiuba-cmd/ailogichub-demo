import './env.mjs';
const SB = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const APP = 'https://ailogichub.app';
const SENHA = 'AiLogicHub@2026';
const emails = ['diretoria','gestor','comercial','comercial-rep','corretor','autonomo','juridico','financeiro','marketing','proprietario','anunciante','cliente'].map(x => x + '@ailogichub.app');

async function signIn(email) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA })
  });
  const j = await r.json();
  return { ok: r.ok && !!j.access_token, token: j.access_token, perfil: j.user?.user_metadata?.perfil, err: j.error_description || j.msg };
}
async function apiFunil(token) {
  const r = await fetch(`${APP}/api/dash?action=funil`, { headers: { Authorization: 'Bearer ' + token } });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { return { status: r.status, raw: t.slice(0, 120) }; }
  const arr = Array.isArray(j) ? j : (j.negocios || j.items || j.data || j.rows || []);
  return { status: r.status, n: Array.isArray(arr) ? arr.length : ('?' + JSON.stringify(j).slice(0, 100)) };
}

console.log('=== LOGIN de todos os 12 ===');
const tokens = {};
for (const e of emails) {
  const s = await signIn(e);
  tokens[e] = s.token;
  console.log((s.ok ? 'OK ' : 'FALHA ') + e.padEnd(32) + ' perfil=' + (s.perfil || '-') + (s.err ? ' ERRO=' + s.err : ''));
}
console.log('\n=== ESCOPO (raw de /api/dash?action=funil) ===');
for (const e of ['diretoria@ailogichub.app', 'corretor@ailogichub.app', 'juridico@ailogichub.app']) {
  if (!tokens[e]) { console.log(e, '-> sem token'); continue; }
  const r = await fetch(`${APP}/api/dash?action=funil`, { headers: { Authorization: 'Bearer ' + tokens[e] } });
  const t = await r.text();
  console.log(e.padEnd(32), 'status', r.status, 'len', t.length, '::', t.slice(0, 300));
}
console.log('\n=== /api/data?entity=leads (contagem por perfil) ===');
for (const e of ['diretoria@ailogichub.app', 'corretor@ailogichub.app', 'juridico@ailogichub.app']) {
  const r = await fetch(`${APP}/api/data?entity=leads`, { headers: { Authorization: 'Bearer ' + tokens[e] } });
  const t = await r.text();
  console.log(e.padEnd(32), 'status', r.status, '::', t.slice(0, 200));
}
