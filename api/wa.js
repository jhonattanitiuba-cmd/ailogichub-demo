// AILOGIC HUB — Backend do canal WhatsApp (Serverless Vercel)
// Espelha o WhatsApp do Hub DENTRO da plataforma (sem Chatwoot).
// Fala com o Evolution server-side e grava estado no Supabase.
// Segredos via env vars da Vercel — nunca no repo.
//   EVO_BASE, EVO_KEY, WA_INSTANCE, DB_URL
const { db } = require('./_db');
const { requireAuth, departamentoDe: deptDe, isLawyerRole } = require('./_auth');
// jids que um advogado pode ver = conversas dos clientes dos negócios atribuídos a ele
async function jidsDoAdvogado(usuarioId) {
  try {
    const r = await db(`select distinct a.remote_jid, l.telefone from negocio_advogado na
      join negocios n on n.id=na.negocio_id
      join leads l on l.id=n.lead_id
      left join ia_atendimento a on a.lead_id=l.id
      where na.advogado_id=$1`, [usuarioId]);
    const jids = {}, fones = {};
    (r.rows || []).forEach(x => { if (x.remote_jid) jids[x.remote_jid] = 1; if (x.telefone) { const f = String(x.telefone).replace(/\D/g, '').slice(-8); if (f) fones[f] = 1; } });
    return { jids, fones };
  } catch (_) { return { jids: {}, fones: {} }; }
}
function jidPermitido(jid, allow) { if (allow.jids[jid]) return true; const f = String(jid || '').split('@')[0].replace(/\D/g, '').slice(-8); return !!(f && allow.fones[f]); }
const { cacheGet, cacheSet } = require('./_cache');

const EVO_BASE = (process.env.EVO_BASE || '').replace(/\/$/, '');
const EVO_KEY  = process.env.EVO_KEY || '';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';
const DB_URL   = process.env.DB_URL || '';

// MODO TESTE: espelhar apenas estes números (Jhonattan + Alessandro).
// Compara pelos últimos 8 dígitos (tolerante ao 9º dígito do celular BR).
const ALLOW8 = ['5511991612610', '5511995568148'].map(n => n.slice(-8));
const NAMES = { '91612610': 'Jhonattan (Brava)', '95568148': 'Alessandro Ferreira' };
function num8(jid) { return String(jid || '').split('@')[0].replace(/\D/g, '').slice(-8); }
function allowedJid(jid) { return ALLOW8.indexOf(num8(jid)) >= 0; }

// cache de contatos (60s) — usado para unificar telefone + @lid da mesma pessoa
let _contatos = { ts: 0, map: {}, all: [] };
async function getContatos() {
  if (Date.now() - _contatos.ts < 60000 && _contatos.all.length) return _contatos;   // 1) memória (instância quente)
  try {
    const hit = await cacheGet('wa:contatos:' + INSTANCE);   // 2) Redis (compartilha entre instâncias frias)
    if (hit && hit.all && hit.all.length) { _contatos = { ts: Date.now(), map: hit.map, all: hit.all }; return _contatos; }
  } catch (_) {}
  try {
    const cr = await evo('/chat/findContacts/' + INSTANCE, 'POST', {});   // 3) Evolution (fonte)
    const all = Array.isArray(cr.body) ? cr.body : [];
    const map = {}; all.forEach(c => { if (c.remoteJid && c.pushName) map[c.remoteJid] = c.pushName; });
    _contatos = { ts: Date.now(), map, all };
    try { cacheSet('wa:contatos:' + INSTANCE, { map, all }, 60); } catch (_) {}
  } catch (_) {}
  return _contatos;
}
// jids "irmaos" da mesma pessoa (telefone + @lid) via pushName igual
function jidsIrmaos(jid, ct) {
  const out = [jid];
  const myPush = ct.map[jid];
  if (myPush) (ct.all || []).forEach(c => {
    if (c.remoteJid && c.remoteJid !== jid && c.pushName === myPush &&
        (String(c.remoteJid).endsWith('@lid') || String(c.remoteJid).endsWith('@s.whatsapp.net'))) out.push(c.remoteJid);
  });
  return out;
}

