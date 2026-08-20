import './env.mjs';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: false });
const q = (s, p) => c.query(s, p);
try {
  await c.connect();
  const cols = (await q(`select column_name, is_nullable, data_type, column_default from information_schema.columns where table_name='funil_negocios' order by ordinal_position`)).rows;
  console.log('funil_negocios cols:'); cols.forEach(x => console.log(`  ${x.column_name} | ${x.is_nullable === 'NO' ? 'NOT NULL' : 'null'} | ${x.data_type}${x.column_default ? ' def=' + x.column_default : ''}`));
  console.log('\ndistinct etapa:', JSON.stringify((await q(`select etapa, count(*)::int n from funil_negocios group by 1 order by 2 desc`)).rows));
  console.log('distinct sla:', JSON.stringify((await q(`select distinct sla from funil_negocios`)).rows.map(r => r.sla)));
  console.log('distinct origem:', JSON.stringify((await q(`select distinct origem from funil_negocios`)).rows.map(r => r.origem)));
  console.log('distinct status_label:', JSON.stringify((await q(`select distinct status_label from funil_negocios`)).rows.map(r => r.status_label)));
  console.log('\namostra 2 cards:', JSON.stringify((await q(`select * from funil_negocios limit 2`)).rows));
} catch (e) { console.error('ERRO:', e.message); }
finally { await c.end(); }
