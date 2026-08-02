# AiLogic Hub — Status das Adequações Pré-Testes Finais

> Resposta ao Relatório Técnico de **28/07/2026**. Situação de cada um dos 13 itens.
> **Stack:** HTML + Vercel Functions (Node) + Postgres + Supabase Auth.
> **Entrega:** branches por fase, todas integradas na `main` → deploy automático na Vercel.

## Progresso geral

**10 de 13 itens** implementados e em produção.

| Situação | Itens |
|----------|-------|
| ✅ No ar | 01, 02, 03, 04, 05, 06, 07, 08, 10, 13 |
| ⏳ Aguarda ação | 09 (regras de negócio), 11 (operação de banco) |
| 🔵 Decisão | 12 (assinatura digital) |

> Observação: **10 itens de código** estão entregues. Os 3 restantes não são "mais código a escrever" — são uma **decisão** (12), uma **operação de banco** (11) e um **módulo que aguarda regras de negócio** (09).

---

## Fase 1 — Estrutura & Vínculos

### 01 · Vincular gestor responsável — CRÍTICO ✅
Campo obrigatório "Gestor responsável" na criação/edição, com busca de usuários ativos (autocomplete) e opção de convidar novo gestor (gera login + senha temporária). Vínculo persistente via `gestor_id`; exibido no detalhe.
**Arquivos:** `imobiliarias.html`, `api/data.js`

### 02 · Incluir corretores na imobiliária — CRÍTICO ✅
Seção "Corretores" com contador de vagas (X / cota), seleção de usuários ativos ou convite, e seletor de plano (Base = 2, Pro = 5, Premium = ilimitado). 3º corretor bloqueado no plano base — validação no front e no backend (autoridade final).
**Arquivos:** `imobiliarias.html`, `api/data.js`

### 03 · Fluxo de cadastro integrado — CRÍTICO ✅
Etapa de revisão/confirmação antes de gravar (modal "Revisar cadastro") com resumo de empresa + gestor + corretores e tags (convite / existente / já vinculado). E-mail único entre convidados. Persistência integrada: empresa → gestor → corretores → convites de senha.
**Arquivos:** `imobiliarias.html`

### 10 · Nome do usuário e status de acesso — CRÍTICO ✅
Status padronizado: Convite pendente / Ativo / Bloqueado (derivado de `auth_user_id`, exposto pelo backend). Coluna e detalhe padronizados na tela de corretores, com ação de reenviar convite.
**Arquivos:** `corretores.html`, `imobiliarias.html`, `api/data.js`

### 13 · Cadastros em abas e subabas — ALTO ✅
Detalhe da imobiliária em subabas: Dados gerais · Gestor · Corretores · Usuários e acesso · Plano e financeiro. Mantém a imobiliária selecionada e destaca a opção ativa.
**Arquivos:** `imobiliarias.html`

---

## Fase 2 — Acesso & Segurança

### 04 · Aba Jurídico para a Diretoria — CRÍTICO ✅
Nova página `juridico.html` (casos, honorários, status de assinatura); atribuir/remover advogado por negócio. Nova ação de backend `casos` (visão da diretoria); nav-item "Jurídico" em 27 páginas, visível só para perfis administrativos.
**Arquivos:** `juridico.html`, `api/juris.js`, `auth.js`, +27 páginas

### 05 · Recuperação de senha por e-mail — CRÍTICO ✅
Tela de redefinição robusta aos dois formatos de link do Supabase — implicit (`#access_token`) e PKCE (`?code`) — usando a storageKey do app para acessar o code_verifier, com fallback de `exchangeCodeForSession`.
**Arquivos:** `redefinir.html`
**Atenção:** se o e-mail não chegar, a causa mais provável é **configuração de SMTP / Redirect URLs no painel do Supabase**, não o código.

### 06 · Encerramento de sessão por inatividade — ALTO ✅
Timeout: 15 min (perfis administrativos) / 30 min (demais). Reinicia a contagem em interação real; ao expirar, faz logout. Inatividade e logout sincronizados entre abas.
**Arquivos:** `auth.js`

### 07 · Foto do usuário — ALTO ✅
Upload/substituição por clique no avatar (JPG/PNG/WEBP, até 3 MB), resize 256 px no canvas. Persiste em `user_metadata.avatar_url` (sobrevive a novo login/dispositivo), com fallback local e iniciais.
**Arquivos:** `auth.js`

---

## Fase 3 — Integrações & Estabilidade

### 08 · Desempenho e abertura do WhatsApp — CRÍTICO ✅
**Causa raiz:** nenhuma requisição tinha timeout — canal/banco lento deixava o módulo em "Carregando…" para sempre e segurava a função serverless. **Correção:** front com timeout de 12 s, estado de carregamento e erro com "Tentar novamente" (conversas e mensagens); backend com timeout de 8 s na chamada à Evolution API, degradando com elegância.
**Arquivos:** `whatsapp.html`, `api/wa.js`

---

## Pendentes

### 09 · Controle financeiro do Hub — CRÍTICO ⏳
Módulo novo (Financeiro do Hub + escopo por perfil): receitas, planos, comissões, modelo Fifty, cobranças, status e relatórios.
**Falta:** definição do modelo Fifty, cálculo de comissões/cobranças e escopo por perfil.

### 12 · Avaliar assinatura digital no Google — DECISÃO 🔵
Análise técnica e jurídica das opções (Workspace/Drive vs provedor integrado): envio, assinatura, trilha de auditoria, identidade, armazenamento, permissões, LGPD e validade.
**Falta:** decisão de negócio. Ver `docs/ANALISE_ASSINATURA_GOOGLE.md`.

### 11 · Zerar o ambiente de homologação — ALTO ⏳
Operação destrutiva: backup técnico + limpeza apenas da base de homologação, preservando configurações, integrações e o administrador. **Nunca em produção.**
**Falta:** acesso ao banco de homologação + confirmação explícita. Último passo, após todos os demais validados.

---

## Verificação

**Já verificado** (teste local de UI com `/api` simulado, perfil Diretoria, zero erros de console):
- Modal de cadastro renderiza gestor, corretores e plano
- Fluxo do item 03: "Revisar cadastro" abre com resumo correto
- Página Jurídico: KPIs, tabela, atribuição de advogado
- Corretores: coluna "Status de acesso" e upload de foto ativos
- WhatsApp carrega sem tela branca
- Nav "Jurídico" único nas 28 páginas

**Ainda precisa de validação em produção** (backend real — ver `docs/ROTEIRO_TESTES.md`):
- Persistência real do cadastro
- Chegada dos e-mails de convite e reset (SMTP do Supabase)
- Expiração de sessão (15 / 30 min)
- Foto persistindo entre logins
- Timeout do WhatsApp com Evolution API lenta
