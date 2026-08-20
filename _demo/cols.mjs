import './env.mjs';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: false });
const q = (s, p) => c.query(s, p);
try {
  await c.connect();
  for (const t of ['negocios', 'atividades', 'leads', 'imoveis']) {
    const r = (await q(`select column_name, is_nullable, data_type, column_default from information_schema.columns where table_name=$1 order by ordinal_position`, [t])).rows;
    console.log(`\n== ${t} ==`);
    for (const x of r) console.log(`  ${x.column_name} | ${x.is_nullable === 'NO' ? 'NOT NULL' : 'null'} | ${x.data_type}${x.column_default ? ' | def=' + x.column_default : ''}`);
  }
  const A = (await q(`select id from imobiliarias where slug='teste-a'`)).rows[0].id;
  console.log('\nteste-a leads:', JSON.stringify((await q(`select id, nome, status from leads where imobiliaria_id=$1`, [A])).rows));
  console.log('teste-a imoveis:', JSON.stringify((await q(`select id, codigo, titulo from imoveis where imobiliaria_id=$1`, [A])).rows));
  console.log('teste-a corretores:', JSON.stringify((await q(`select id, nome from usuarios where imobiliaria_id=$1 and perfil='corretor'`, [A])).rows));
  console.log('teste-a negocios atuais:', JSON.stringify((await q(`select id, lead_id, imovel_id, etapa_funil from negocios where imobiliaria_id=$1`, [A])).rows));
} catch (e) { console.error('ERRO:', e.message); }
finally { await c.end(); }
