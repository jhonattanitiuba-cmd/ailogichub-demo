import './env.mjs';
const SB = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, APP = 'https://ailogichub.app', SENHA = 'AiLogicHub@2026';
const tok = async (e) => (await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: SENHA }) })).json()).access_token;
const list = async (t, ent) => { const r = await fetch(`${APP}/api/data?ent=${ent}&action=list`, { headers: { Authorization: 'Bearer ' + t } }); const j = await r.json(); return (j.rows || []).length; };
const resumo = async (t) => { const r = await fetch(`${APP}/api/dash?action=resumo`, { headers: { Authorization: 'Bearer ' + t } }); const j = await r.json(); return j.leadsTotal; };

const cor = await tok('corretor@ailogichub.app'), ges = await tok('gestor@ailogichub.app'), dir = await tok('diretoria@ailogichub.app');
// espera o deploy: corretor deve cair de 5 (imob) para 3 (proprios)
let tries = 0;
while (tries++ < 40) { if ((await list(cor, 'leads')) <= 3) break; await new Promise(r => setTimeout(r, 3000)); }
console.log('=== LEADS (list) ===');
console.log('corretor@ (so os dele):', await list(cor, 'leads'));
console.log('gestor@   (imob toda):', await list(ges, 'leads'));
console.log('diretoria@(admin all):', await list(dir, 'leads'));
console.log('=== DASHBOARD resumo (leadsTotal) ===');
console.log('corretor@:', await resumo(cor), '| gestor@:', await resumo(ges), '| diretoria@:', await resumo(dir));
console.log('=== IMOVEIS (corretor deve ver o acervo da imob, nao filtrado) ===');
console.log('corretor@ imoveis:', await list(cor, 'imoveis'), '| gestor@ imoveis:', await list(ges, 'imoveis'));
