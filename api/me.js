// AILOGIC HUB — perfil resolvido do usuario logado (fonte de verdade: tabela usuarios).
// Usado pelo front para (a) restringir o menu por perfil e (b) bloquear acesso direto
// a telas que o perfil nao pode ver. A isolacao por imobiliaria continua sendo feita
// no escopo das queries (api/_auth.js). Este endpoint nunca confia no user_metadata.
const { requireAuth } = require('./_auth');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ctx = await requireAuth(req, res);
  if (!ctx) return; // requireAuth ja respondeu 401
  res.status(200).json({
    perfil: ctx.perfil || null,
    isAdmin: !!ctx.isAdmin,
    imobiliariaId: ctx.imobiliariaId || null,
    nome: ctx.nome || null,
    departamento: ctx.departamento || null
  });
};
