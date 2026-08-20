import './env.mjs';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: false });
const q = (s, p) => c.query(s, p);
try {
  await c.connect();

  // 1) enum perfil_usuario: adicionar valores faltantes (cada um em autocommit, fora de transacao)
  const novos = ['comercial', 'financeiro', 'marketing', 'proprietario', 'anunciante', 'cliente'];
  for (const v of novos) {
    await q(`ALTER TYPE perfil_usuario ADD VALUE IF NOT EXISTS '${v}'`);
    console.log('enum +', v, 'ok');
  }
  const en = (await q(`select e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typname='perfil_usuario' order by e.enumsortorder`)).rows.map(r => r.enumlabel);
  console.log('enum perfil_usuario agora:', en.join(', '));

  // 2) negocio_advogado: renomear usuario_id -> advogado_id (codigo usa advogado_id). Tabela vazia -> seguro.
  const hasUsuario = (await q(`select 1 from information_schema.columns where table_name='negocio_advogado' and column_name='usuario_id'`)).rowCount > 0;
  const hasAdv = (await q(`select 1 from information_schema.columns where table_name='negocio_advogado' and column_name='advogado_id'`)).rowCount > 0;
  if (hasUsuario && !hasAdv) {
    // ver policies dependentes (informativo)
    const pol = (await q(`select policyname, qual, with_check from pg_policies where tablename='negocio_advogado'`)).rows;
    console.log('policies em negocio_advogado:', JSON.stringify(pol));
    await q(`ALTER TABLE negocio_advogado RENAME COLUMN usuario_id TO advogado_id`);
    console.log('RENAME usuario_id -> advogado_id OK');
  } else {
    console.log('negocio_advogado: rename nao necessario (advogado_id existe?', hasAdv, ')');
  }
  const cols = (await q(`select column_name from information_schema.columns where table_name='negocio_advogado' order by 1`)).rows.map(r => r.column_name);
  console.log('negocio_advogado cols agora:', cols.join(', '));
} catch (e) { console.error('ERRO:', e.message); }
finally { await c.end(); }
