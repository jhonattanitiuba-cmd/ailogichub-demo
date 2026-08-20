import './env.mjs';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: false });
const q = (s, p) => c.query(s, p);
try {
  await c.connect();

  // negocio_advogado: nullability + count + constraints
  const na = (await q(`select column_name, is_nullable, data_type from information_schema.columns where table_name='negocio_advogado' order by 1`)).rows;
  console.log('negocio_advogado cols:', JSON.stringify(na));
  console.log('negocio_advogado count:', (await q('select count(*)::int n from negocio_advogado')).rows[0].n);
  const cons = (await q(`select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid='negocio_advogado'::regclass`)).rows;
  console.log('negocio_advogado constraints:', JSON.stringify(cons));

  // teste-a / teste-b ids
  const ims = (await q(`select id, slug, nome, plano from imobiliarias where slug in ('teste-a','teste-b')`)).rows;
  console.log('tenants demo:', JSON.stringify(ims));
  const A = ims.find(x => x.slug === 'teste-a');

  if (A) {
    for (const t of ['usuarios','leads','negocios','imoveis','funil_negocios','atividades','contratos']) {
      const n = (await q(`select count(*)::int n from ${t} where imobiliaria_id=$1`, [A.id])).rows[0].n;
      console.log(`  teste-a ${t}: ${n}`);
    }
    console.log('  teste-a usuarios:', JSON.stringify((await q(`select nome, email, perfil from usuarios where imobiliaria_id=$1 order by perfil`, [A.id])).rows));
    console.log('  teste-a negocios:', JSON.stringify((await q(`select id, etapa_funil, valor from negocios where imobiliaria_id=$1`, [A.id])).rows));
  }

  // funil_negocios por imobiliaria
  console.log('funil_negocios por imob:', JSON.stringify((await q(`select imobiliaria_id, count(*)::int n from funil_negocios group by 1`)).rows));
} catch (e) { console.error('ERRO:', e.message); }
finally { await c.end(); }
