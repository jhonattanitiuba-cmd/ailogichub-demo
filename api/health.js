// AILOGIC HUB — healthcheck simples para monitores de uptime. Nao expoe dados sensiveis.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, service: 'ailogic-hub', ts: Date.now() });
};
