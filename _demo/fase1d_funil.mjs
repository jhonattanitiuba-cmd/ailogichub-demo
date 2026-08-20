import './env.mjs';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DB_URL, ssl: false });
const q = (s, p) => c.query(s, p);
try {
  await c.connect();
  const A = (await q(`select id from imobiliarias where slug='teste-a'`)).rows[0].id;
  const nome = 'Nova Era Imoveis';
  const nCur = (await q(`select count(*)::int n from funil_negocios where imobiliaria_id=$1`, [A])).rows[0].n;
  if (nCur > 0) { console.log('funil_negocios de teste-a ja tem', nCur, '- pulando'); await c.end(); process.exit(0); }
  // etapa, lead, imovel_desc, codigo, corretor, valor, origem, sla, status_label, ultimo, motivo
  const cards = [
    ['novo', 'Carlos Souza', 'Apto Pinheiros locacao', 'A-APT-003', 'Corretor A1', 4500, 'WhatsApp', 'Dentro do SLA', 'Qualificar interesse', 'Ha 20min', null],
    ['qualif_ia', 'Marina Lima', 'Casa Alphaville condominio', 'A-CAS-002', 'Corretor A1', 1800000, 'Site', 'Dentro do SLA', 'Enviar apresentacao', 'Ha 1h', null],
    ['distribuido', 'Renata Alves', 'Apto Jardins 3 dorm', 'A-APT-001', 'Corretor A2', 1250000, 'Instagram', 'Atencao', 'Distribuir para corretor', 'Ha 2h', null],
    ['atendimento', 'Pedro Alves', 'Apto Jardins 3 dorm', 'A-APT-001', 'Corretor A2', 950000, 'WhatsApp', 'Dentro do SLA', 'Ligar hoje 16h', 'Ha 30min', null],
    ['visita', 'Bruno Dias', 'Casa Alphaville condominio', 'A-CAS-002', 'Corretor A1', 1800000, 'Portal', 'Atencao', 'Visita agendada', 'Ontem', null],
    ['proposta', 'Carlos Souza', 'Apto Pinheiros locacao', 'A-APT-003', 'Corretor A1', 4500, 'WhatsApp', 'Dentro do SLA', 'Proposta enviada', 'Ha 3h', null],
    ['documentacao', 'Fernanda Rocha', 'Apto Jardins 3 dorm', 'A-APT-001', 'Corretor A2', 1250000, 'Site', 'Dentro do SLA', 'Analise contrato', 'Hoje 10:00', null],
    ['fechado', 'Ana Rocha', 'Apto Jardins 3 dorm', 'A-APT-001', 'Corretor A1', 1250000, 'WhatsApp', 'Venda concluida', 'Pos-venda ativo', 'Ha 2 dias', null],
    ['perdido', 'Joao Prado', 'Casa Alphaville condominio', 'A-CAS-002', 'Corretor A2', 1800000, 'Portal', null, 'Aguardar retomada', 'Ha 5 dias', 'Comprou com concorrente'],
  ];
  let tent = 1;
  for (const [et, lead, desc, cod, cor, val, org, sla, st, ult, mot] of cards) {
    await q(`insert into funil_negocios (imobiliaria_id, imob_nome, lead_nome, imovel_desc, imovel_codigo, corretor_nome, valor, etapa, origem, tentativas, sla, status_label, ultimo_contato, motivo_perda)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [A, nome, lead, desc + ' Cod. ' + cod, cod, cor, val, et, org, (tent++ % 3) + 1, sla, st, ult, mot]);
  }
  console.log('FASE1d: +' + cards.length + ' cards no funil_negocios (teste-a), etapas:', cards.map(x => x[0]).join(', '));
} catch (e) { console.error('ERRO:', e.message); }
finally { try { await c.end(); } catch {} }
