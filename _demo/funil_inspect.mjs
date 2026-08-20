import './env.mjs';
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.DB_URL,ssl:false});const q=(s,p)=>c.query(s,p);
try{await c.connect();
 const rel=(await q(`select relkind from pg_class where relname='funil_negocios'`)).rows[0];
 console.log('funil_negocios relkind:',rel&&rel.relkind,'(r=tabela,v=view,m=matview)');
 console.log('distinct etapas:',JSON.stringify((await q(`select etapa,count(*)::int c from funil_negocios group by etapa order by c desc`)).rows));
 console.log('config table existe:',JSON.stringify((await q(`select table_name from information_schema.tables where table_name in ('funil_config','app_config','config','settings','kv_config')`)).rows));
 // enum de etapa?
 console.log('enum etapa:',JSON.stringify((await q(`select t.typname,e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typname ilike '%etapa%' order by e.enumsortorder`)).rows));
}catch(e){console.error('ERRO:',e.message);}finally{await c.end();}
