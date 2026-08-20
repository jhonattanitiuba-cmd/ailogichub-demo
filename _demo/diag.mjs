import './env.mjs';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: false });
const q = (s, p) => c.query(s, p);
const colExists = async (t, col) => (await q(
  `select 1 from information_schema.columns where table_name=$1 and column_name=$2`, [t, col])).rowCount > 0;
const tableExists = async (t) => (await q(
  `select 1 from information_schema.tables where table_name=$1`, [t])).rowCount > 0;

try {
  await c.connect();
  const one = await q('select 1 as ok');
  console.log('CONN OK ->', one.rows[0].ok);

  // Risco (a): coluna real de negocio_advogado
  if (await tableExists('negocio_advogado')) {
    const cols = (await q(`select column_name from information_schema.columns where table_name='negocio_advogado' order by 1`)).rows.map(r => r.column_name);
    console.log('negocio_advogado colunas:', cols.join(', '));
    console.log('  -> tem advogado_id?', cols.includes('advogado_id'), '| tem usuario_id?', cols.includes('usuario_id'));
  } else console.log('negocio_advogado: TABELA NAO EXISTE');

  // Risco (b): usuarios.extra / usuarios.creci
  console.log('usuarios.extra existe?', await colExists('usuarios', 'extra'));
  console.log('usuarios.creci existe?', await colExists('usuarios', 'creci'));
  const ucols = (await q(`select column_name from information_schema.columns where table_name='usuarios' order by 1`)).rows.map(r => r.column_name);
  console.log('usuarios colunas:', ucols.join(', '));

  // Risco (c): funil_negocios vazio?
  if (await tableExists('funil_negocios')) {
    const n = (await q('select count(*)::int n from funil_negocios')).rows[0].n;
    console.log('funil_negocios linhas:', n);
  } else console.log('funil_negocios: TABELA NAO EXISTE');

  // enum perfil_usuario valores atuais
  const en = (await q(`select e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typname='perfil_usuario' order by e.enumsortorder`)).rows.map(r => r.enumlabel);
  console.log('enum perfil_usuario:', en.join(', '));

  // contagens base
  for (const t of ['imobiliarias','usuarios','leads','negocios','imoveis','conversas_whatsapp','mensagens','atividades','contratos','canais_whatsapp']) {
    if (await tableExists(t)) {
      const n = (await q(`select count(*)::int n from ${t}`)).rows[0].n;
      console.log(`  ${t}: ${n}`);
    } else console.log(`  ${t}: (sem tabela)`);
  }

  // imobiliarias existentes (slug/nome)
  const ims = (await q(`select slug, nome, plano from imobiliarias order by created_at nulls last limit 20`)).rows;
  console.log('imobiliarias:', JSON.stringify(ims));
} catch (e) {
  console.error('ERRO:', e.message);
} finally {
  await c.end();
}
