// AILOGIC HUB — Autocadastro PÚBLICO de imobiliária (sem autenticação).
// Recebe a solicitação da tela /parceria e grava a imobiliária como PENDENTE
// (ativo=false, extra.pendente=true) para o administrador aprovar depois.
// Nao concede acesso: o login do responsavel so e criado na aprovacao.
const { db } = require('./_db');
const DB_URL = process.env.DB_URL || '';

function slugify(s) {
  return String(s || 'imob').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'imob';
}
const rid = () => Math.random().toString(36).slice(2, 6);
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'POST') { res.status(405).json({ error: 'metodo nao permitido' }); return; }
  if (!DB_URL) { res.status(500).json({ error: 'backend nao configurado' }); return; }
  try {
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
    b = b || {};

    const nome = clip(b.nome, 120);
    const cidade = clip(b.cidade, 80);
    const responsavel = clip(b.responsavel, 120);
    const email = clip(b.email, 160).toLowerCase();
    const telefone = clip(b.telefone, 40);
    const creci = clip(b.creci, 40);

    if (!nome) { res.status(400).json({ error: 'Informe o nome da imobiliaria.' }); return; }
    if (!cidade) { res.status(400).json({ error: 'Informe a cidade.' }); return; }
    if (!responsavel) { res.status(400).json({ error: 'Informe o responsavel.' }); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'Informe um e-mail valido.' }); return; }
    if (telefone.replace(/\D/g, '').length < 10) { res.status(400).json({ error: 'Informe um WhatsApp valido com DDD.' }); return; }

    // evita duplicidade obvia: ja existe imobiliaria com esse e-mail de responsavel pendente/ativa
    try {
      const dup = await db(
        `select 1 from imobiliarias where deleted_at is null and lower(coalesce(extra->>'responsavel_email','')) = $1 limit 1`,
        [email]
      );
      if (dup.rows[0]) { res.status(200).json({ ok: true, jaExiste: true }); return; }
    } catch (_) { /* se a coluna extra nao suportar o operador, segue para o insert */ }

    const extra = {
      pendente: true,
      origem: 'auto-cadastro',
      responsavel_nome: responsavel,
      responsavel_email: email,
      responsavel_telefone: telefone
    };
    const slug = slugify(nome) + '-' + rid();

    await db(
      `insert into imobiliarias(nome, creci, slug, telefone, email, cidade, ativo, extra)
       values($1,$2,$3,$4,$5,$6,false,$7)`,
      [nome, creci || null, slug, telefone || null, email || null, cidade || null, JSON.stringify(extra)]
    );

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Nao foi possivel registrar agora. Tente novamente em instantes.' });
  }
};
