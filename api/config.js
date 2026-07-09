// AILOGIC HUB — entrega a config PÚBLICA do front (URL + anon key) como JS.
// Lê das env vars da Vercel; nada versionado. A anon key é pública por design.
module.exports = async (req, res) => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(
    'window.HUB_CONFIG=' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anon }) + ';'
  );
};
