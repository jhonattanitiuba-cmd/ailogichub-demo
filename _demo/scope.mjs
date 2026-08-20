import './env.mjs';
const SB = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, APP = 'https://ailogichub.app', SENHA = 'AiLogicHub@2026';
async function tok(email) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: SENHA }) });
  const j = await r.json(); return j.access_token;
}
async function funil(t) {
  const r = await fetch(`${APP}/api/dash?action=funil`, { headers: { Authorization: 'Bearer ' + t } });
  const j = await r.json(); const cards = j.cards || [];
  const byImob = {}; const byEt = {};
  cards.forEach(c => { byImob[c.imob_nome] = (byImob[c.imob_nome] || 0) + 1; byEt[c.etapa] = (byEt[c.etapa] || 0) + 1; });
  return { total: cards.length, imobiliarias: Object.keys(byImob).length, novaEra: byImob['Nova Era Imoveis'] || 0, etapas: Object.keys(byEt).length };
}
for (const p of ['diretoria', 'gestor', 'comercial', 'corretor', 'financeiro', 'marketing', 'juridico']) {
  const e = p + '@ailogichub.app'; const t = await tok(e);
  console.log(e.padEnd(30), JSON.stringify(await funil(t)));
}
