import './env.mjs';
import pg from 'pg';

const DB = process.env.DB_URL, SB = process.env.SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SENHA = 'AiLogicHub@2026';
const c = new pg.Client({ connectionString: DB, ssl: false });
const q = (s, p) => c.query(s, p);

// ---- Supabase Admin API ----
async function authCreateOrReset(email, nome, perfil) {
  const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
  let r = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password: SENHA, email_confirm: true, user_metadata: { nome, perfil } }) });
  let t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
  if (r.ok && j.id) return j.id;
  if (/already|exists|registered|duplicate|been/i.test(t)) {
    const g = await fetch(`${SB}/auth/v1/admin/users?per_page=500&email=${encodeURIComponent(email)}`, { headers: H });
    const gj = await g.json();
    const list = Array.isArray(gj) ? gj : (gj.users || []);
    const u = list.find(x => (x.email || '').toLowerCase() === email.toLowerCase());
    if (u && u.id) { await fetch(`${SB}/auth/v1/admin/users/${u.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ password: SENHA, email_confirm: true, user_metadata: { nome, perfil } }) }); return u.id; }
    console.log('  GET nao achou email exato', email, 'lista=', list.length);
  }
  console.log('  AUTH FALHOU', email, r.status, t.slice(0, 160)); return null;
}

try {
  await c.connect();
  const A = (await q(`select id from imobiliarias where slug='teste-a'`)).rows[0].id;
  const B = (await q(`select id from imobiliarias where slug='teste-b'`)).rows[0].id;

  // ===== FASE 1a: nomes realistas (mantem slug) =====
  await q(`update imobiliarias set nome='Nova Era Imoveis', razao_social='Nova Era Negocios Imobiliarios LTDA' where id=$1`, [A]);
  await q(`update imobiliarias set nome='Central Imoveis', razao_social='Central Imoveis LTDA' where id=$1`, [B]);
  console.log('FASE1a: imobiliarias renomeadas');

  // ===== FASE 1b: enriquecer negocios (funil cheio) =====
  const L = {}; (await q(`select id, nome from leads where imobiliaria_id=$1`, [A])).rows.forEach(r => L[r.nome] = r.id);
  const IM = {}; (await q(`select id, codigo from imoveis where imobiliaria_id=$1`, [A])).rows.forEach(r => IM[r.codigo] = r.id);
  const CO = (await q(`select id from usuarios where imobiliaria_id=$1 and perfil='corretor' order by nome`, [A])).rows.map(r => r.id);
  const A1 = CO[0], A2 = CO[1] || CO[0];
  const nCur = (await q(`select count(*)::int n from negocios where imobiliaria_id=$1 and deleted_at is null`, [A])).rows[0].n;
  if (nCur < 7) {
    const novos = [
      ['LEAD', null, IM['A-CAS-002'], A1, 2400000],
      ['CONTATO', L['Marina Lima'], IM['A-CAS-002'], A1, 1800000],
      ['VISITA', L['Pedro Alves'], IM['A-APT-001'], A2, 950000],
      ['NEGOCIACAO', L['Bruno Dias'], IM['A-APT-003'], A2, 890000],
      ['FECHAMENTO', null, IM['A-APT-001'], A1, 1250000],
    ];
    for (const [et, lead, imv, resp, val] of novos) {
      await q(`insert into negocios (imobiliaria_id, lead_id, imovel_id, responsavel_id, etapa_funil, valor, comissao)
               values ($1,$2,$3,$4,$5::negocio_etapa,$6,$7)`, [A, lead, imv, resp, et, val, Math.round(val * 0.05)]);
    }
    console.log('FASE1b: +' + novos.length + ' negocios (funil completo)');
  } else console.log('FASE1b: negocios ja enriquecidos (' + nCur + '), pulando');

  // ===== FASE 1c: agenda (atividades) =====
  const nAt = (await q(`select count(*)::int n from atividades where imobiliaria_id=$1`, [A])).rows[0].n;
  if (nAt === 0) {
    const ats = [
      [L['Pedro Alves'], A2, 'Visita ao Apartamento Jardins', 'visita', "now() + interval '1 day'", false],
      [L['Marina Lima'], A1, 'Retorno da proposta Casa Alphaville', 'followup', "now() + interval '3 hours'", false],
      [L['Carlos Souza'], A2, 'Ligacao de qualificacao', 'ligacao', "now() - interval '2 hours'", true],
      [null, A1, 'Alinhamento comercial da semana', 'reuniao', "now() + interval '2 days'", false],
    ];
    for (const [lead, resp, tit, tipo, quando, done] of ats) {
      await q(`insert into atividades (imobiliaria_id, lead_id, responsavel_id, titulo, tipo, inicio, concluida)
               values ($1,$2,$3,$4,$5, ${quando}, $6)`, [A, lead, resp, tit, tipo, done]);
    }
    console.log('FASE1c: +' + ats.length + ' atividades (agenda)');
  } else console.log('FASE1c: agenda ja tem ' + nAt + ', pulando');

  // ===== FASE 2: 12 usuarios demo (usuarios row + Auth) =====
  const USERS = [
    ['diretoria@ailogichub.app', 'Diretoria (Alessandro)', 'diretoria', 'Diretoria', null],
    ['gestor@ailogichub.app', 'Gestor da Imobiliaria', 'gestor', 'Gestor', A],
    ['comercial@ailogichub.app', 'Comercial Interno', 'comercial', 'Comercial interno', A],
    ['comercial-rep@ailogichub.app', 'Comercial Representante', 'comercial', 'Comercial representante', A],
    ['corretor@ailogichub.app', 'Corretor', 'corretor', 'Corretor', A],
    ['autonomo@ailogichub.app', 'Corretor Autonomo', 'parceiro', 'Corretor autonomo', A],
    ['juridico@ailogichub.app', 'Juridico', 'advogado', 'Juridico', A],
    ['financeiro@ailogichub.app', 'Financeiro', 'financeiro', 'Financeiro', A],
    ['marketing@ailogichub.app', 'Marketing', 'marketing', 'Marketing', A],
    ['proprietario@ailogichub.app', 'Proprietario', 'proprietario', 'Proprietario', A],
    ['anunciante@ailogichub.app', 'Anunciante', 'anunciante', 'Anunciante', A],
    ['cliente@ailogichub.app', 'Cliente', 'cliente', 'Cliente', A],
  ];
  // limpa vinculos auth dos e-mails demo antes de reatribuir (evita colisao de auth_user_id em rerun)
  const demoEmails = USERS.map(u => u[0].toLowerCase());
  await q(`update usuarios set auth_user_id=null where lower(email) = any($1)`, [demoEmails]);
  const feitos = [];
  for (const [email, nome, perfilEnum, perfilLabel, imob] of USERS) {
    // upsert linha usuarios por email
    const up = await q(`update usuarios set nome=$2, perfil=$3::perfil_usuario, imobiliaria_id=$4, ativo=true, deleted_at=null where lower(email)=lower($1)`, [email, nome, perfilEnum, imob]);
    if (up.rowCount === 0) {
      await q(`insert into usuarios (imobiliaria_id, nome, email, perfil, ativo) values ($1,$2,$3,$4::perfil_usuario,true)`, [imob, nome, email, perfilEnum]);
    }
    // Auth (metadata.perfil = label bonito; para juridico o label 'Juridico' e reconhecido pelo restrictMenu)
    const authId = await authCreateOrReset(email, nome, perfilLabel);
    if (authId) {
      // libera esse auth_user_id de qualquer linha legada (ex.: persona .com.br) antes de vincular a linha .app
      await q(`update usuarios set auth_user_id=null where auth_user_id=$1 and lower(email)<>lower($2)`, [authId, email]);
      await q(`update usuarios set auth_user_id=$1 where lower(email)=lower($2)`, [authId, email]);
    }
    const uid = (await q(`select id from usuarios where lower(email)=lower($1)`, [email])).rows[0].id;
    feitos.push({ email, perfil: perfilEnum, imob: imob ? 'teste-a' : 'ALL(admin)', auth: !!authId, usuarioId: uid });
    console.log('  user', email, '->', perfilEnum, authId ? 'AUTH ok' : 'AUTH FALHOU');
  }

  // ===== FASE 2b: vincular Juridico a negocios de teste-a =====
  const jurId = feitos.find(f => f.email === 'juridico@ailogichub.app').usuarioId;
  const negs = (await q(`select id from negocios where imobiliaria_id=$1 and etapa_funil in ('PROPOSTA','GANHO','NEGOCIACAO') and deleted_at is null limit 3`, [A])).rows;
  for (const n of negs) {
    await q(`insert into negocio_advogado (negocio_id, advogado_id, imobiliaria_id, vinculado_em, ativo, honorario_pct)
             values ($1,$2,$3, now(), true, 5)
             on conflict (negocio_id, advogado_id) do nothing`, [n.id, jurId, A]);
  }
  console.log('FASE2b: juridico vinculado a ' + negs.length + ' negocios');

  console.log('\n=== RESUMO ===');
  console.log(JSON.stringify(feitos, null, 0));
  console.log('SENHA PADRAO:', SENHA);
} catch (e) { console.error('ERRO:', e.message, e.stack); }
finally { await c.end(); }
