import './env.mjs';
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.DB_URL,ssl:false});
const q=(s,p)=>c.query(s,p);
try{await c.connect();
 const cols=(await q(`select column_name,is_nullable,data_type,column_default from information_schema.columns where table_name='imoveis' order by ordinal_position`)).rows;
 console.log('== IMOVEIS COLS =='); cols.forEach(x=>console.log(` ${x.column_name} | ${x.is_nullable==='NO'?'NOTNULL':'null'} | ${x.data_type}${x.column_default?' def='+x.column_default:''}`));
 console.log('\n== IMOBILIARIAS =='); console.log(JSON.stringify((await q(`select id,nome,slug from imobiliarias order by nome`)).rows,null,0));
 console.log('\n== SAMPLE IMOVEL (com extra) =='); console.log(JSON.stringify((await q(`select codigo,titulo,tipo,finalidade,status,preco,bairro,cidade,extra from imoveis where extra is not null limit 1`)).rows[0]||{},null,0));
 console.log('\n== enum status vals =='); console.log(JSON.stringify((await q(`select distinct status::text from imoveis`)).rows.map(r=>r.status)));
 console.log('== enum finalidade vals =='); console.log(JSON.stringify((await q(`select distinct finalidade::text from imoveis`)).rows.map(r=>r.finalidade)));
}catch(e){console.error('ERRO:',e.message);}finally{await c.end();}
