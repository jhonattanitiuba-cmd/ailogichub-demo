// AILOGIC HUB - Upload de fotos de imovel para o Supabase Storage (bucket publico 'imoveis').
// Recebe JSON { type, dataBase64 } (imagem ja redimensionada no navegador) e devolve { url } publica.
const { requireAuth } = require('./_auth');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = 'imoveis';

function extOf(t) { return t === 'image/png' ? 'png' : t === 'image/webp' ? 'webp' : 'jpg'; }
function rid() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const user = await requireAuth(req, res); if (!user) return; // 401 tratado dentro
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!SUPABASE_URL || !SERVICE_KEY) { res.status(500).json({ error: 'storage indisponivel' }); return; }
  try {
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};
    const type = String(body.type || 'image/jpeg');
    if (!/^image\/(jpeg|png|webp)$/.test(type)) { res.status(400).json({ error: 'tipo invalido' }); return; }
    let b64 = String(body.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!b64) { res.status(400).json({ error: 'sem dados' }); return; }
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) { res.status(400).json({ error: 'dados vazios' }); return; }
    if (buf.length > 8 * 1024 * 1024) { res.status(413).json({ error: 'imagem muito grande' }); return; }
    const scope = user.imobiliariaId || 'geral';
    const path = scope + '/' + rid() + '.' + extOf(type);
    const up = await fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + path, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': type, 'x-upsert': 'true' },
      body: buf
    });
    if (!up.ok) { const t = await up.text().catch(() => ''); res.status(502).json({ error: 'upload falhou', detail: t.slice(0, 200) }); return; }
    res.status(200).json({ url: SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path });
  } catch (e) { res.status(500).json({ error: 'erro', detail: String((e && e.message) || e).slice(0, 200) }); }
};
