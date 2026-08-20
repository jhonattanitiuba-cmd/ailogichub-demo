import './env.mjs';
const SB=process.env.SUPABASE_URL, ANON=process.env.SUPABASE_ANON_KEY, APP='https://ailogichub.app', PW='AiLogicHub@2026';
const tok=async e=>{try{const r=await fetch(`${SB}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:e,password:PW})});const j=await r.json();return j.access_token;}catch(_){return null;}};
const get=async(t,path)=>{try{const r=await fetch(APP+path,{headers:{Authorization:'Bearer '+t}});const j=await r.json().catch(()=>({}));return{s:r.status,j};}catch(e){return{s:'ERR',j:{}};}};
const perfis=['diretoria','gestor','comercial','comercial-rep','corretor','autonomo','juridico','financeiro','marketing','proprietario','anunciante','cliente'];
console.log('perfil'.padEnd(14),'| login | resumo | funil | leads | wa | leads#');
for(const p of perfis){
  const t=await tok(p+'@ailogichub.app');
  if(!t){console.log(p.padEnd(14),'| LOGIN FALHOU');continue;}
  const rz=await get(t,'/api/dash?action=resumo');
  const fu=await get(t,'/api/dash?action=funil');
  const ld=await get(t,'/api/data?ent=leads&action=list');
  const wa=await get(t,'/api/wa?action=chats');
  const nleads=(ld.j&&ld.j.rows&&ld.j.rows.length);
  console.log(p.padEnd(14),'| ok    |',String(rz.s).padEnd(6),'|',String(fu.s).padEnd(5),'|',String(ld.s).padEnd(5),'|',String(wa.s).padEnd(3),'|',nleads);
}
