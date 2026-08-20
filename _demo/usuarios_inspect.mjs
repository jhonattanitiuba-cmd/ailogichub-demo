import './env.mjs';
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.DB_URL,ssl:false});
const q=(s,p)=>c.query(s,p);
try{await c.connect();
 console.log('== USUARIOS COLS ==');
 (await q(`select column_name,is_nullable,data_type,column_default from information_schema.columns where table_name='usuarios' order by ordinal_position`)).rows.forEach(x=>console.log(` ${x.column_name} | ${x.is_nullable==='NO'?'NN':'null'} | ${x.data_type}${x.column_default?' def='+x.column_default:''}`));
 console.log('\n== ENUM perfil (usuario_perfil?) ==');
 const en=(await q(`select t.typname,e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typname ilike '%perfil%' order by e.enumsortorder`)).rows;
 console.log(JSON.stringify(en));
 console.log('\n== distinct perfis em uso ==');
 console.log(JSON.stringify((await q(`select perfil::text,count(*) from usuarios group by perfil order by 2 desc`)).rows));
 console.log('\n== amostra corretor ==');
 console.log(JSON.stringify((await q(`select id,nome,email,perfil::text,imobiliaria_id from usuarios where perfil='corretor' limit 3`)).rows,null,0));
}catch(e){console.error('ERRO:',e.message);}finally{await c.end();}
