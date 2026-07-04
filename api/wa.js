// AI LOGIC HUB — Backend do canal WhatsApp (Serverless Vercel)
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
      let chats = arr.map(c => ({
        jid: c.remoteJid,
        nome: NAMES[num8(c.remoteJid)] || c.pushName || (c.remoteJid ? String(c.remoteJid).split('@')[0] : 'Contato'),
        foto: c.profilePicUrl || null,
        atualizado: c.updatedAt || null,
        janelaAtiva: !!c.windowActive,
        grupo: String(c.remoteJid || '').endsWith('@g.us'),
        ultima: c.lastMessage ? msgText(c.lastMessage) : '',
        fromMe: !!(c.lastMessage && c.lastMessage.key && c.lastMessage.key.fromMe)
      })).filter(c => c.jid && allowedJid(c.jid))   // MODO TESTE: só Jhonattan + Alessandro
        .sort((a, b) => new Date(b.atualizado || 0) - new Date(a.atualizado || 0));
      if (cutoff) chats = chats.filter(c => c.atualizado && new Date(c.atualizado) >= cutoff);
      res.status(200).json({ chats });
      return;
    }

    // ---- MENSAGENS DE UMA CONVERSA ----
    if (action === 'messages') {
      const jid = req.query && req.query.jid;
      if (!jid) { res.status(400).json({ error: 'jid obrigatorio' }); return; }
      if (!allowedJid(jid)) { res.status(403).json({ error: 'numero fora do modo teste' }); return; }
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
      if (!allowedJid(jid)) { res.status(403).json({ error: 'numero fora do modo teste' }); return; }
      const number = String(jid).endsWith('@s.whatsapp.net') ? String(jid).split('@')[0] : jid;
      const r = await evo('/message/sendText/' + INSTANCE, 'POST', { number, text });
      res.status(r.ok ? 200 : 500).json({ ok: r.ok, resp: r.body });
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