async function evo(path, method = 'GET', body) {
  const r = await fetch(EVO_BASE + path, {
    method,
    headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch (_) { j = { raw: t }; }
  return { ok: r.ok, status: r.status, body: j };
}

// corte de espelhamento: inbox só mostra conversas a partir desta data
async function getCutoff() {
  try { const r = await db('select espelho_desde from canais_whatsapp where instancia=$1', [INSTANCE]);
    return r.rows[0] && r.rows[0].espelho_desde ? new Date(r.rows[0].espelho_desde) : null; }
  catch (_) { return null; }
}

// extrai texto legível de qualquer tipo de mensagem do WhatsApp
function msgText(rec) {
  const M = (rec && rec.message) || {};
  if (M.conversation) return M.conversation;
  if (M.extendedTextMessage && M.extendedTextMessage.text) return M.extendedTextMessage.text;
  if (M.imageMessage) return '[imagem] ' + (M.imageMessage.caption || '');
  if (M.videoMessage) return '[vídeo] ' + (M.videoMessage.caption || '');
  if (M.audioMessage) return '[áudio]';
  if (M.documentMessage) return '[documento] ' + (M.documentMessage.fileName || '');
  if (M.stickerMessage) return '[figurinha]';
  if (M.locationMessage) return '[localização]';
  if (M.contactMessage) return '[contato]';
  return '[mensagem]';
}

// status de entrega/leitura (ticks) — o Evolution guarda os acks em MessageUpdate (array).
// retorna: -1 erro, 0 relogio(pendente), 1 enviado(1 tick), 2 entregue(2 ticks), 3 lido(2 azuis).
function ackDe(m) {
  const ORD = { PENDING: 0, SERVER_ACK: 1, DELIVERY_ACK: 2, READ: 3, PLAYED: 3 };
  const ups = (m && m.MessageUpdate) || [];
  if (Array.isArray(ups) && ups.some(u => String(u && u.status).toUpperCase() === 'ERROR')) return -1;
  let best = 1;
  if (Array.isArray(ups) && ups.length) {
    best = 0;
    ups.forEach(u => { const v = ORD[String(u && u.status).toUpperCase()]; if (typeof v === 'number' && v > best) best = v; });
  } else if (m && m.status) {
    const v = ORD[String(m.status).toUpperCase()]; if (typeof v === 'number') best = v;
  }
  return best;
}
// info de midia (imagem/audio/video/documento/figurinha) para renderizar no thread
function mediaInfo(rec) {
  const M = (rec && rec.message) || {};
  if (M.imageMessage) return { media: 'image', mime: M.imageMessage.mimetype || 'image/jpeg', caption: M.imageMessage.caption || '' };
  if (M.stickerMessage) return { media: 'sticker', mime: M.stickerMessage.mimetype || 'image/webp' };
  if (M.audioMessage) return { media: 'audio', mime: M.audioMessage.mimetype || 'audio/ogg', ptt: !!M.audioMessage.ptt };
  if (M.videoMessage) return { media: 'video', mime: M.videoMessage.mimetype || 'video/mp4', caption: M.videoMessage.caption || '' };
  if (M.documentMessage) return { media: 'document', mime: M.documentMessage.mimetype || '', fileName: M.documentMessage.fileName || 'arquivo' };
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || 'status';
  try {
    const user = await requireAuth(req, res); if (!user) return;
    if (!EVO_BASE || !EVO_KEY || !DB_URL) {
      res.status(500).json({ error: 'backend nao configurado (faltam env vars)' });
      return;
    }

    // ---- CONECTAR ----
    if (action === 'connect') {
      const r = await evo('/instance/connect/' + INSTANCE);
      const qr = (r.body && (r.body.base64 || (r.body.qrcode && r.body.qrcode.base64))) || null;
      await db(`update canais_whatsapp set status='aguardando_qr', ultimo_evento=$1, updated_at=now() where instancia=$2`,
        [JSON.stringify(r.body), INSTANCE]);
      res.status(200).json({ status: 'aguardando_qr', qr, pairingCode: (r.body && r.body.pairingCode) || null });
      return;
    }

    // ---- DESCONECTAR ----
    if (action === 'disconnect') {
      const r = await evo('/instance/logout/' + INSTANCE, 'DELETE');
      await db(`update canais_whatsapp set status='desconectado', desconectado_em=now(), updated_at=now() where instancia=$1`, [INSTANCE]);
      res.status(200).json({ status: 'desconectado', ok: r.ok });
      return;
    }

    // ---- ZERAR espelho (passa a mostrar só daqui pra frente) ----
    if (action === 'zerar') {
      await db(`update canais_whatsapp set espelho_desde=now(), updated_at=now() where instancia=$1`, [INSTANCE]);
      res.status(200).json({ ok: true, zerado: true });
      return;
    }

    // ---- CONFIG DA IA: ler ----
    if (action === 'config') {
      const r = await db('select ia_ativa, ia_persona, ia_allowlist, ia_tools from canais_whatsapp where instancia=$1', [INSTANCE]);
      res.status(200).json(r.rows[0] || {});
      return;
    }
    // ---- CONFIG DA IA: salvar (persona/ativa/tools) ----
    if (action === 'config-save') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      b = b || {};
      await db(`update canais_whatsapp set
          ia_ativa = coalesce($1, ia_ativa),
          ia_persona = coalesce($2, ia_persona),
          ia_tools = coalesce($3::jsonb, ia_tools),
          updated_at = now()
        where instancia=$4`,
        [typeof b.ia_ativa === 'boolean' ? b.ia_ativa : null, (b.ia_persona != null ? String(b.ia_persona) : null), (b.ia_tools != null ? JSON.stringify(b.ia_tools) : null), INSTANCE]);
      res.status(200).json({ ok: true });
      return;
    }
    // ---- LIMPAR CONTEXTO da IA numa conversa (o agente esquece e recomeca) ----
    if (action === 'limpar-contexto') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      b = b || {}; const jid = b.jid;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      let n = 0;
      try { const dr = await db('delete from ia_historico where remote_jid=$1', [jid]); n = dr.rowCount || 0; } catch (_) {}
      res.status(200).json({ ok: true, apagadas: n });
      return;
    }

    // ---- LISTA DE CONVERSAS (espelho) ----
    if (action === 'chats') {
      // as 4 operações são independentes -> em paralelo (era serial: cutoff->findChats->contatos->estado)
      const estado = {};
      const [cutoff, r, contatos, er] = await Promise.all([
        getCutoff(),
        evo('/chat/findChats/' + INSTANCE, 'POST', {}),
        getContatos(),
        db(`select a.remote_jid, a.atendente_id, a.ia_pausada, a.nao_lidas, u.nome atendente_nome
            from ia_atendimento a left join usuarios u on u.id = a.atendente_id`).catch(function () { return { rows: [] }; })
      ]);
      const arr = Array.isArray(r.body) ? r.body : [];
      const pushByJid = contatos.map;   // pushName por jid p/ unificar telefone + @lid
      (er.rows || []).forEach(x => { estado[x.remote_jid] = x; });
      let chats = arr.map(c => {
        const st = estado[c.remoteJid] || {};
        const push = pushByJid[c.remoteJid] || c.pushName || '';
        return {
          jid: c.remoteJid,
          nome: NAMES[num8(c.remoteJid)] || push || (c.remoteJid ? String(c.remoteJid).split('@')[0] : 'Contato'),
          pkey: (push ? push.trim().toLowerCase() : num8(c.remoteJid)),   // chave de dedupe (pessoa)
          foto: c.profilePicUrl || null,
          atualizado: c.updatedAt || null,
          janelaAtiva: !!c.windowActive,
          grupo: String(c.remoteJid || '').endsWith('@g.us'),
          lid: String(c.remoteJid || '').endsWith('@lid'),
          ultima: c.lastMessage ? msgText(c.lastMessage) : '',
          fromMe: !!(c.lastMessage && c.lastMessage.key && c.lastMessage.key.fromMe),
          atendenteId: st.atendente_id || null,
          atendenteNome: st.atendente_nome || null,
          iaPausada: !!st.ia_pausada,
          naoLidas: st.nao_lidas || 0
        };
      }).filter(c => c.jid && !c.grupo && num8(c.jid) !== '' && !/^0+@/.test(c.jid))   // sem grupos/invalidos
        .sort((a, b) => new Date(b.atualizado || 0) - new Date(a.atualizado || 0));
      // UNIFICA: o WhatsApp cria um jid @lid alem do telefone real (@s.whatsapp.net) para a mesma
      // pessoa. Mantem o telefone real; descarta o gemeo @lid (mesmo pkey de um chat de telefone).
      const phoneKeys = {};
      chats.forEach(c => { if (!c.lid && c.pkey) phoneKeys[c.pkey] = true; });
      chats = chats.filter(c => !(c.lid && c.pkey && phoneKeys[c.pkey]));
      if (cutoff) chats = chats.filter(c => c.atualizado && new Date(c.atualizado) >= cutoff);
      // ADVOGADO: só vê a conversa do(s) cliente(s) dos casos dele, e com telefone confidencial
      if (isLawyerRole(user.perfil) && !user.isAdmin) {
        const allow = await jidsDoAdvogado(user.usuarioId);
        chats = chats.filter(c => jidPermitido(c.jid, allow)).map(c => Object.assign({}, c, { fone: null, confidencial: true }));
      }
      res.status(200).json({ chats, meuId: user.usuarioId || null, meuNome: user.nome || null, confidencial: isLawyerRole(user.perfil) && !user.isAdmin });
      return;
    }

    // ---- ATENDIMENTO: assumir (pausa IA + atribui) ----
    if (action === 'assign') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      b = b || {}; const jid = b.jid; const alvo = b.atendenteId || user.usuarioId;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      await db(`insert into ia_atendimento (remote_jid, atendente_id, ia_pausada, atualizado_em) values ($1,$2,true,now())
        on conflict (remote_jid) do update set atendente_id=$2, ia_pausada=true, atualizado_em=now()`, [jid, alvo]);
      res.status(200).json({ ok: true, atendenteId: alvo, iaPausada: true });
      return;
    }
    // ---- ATENDIMENTO: pausar/retomar IA por conversa ----
    if (action === 'ia') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      b = b || {}; const jid = b.jid; const pausada = !!b.pausada;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      if (pausada) {
        await db(`insert into ia_atendimento (remote_jid, ia_pausada, atendente_id, atualizado_em) values ($1,true,$2,now())
          on conflict (remote_jid) do update set ia_pausada=true, atendente_id=coalesce(ia_atendimento.atendente_id,$2), atualizado_em=now()`, [jid, user.usuarioId]);
      } else {
        // retomar IA: limpa atendente e devolve a conversa para o robo
        await db(`insert into ia_atendimento (remote_jid, ia_pausada, atendente_id, atualizado_em) values ($1,false,null,now())
          on conflict (remote_jid) do update set ia_pausada=false, atendente_id=null, atualizado_em=now()`, [jid]);
      }
      res.status(200).json({ ok: true, iaPausada: pausada });
      return;
    }
    // ---- ATENDIMENTO: marcar conversa como lida ----
    if (action === 'read') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      b = b || {}; const jid = b.jid;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      await db(`insert into ia_atendimento (remote_jid, nao_lidas, ultimo_lido_em, atualizado_em) values ($1,0,now(),now())
        on conflict (remote_jid) do update set nao_lidas=0, ultimo_lido_em=now()`, [jid]);
      res.status(200).json({ ok: true });
      return;
    }
    // ---- quem sou eu (para o filtro "Minhas") + lista de usuarios (transferencia) ----
    if (action === 'me') {
      let equipe = [];
      try {
        const eq = await db(`select id, nome, perfil, extra from usuarios where deleted_at is null and ativo is not false order by nome`);
        equipe = (eq.rows || []).map(u => ({ id: u.id, nome: u.nome, perfil: u.perfil, departamento: deptDe(u.perfil, u.extra), foto: (u.extra && u.extra.foto) || null, icone: (u.extra && u.extra.icone) || null }));
      } catch (_) {}
      res.status(200).json({ id: user.usuarioId || null, nome: user.nome || null, email: user.email || null, perfil: user.perfil || null, departamento: user.departamento || null, isAdmin: !!user.isAdmin, equipe });
      return;
    }

    // ---- CRM: lead vinculado + sugestao por telefone (ultimos 8 digitos) ----
    if (action === 'crm') {
      const jid = req.query && req.query.jid;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      const fone8 = num8(jid);
      let lead = null, sugestao = null;
      const at = (await db('select lead_id from ia_atendimento where remote_jid=$1', [jid])).rows[0];
      if (at && at.lead_id) {
        lead = (await db('select id,nome,telefone,email,status,interesse,ultimo_contato from leads where id=$1 and deleted_at is null', [at.lead_id])).rows[0] || null;
      }
      if (!lead && fone8) {
        sugestao = (await db(`select id,nome,telefone,status from leads where deleted_at is null and right(regexp_replace(coalesce(telefone,''),'\\D','','g'),8)=$1 order by created_at limit 1`, [fone8])).rows[0] || null;
      }
      res.status(200).json({ lead, sugestao, stages: ['NOVO','QUALIFICADO','EM_ATENDIMENTO','GANHO','PERDIDO','DESCARTADO'] });
      return;
    }
    // ---- CRM: vincular conversa a um lead (ou desvincular com leadId null) ----
    if (action === 'vincular') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      b = b || {}; const jid = b.jid, leadId = b.leadId || null;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      await db(`insert into ia_atendimento (remote_jid, lead_id, atualizado_em) values ($1,$2,now())
        on conflict (remote_jid) do update set lead_id=$2, atualizado_em=now()`, [jid, leadId]);
      res.status(200).json({ ok: true, leadId });
      return;
    }
    // ---- CRM: mudar etapa/status do lead (pipeline clicavel) ----
    if (action === 'stage') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      b = b || {}; const leadId = b.leadId, status = b.status;
      if (!leadId || !status) { res.status(400).json({ error: 'leadId e status obrigatorios' }); return; }
      try { await db('update leads set status=$1::lead_status, ultimo_contato=now(), updated_at=now() where id=$2', [status, leadId]); }
      catch (e) { res.status(400).json({ error: 'status invalido' }); return; }
      res.status(200).json({ ok: true, status });
      return;
    }

    // ---- MENSAGENS DE UMA CONVERSA ----
    if (action === 'messages') {
      const jid = req.query && req.query.jid;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      // ADVOGADO só abre a conversa do próprio caso
      if (isLawyerRole(user.perfil) && !user.isAdmin) {
        const allow = await jidsDoAdvogado(user.usuarioId);
        if (!jidPermitido(jid, allow)) { res.status(403).json({ error: 'conversa fora do seu escopo' }); return; }
      }
      // cutoff + contatos em paralelo (independentes)
      const [cutoff, ct] = await Promise.all([getCutoff(), getContatos()]);
      // MESCLA os dois lados: o WhatsApp guarda as RECEBIDAS sob @lid e as ENVIADAS sob o telefone
      // (mesma pessoa) — junta as mensagens dos jids irmaos para o thread ficar espelhado.
      const irmaos = jidsIrmaos(jid, ct);
      // busca as mensagens dos jids irmãos EM PARALELO (era loop serial)
      const results = await Promise.all(irmaos.map(function (j) {
        return evo('/chat/findMessages/' + INSTANCE, 'POST', { where: { key: { remoteJid: j } }, limit: 60 })
          .then(function (rr) { return (rr.body && rr.body.messages && rr.body.messages.records) || []; })
          .catch(function () { return []; });
      }));
      let recs = [].concat.apply([], results);
      const _seen = {};
      recs = recs.filter(m => { const id = m.key && m.key.id; if (!id) return true; if (_seen[id]) return false; _seen[id] = 1; return true; });
      let msgs = recs.map(m => {
        const mi = mediaInfo(m);
        return {
          id: m.key && m.key.id,
          fromMe: !!(m.key && m.key.fromMe),
          texto: msgText(m),
          tipo: m.messageType,
          ack: ackDe(m),                          // ticks reais (ver ackDe)
          media: mi ? mi.media : null,            // image|audio|video|document|sticker|null
          mime: mi ? mi.mime : null,
          fileName: mi ? (mi.fileName || null) : null,
          ptt: mi ? !!mi.ptt : false,
          ts: m.messageTimestamp ? Number(m.messageTimestamp) : null,
          autor: m.pushName || null
        };
      }).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (cutoff) { const c = cutoff.getTime(); msgs = msgs.filter(m => m.ts && m.ts * 1000 >= c); }
      res.status(200).json({ jid, msgs });
      return;
    }

    // ---- MIDIA de uma mensagem (base64 -> data URL) para espelhar imagem/audio/etc ----
    if (action === 'media') {
      const jid = req.query && req.query.jid;
      const id = req.query && req.query.id;
      const fromMe = String((req.query && req.query.fromMe) || '') === '1';
      if (!jid || !id) { res.status(400).json({ error: 'jid e id obrigatorios' }); return; }
      const mr = await evo('/chat/getBase64FromMediaMessage/' + INSTANCE, 'POST', { message: { key: { id, remoteJid: jid, fromMe } } });
      const b64 = mr.body && (mr.body.base64 || mr.body.media || mr.body.buffer);
      const mime = (mr.body && (mr.body.mimetype || mr.body.mime)) || 'application/octet-stream';
      if (!b64) { res.status(404).json({ error: 'sem midia' }); return; }
      res.status(200).json({ dataUrl: 'data:' + mime + ';base64,' + b64, mime });
      return;
    }

    // ---- ENVIAR MENSAGEM ----
    if (action === 'send') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      const jid = b && b.jid, text = b && b.text;
      if (!jid || !text) { res.status(400).json({ error: 'jid e text obrigatorios' }); return; }
      const cmd = String(text).trim().toLowerCase();
      // COMANDO "." -> devolve a conversa para a IA (nao envia ao cliente)
      if (String(text).trim() === '.') {
        await db(`insert into ia_atendimento (remote_jid, ia_pausada, atendente_id, atualizado_em) values ($1,false,null,now())
          on conflict (remote_jid) do update set ia_pausada=false, atendente_id=null, atualizado_em=now()`, [jid]);
        res.status(200).json({ ok: true, comando: 'ia_retomada' });
        return;
      }
      // COMANDO "assumir"/"vamos la" -> pausa IA + atribui ao logado (nao envia ao cliente)
      if (['assumir', 'vamos la', 'vamosla', '/assumir', '/vamos'].indexOf(cmd) >= 0) {
        await db(`insert into ia_atendimento (remote_jid, ia_pausada, atendente_id, atualizado_em) values ($1,true,$2,now())
          on conflict (remote_jid) do update set ia_pausada=true, atendente_id=$2, atualizado_em=now()`, [jid, user.usuarioId]);
        res.status(200).json({ ok: true, comando: 'assumido' });
        return;
      }
      // envio manual do humano: assume a conversa (pausa a IA e atribui, se ainda nao)
      await db(`insert into ia_atendimento (remote_jid, ia_pausada, atendente_id, nao_lidas, ultimo_lido_em, atualizado_em) values ($1,true,$2,0,now(),now())
        on conflict (remote_jid) do update set ia_pausada=true, atendente_id=coalesce(ia_atendimento.atendente_id,$2), nao_lidas=0, ultimo_lido_em=now(), atualizado_em=now()`, [jid, user.usuarioId]);
      const number = String(jid).endsWith('@s.whatsapp.net') ? String(jid).split('@')[0] : jid;
      // assinatura por departamento: *Nome / Departamento:* (o agente assina *SAM / Atendimento:*)
      const assinatura = '*' + (user.nome || 'Atendente') + ' / ' + (user.departamento || 'Atendimento') + ':*\n';
      const r = await evo('/message/sendText/' + INSTANCE, 'POST', { number, text: assinatura + text });
      res.status(r.ok ? 200 : 500).json({ ok: r.ok, resp: r.body, assumido: true, assinatura: assinatura.trim() });
      return;
    }

    // ---- STATUS (default) ----
    const st = await evo('/instance/connectionState/' + INSTANCE);
    const state = st.body && st.body.instance && st.body.instance.state;
    const status = state === 'open' ? 'conectado' : state === 'connecting' ? 'aguardando_qr' : 'desconectado';
    let numero = null, perfil = null;
    if (status === 'conectado') {
      const fi = await evo('/instance/fetchInstances');
      const inst = Array.isArray(fi.body) ? fi.body.find(x => x.name === INSTANCE || x.instanceName === INSTANCE) : null;
      if (inst) { perfil = inst.profileName || null; numero = inst.number || (inst.ownerJid ? String(inst.ownerJid).split('@')[0] : null); }
      await db(`update canais_whatsapp set status='conectado', perfil_nome=$1, numero=coalesce($2,numero),
        conectado_em=coalesce(conectado_em, now()), ultimo_evento=$3, updated_at=now() where instancia=$4`,
        [perfil, numero, JSON.stringify(st.body), INSTANCE]);
    } else {
      await db(`update canais_whatsapp set status=$1, ultimo_evento=$2, updated_at=now() where instancia=$3`,
        [status, JSON.stringify(st.body), INSTANCE]);
    }
    res.status(200).json({ status, numero, perfil, instancia: INSTANCE, state });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
