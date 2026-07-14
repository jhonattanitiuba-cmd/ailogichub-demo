// AILOGIC HUB — Backend do canal WhatsApp (Serverless Vercel)
// Espelha o WhatsApp do Hub DENTRO da plataforma (sem Chatwoot).
// Fala com o Evolution server-side e grava estado no Supabase.
// Segredos via env vars da Vercel — nunca no repo.
//   EVO_BASE, EVO_KEY, WA_INSTANCE, DB_URL
const { Client } = require('pg');
const { requireAuth } = require('./_auth');

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

async function db(q, params) {
  const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
  await c.connect();
  try { return await c.query(q, params); }
  finally { try { await c.end(); } catch (_) {} }
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
      const r = await db('select ia_ativa, ia_persona, ia_allowlist from canais_whatsapp where instancia=$1', [INSTANCE]);
      res.status(200).json(r.rows[0] || {});
      return;
    }
    // ---- CONFIG DA IA: salvar (persona/ativa) ----
    if (action === 'config-save') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      b = b || {};
      await db(`update canais_whatsapp set
          ia_ativa = coalesce($1, ia_ativa),
          ia_persona = coalesce($2, ia_persona),
          updated_at = now()
        where instancia=$3`,
        [typeof b.ia_ativa === 'boolean' ? b.ia_ativa : null, (b.ia_persona != null ? String(b.ia_persona) : null), INSTANCE]);
      res.status(200).json({ ok: true });
      return;
    }

    // ---- LISTA DE CONVERSAS (espelho) ----
    if (action === 'chats') {
      const cutoff = await getCutoff();
      const r = await evo('/chat/findChats/' + INSTANCE, 'POST', {});
      const arr = Array.isArray(r.body) ? r.body : [];
      // estado de atendimento (handoff IA<->humano) numa consulta so
      const estado = {};
      try {
        const er = await db(`select a.remote_jid, a.atendente_id, a.ia_pausada, a.nao_lidas, u.nome atendente_nome
          from ia_atendimento a left join usuarios u on u.id = a.atendente_id`);
        (er.rows || []).forEach(x => { estado[x.remote_jid] = x; });
      } catch (_) {}
      let chats = arr.map(c => {
        const st = estado[c.remoteJid] || {};
        return {
          jid: c.remoteJid,
          nome: NAMES[num8(c.remoteJid)] || c.pushName || (c.remoteJid ? String(c.remoteJid).split('@')[0] : 'Contato'),
          foto: c.profilePicUrl || null,
          atualizado: c.updatedAt || null,
          janelaAtiva: !!c.windowActive,
          grupo: String(c.remoteJid || '').endsWith('@g.us'),
          ultima: c.lastMessage ? msgText(c.lastMessage) : '',
          fromMe: !!(c.lastMessage && c.lastMessage.key && c.lastMessage.key.fromMe),
          atendenteId: st.atendente_id || null,
          atendenteNome: st.atendente_nome || null,
          iaPausada: !!st.ia_pausada,
          naoLidas: st.nao_lidas || 0
        };
      }).filter(c => c.jid && !c.grupo)   // espelhamento liberado (exclui grupos)
        .sort((a, b) => new Date(b.atualizado || 0) - new Date(a.atualizado || 0));
      if (cutoff) chats = chats.filter(c => c.atualizado && new Date(c.atualizado) >= cutoff);
      res.status(200).json({ chats, meuId: user.usuarioId || null, meuNome: user.nome || null });
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
    // ---- quem sou eu (para o filtro "Minhas") ----
    if (action === 'me') {
      res.status(200).json({ id: user.usuarioId || null, nome: user.nome || null, email: user.email || null, perfil: user.perfil || null, isAdmin: !!user.isAdmin });
      return;
    }

    // ---- MENSAGENS DE UMA CONVERSA ----
    if (action === 'messages') {
      const jid = req.query && req.query.jid;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      // espelhamento liberado: sem filtro de numero
      const cutoff = await getCutoff();
      const r = await evo('/chat/findMessages/' + INSTANCE, 'POST', { where: { key: { remoteJid: jid } }, limit: 60 });
      const recs = (r.body && r.body.messages && r.body.messages.records) || [];
      let msgs = recs.map(m => ({
        id: m.key && m.key.id,
        fromMe: !!(m.key && m.key.fromMe),
        texto: msgText(m),
        tipo: m.messageType,
        ts: m.messageTimestamp ? Number(m.messageTimestamp) : null,
        autor: m.pushName || null
      })).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (cutoff) { const c = cutoff.getTime(); msgs = msgs.filter(m => m.ts && m.ts * 1000 >= c); }
      res.status(200).json({ jid, msgs });
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
      const r = await evo('/message/sendText/' + INSTANCE, 'POST', { number, text });
      res.status(r.ok ? 200 : 500).json({ ok: r.ok, resp: r.body, assumido: true });
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
