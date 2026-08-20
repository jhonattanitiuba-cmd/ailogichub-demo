import './env.mjs';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: false });
const q = (s, p) => c.query(s, p);
try {
  await c.connect();
  const A = (await q(`select id from imobiliarias where slug='teste-a'`)).rows[0].id;
  const uid = async (e) => (await q(`select id from usuarios where lower(email)=lower($1)`, [e])).rows[0]?.id;
  const cor = await uid('corretor@ailogichub.app');
  const aut = await uid('autonomo@ailogichub.app');
  if (!cor) throw new Error('corretor demo nao encontrado');

  // leads da teste-a em ordem
  const leads = (await q(`select id from leads where imobiliaria_id=$1 and deleted_at is null order by created_at`, [A])).rows.map(r => r.id);
  // 3 primeiros -> corretor@ ; 4o -> autonomo@ (se existir) ; resto fica
  for (let i = 0; i < leads.length; i++) {
    const alvo = i < 3 ? cor : (i === 3 && aut ? aut : null);
    if (alvo) await q(`update leads set responsavel_id=$1, updated_at=now() where id=$2`, [alvo, leads[i]]);
  }
  // negocios: metade -> corretor@
  const negs = (await q(`select id from negocios where imobiliaria_id=$1 and deleted_at is null order by created_at`, [A])).rows.map(r => r.id);
  for (let i = 0; i < negs.length; i++) { if (i % 2 === 0) await q(`update negocios set responsavel_id=$1, updated_at=now() where id=$2`, [cor, negs[i]]); }
  // atividades (agenda) -> corretor@
  await q(`update atividades set responsavel_id=$1, updated_at=now() where imobiliaria_id=$2`, [cor, A]);

  const nL = (await q(`select count(*)::int n from leads where imobiliaria_id=$1 and responsavel_id=$2 and deleted_at is null`, [A, cor])).rows[0].n;
  const nN = (await q(`select count(*)::int n from negocios where imobiliaria_id=$1 and responsavel_id=$2 and deleted_at is null`, [A, cor])).rows[0].n;
  const nA = (await q(`select count(*)::int n from atividades where imobiliaria_id=$1 and responsavel_id=$2`, [A, cor])).rows[0].n;
  console.log('corretor@ agora tem -> leads:', nL, '| negocios:', nN, '| atividades:', nA);
  console.log('autonomo@ leads:', aut ? (await q(`select count(*)::int n from leads where imobiliaria_id=$1 and responsavel_id=$2`, [A, aut])).rows[0].n : 'n/a');
} catch (e) { console.error('ERRO:', e.message); }
finally { await c.end(); }
