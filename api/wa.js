// AI LOGIC HUB — Backend do canal WhatsApp (Serverless Vercel)
// Fala com o Evolution (server-side) e grava o estado no Supabase.
// Segredos vêm de variáveis de ambiente da Vercel — nunca no repo.
//   EVO_BASE     ex: https://<host>/        (base da API Evolution)
//   EVO_KEY      apikey global do Evolution
//   WA_INSTANCE  nome da instância (default ailogic-hub-principal)
//   DB_URL       connection string Postgres (Supabase)
const { Client } = require('pg');

const EVO_BASE = (process.env.EVO_BASE || '').replace(/\/$/, '');
const EVO_KEY  = process.env.EVO_KEY || '';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';
const DB_URL   = process.env.DB_URL || '';

async function db(q, params) {
  const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
  await c.connect();
  try { return await c.query(q, params); }
  finally { try { await c.end(); } catch (_) {} }
}

async function evo(path, method = 'GET') {
  const r = await fetch(EVO_BASE + path, {
    method,
    headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' }
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch (_) { j = { raw: t }; }
  return { ok: r.ok, status: r.status, body: j };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || 'status';
  try {
    if (!EVO_BASE || !EVO_KEY || !DB_URL) {
      res.status(500).json({ error: 'backend nao configurado (faltam env vars)' });
      return;
    }

    // ---- CONECTAR: gera QR no Evolution ----
    if (action === 'connect') {
      const r = await evo('/instance/connect/' + INSTANCE);
      const qr = r.body && (r.body.base64 || (r.body.qrcode && r.body.qrcode.base64)) || null;
      await db(
        `update canais_whatsapp set status='aguardando_qr', ultimo_evento=$1, updated_at=now() where instancia=$2`,
        [JSON.stringify(r.body), INSTANCE]
      );
      res.status(200).json({ status: 'aguardando_qr', qr, pairingCode: r.body && r.body.pairingCode || null });
      return;
    }

    // ---- DESCONECTAR: logout no Evolution ----
    if (action === 'disconnect') {
      const r = await evo('/instance/logout/' + INSTANCE, 'DELETE');
      await db(
        `update canais_whatsapp set status='desconectado', desconectado_em=now(), updated_at=now() where instancia=$1`,
        [INSTANCE]
      );
      res.status(200).json({ status: 'desconectado', ok: r.ok });
      return;
    }

    // ---- STATUS (default): lê o estado real do Evolution ----
    const st = await evo('/instance/connectionState/' + INSTANCE);
    const state = st.body && st.body.instance && st.body.instance.state;
    const status = state === 'open' ? 'conectado' : state === 'connecting' ? 'aguardando_qr' : 'desconectado';

    let numero = null, perfil = null;
    if (status === 'conectado') {
      const fi = await evo('/instance/fetchInstances');
      const inst = Array.isArray(fi.body)
        ? fi.body.find(x => x.name === INSTANCE || x.instanceName === INSTANCE) : null;
      if (inst) {
        perfil = inst.profileName || null;
        numero = inst.number || (inst.ownerJid ? String(inst.ownerJid).split('@')[0] : null);
      }
      await db(
        `update canais_whatsapp set status='conectado', perfil_nome=$1, numero=coalesce($2,numero),
           conectado_em=coalesce(conectado_em, now()), ultimo_evento=$3, updated_at=now() where instancia=$4`,
        [perfil, numero, JSON.stringify(st.body), INSTANCE]
      );
    } else {
      await db(
        `update canais_whatsapp set status=$1, ultimo_evento=$2, updated_at=now() where instancia=$3`,
        [status, JSON.stringify(st.body), INSTANCE]
      );
    }
    res.status(200).json({ status, numero, perfil, instancia: INSTANCE, state });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
