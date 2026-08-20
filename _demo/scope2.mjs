import './env.mjs';
const SB = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, APP = 'https://ailogichub.app', SENHA = 'AiLogicHub@2026';
async function tok(email) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: SENHA }) });
  return (await r.json()).access_token;
}
async function get(path, t) {
  const r = await fetch(APP + path, { headers: { Authorization: 'Bearer ' + t } });
  const txt = await r.text();
  return { status: r.status, snip: txt.slice(0, 220) };
}
for (const p of ['diretoria', 'corretor', 'juridico']) {
  const t = await tok(p + '@ailogichub.app');
  console.log('\n### ' + p);
  console.log('  /api/dash            ', JSON.stringify(await get('/api/dash', t)));
  console.log('  /api/dash?action=resumo', JSON.stringify(await get('/api/dash?action=resumo', t)));
}
// juridico: assinaturas/contratos e negocios atribuidos
const tj = await tok('juridico@ailogichub.app');
console.log('\n### juridico extras');
console.log('  /api/juris?action=lista', JSON.stringify(await get('/api/juris?action=lista', tj)));
console.log('  /api/juris             ', JSON.stringify(await get('/api/juris', tj)));
