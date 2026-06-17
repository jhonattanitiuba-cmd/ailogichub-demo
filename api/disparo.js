// AI LOGIC HUB — Disparo inicial (mensagem validada) às 07:00. Idempotente via flag no banco.
// Enviado pelo número do Hub (ailogic-hub-principal) para Jhonattan e Alessandro.
// Acionado por: Vercel Cron (10:00 UTC = 07:00 BRT) e/ou Task Scheduler local (reforço).
const { Client } = require('pg');
const EVO_BASE = (process.env.EVO_BASE || '').replace(/\/$/, '');
const EVO_KEY  = process.env.EVO_KEY || '';
const INSTANCE = process.env.WA_INSTANCE || 'ailogic-hub-principal';
const DB_URL   = process.env.DB_URL || '';

const ALVOS = ['5511991612610', '5511995568148']; // Jhonattan, Alessandro
const MSG = `*ATUALIZAÇÃO · AI LOGIC HUB*
Data: 17/06/2026
———————————————

Bom dia! Resumo da evolução:

• Plataforma no ar — ailogichub.app (com SSL)
• E-mail corporativo blindado (SPF, DKIM e DMARC)
• Banco de dados do Hub estruturado (multi-tenant)
• WhatsApp do Hub conectado e espelhado na plataforma
• Cadastro de imobiliárias e imóveis na plataforma
• Funil e identidade visual editáveis
• Seu agente de IA já está ativo

*Novidade — personalize seu agente:*
Responda aqui mesmo com um "oi". O agente já conhece a sua base e vai conversar com você para se personalizar do seu jeito.

*Próximos passos:*
• Aquecimento do número de WhatsApp
• Popular imóveis (Cirag)
• Ata da Reunião 2/4

———————————————
*Brava Company*`;

async function db(q, p) {
  const c = new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 });
  await c.connect();
  try { return await c.query(q, p); } finally { try { await c.end(); } catch (_) {} }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!EVO_BASE || !EVO_KEY || !DB_URL) { res.status(500).json({ error: 'env ausente' }); return; }
    const dry = req.query && (req.query.dry === '1' || req.query.dry === 'true');
    const row = (await db('select disparo_inicial_enviado from canais_whatsapp where instancia=$1', [INSTANCE])).rows[0] || {};
    if (row.disparo_inicial_enviado) { res.status(200).json({ ok: true, skipped: 'ja enviado' }); return; }
    if (dry) { res.status(200).json({ ok: true, dry: true, alvos: ALVOS, len: MSG.length }); return; }

    const resultados = [];
    for (const n of ALVOS) {
      const r = await fetch(EVO_BASE + '/message/sendText/' + INSTANCE, {
        method: 'POST', headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: n, text: MSG })
      });
      resultados.push({ n, ok: r.ok });
    }
    if (resultados.every(r => r.ok)) {
      await db('update canais_whatsapp set disparo_inicial_enviado=true, updated_at=now() where instancia=$1', [INSTANCE]);
    }
    res.status(200).json({ ok: true, enviado: resultados });
  } catch (e) {
    res.status(200).json({ ok: false, erro: String((e && e.message) || e) });
  }
};
