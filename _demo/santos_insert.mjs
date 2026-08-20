import './env.mjs';
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.DB_URL,ssl:false});
const q=(s,p)=>c.query(s,p);
const IMOB='6aadadd0-97d2-45f2-b717-ffb0500bf905'; // Robotton Imoveis (parceiro ancora)
const fotos=[
 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1100&q=80&auto=format&fit=crop',
 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1100&q=80&auto=format&fit=crop',
 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=1100&q=80&auto=format&fit=crop',
 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1100&q=80&auto=format&fit=crop',
 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1100&q=80&auto=format&fit=crop'
];
const preco=2650000, area=152, quartos=3, suites=3, vagas=3, banheiros=4;
const titulo='Apartamento · Embaré, Santos';
const bairro='Embaré', cidade='Santos/SP';
const descricao='Alto padrão no Embaré, na altura do Canal 3, o melhor ponto de Santos. Vista para o mar, varanda gourmet, lazer completo e a poucos passos da praia.';
const extra={area,foto:fotos[0],fotos,tipo:'Apartamento',preco,vagas,bairro,cidade,codigo:'SAN-EMB-001',status:'Disponível',suites,titulo,quartos,banheiros,endereco:'Av. da Praia, altura do Canal 3',descricao,finalidade:'Venda',imobiliaria_id:IMOB};
try{await c.connect();
 const ex=(await q(`select id from imoveis where codigo='SAN-EMB-001'`)).rows[0];
 if(ex){console.log('ja existe, atualizando',ex.id);
  await q(`update imoveis set imobiliaria_id=$1,titulo=$2,tipo='apartamento',finalidade='venda',status='disponivel',preco=$3,area_util=$4,quartos=$5,suites=$6,banheiros=$7,vagas=$8,endereco=$9,bairro=$10,cidade=$11,uf='SP',descricao=$12,extra=$13,updated_at=now(),deleted_at=null where codigo='SAN-EMB-001'`,
   [IMOB,titulo,preco,area,quartos,suites,banheiros,vagas,'Av. da Praia, altura do Canal 3',bairro,cidade,descricao,extra]);
 } else {
  await q(`insert into imoveis(imobiliaria_id,codigo,titulo,tipo,finalidade,status,preco,area_util,quartos,suites,banheiros,vagas,endereco,bairro,cidade,uf,descricao,extra) values($1,'SAN-EMB-001',$2,'apartamento','venda','disponivel',$3,$4,$5,$6,$7,$8,$9,$10,$11,'SP',$12,$13)`,
   [IMOB,titulo,preco,area,quartos,suites,banheiros,vagas,'Av. da Praia, altura do Canal 3',bairro,cidade,descricao,extra]);
  console.log('inserido');
 }
 const r=(await q(`select codigo,titulo,bairro,cidade,preco,status::text,finalidade::text from imoveis where codigo='SAN-EMB-001'`)).rows[0];
 console.log('OK:',JSON.stringify(r));
}catch(e){console.error('ERRO:',e.message);}finally{await c.end();}
