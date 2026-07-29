# Handoff — Infraestrutura & Upgrades · AiLogic Hub

> Documento de continuidade para trabalho **local**.
> Consolida: auditoria do código (branch `claude/trabalhar-neste-repo-8qfsr9`) + painel Cloudfy (print) + 2 relatórios (DOCX 28/07 e PDF REV1a 25/07).
> Gerado em 29/07/2026. **Nada foi alterado no código** — é só levantamento.

---

## 1. Mapa da infraestrutura (consolidado)

```
Navegador (HTML estático + hub.js/hub.css + auth.js)
        │  fetch('/api/...') com Bearer JWT
        ▼
Hospedagem da app  ── ❓ Vercel (tem vercel.json) e/ou Cloudfy (.cloudfy.live)  [CONFIRMAR]
        │
        └── Stack dedicada no Cloudfy (plano Ultra):
              ├── Supabase      ── Auth (GoTrue self-hosted) + Postgres   [USADO]
              ├── Evolution API ── WhatsApp (espelho + envio)             [USADO]
              ├── Redis         ── Cache Database                         [PROVISIONADO, NÃO USADO]
              ├── n8n           ── Automation Platform                    [PROVISIONADO, NÃO USADO]
              └── Chatwoot      ── Omnichannel CRM                        [PROVISIONADO, código diz "sem Chatwoot"]
        │
        └── OpenAI API ── agente "Sam" (gpt-4o-mini)  [motor real ≠ marca "Claude"]
```

### Painel Cloudfy (do print)
- Plataforma: `cloudfy.space` · projeto **AILOGIC HUB** · org "Cloudfy"
- Conta: **Brava Company** (`jhonattanitiuba@gmail.com`) · Plano **Ultra** · criado 10/06/2026
- App: `sunlovingflatworm.cloudfy.live`
- Uso: 754 requisições / 1.21 MB / 754 req. API
- Toggles: **IA ilimitada = Inativo** · **Backup diário = Inativo** · Números WhatsApp = ativo

---

## 2. Camadas (detalhe técnico)

### Hosting & Deploy
- Frontend: páginas `.html` estáticas (sem build). `index.html` roteia p/ `/login` ou `/visaogeral`.
- Backend: 7 funções serverless em `/api` (Node, CommonJS).
- `vercel.json`: `cleanUrls`, redirect `/ → /visaogeral`, **cron** `/api/disparo` em `0 10 * * *` (10h UTC = 7h BRT).
- Produção citada no PDF: `ailogichub.app` (SSL). **Sem ambiente de homologação separado.**

### Autenticação (Supabase Auth / GoTrue)
- Client `auth.js`: supabase-js, sessão em `localStorage` (`ailogic-auth`), injeta Bearer em `fetch('/api/…')`, gate de página.
- Server `api/_auth.js`: valida JWT via `GET {SUPABASE_URL}/auth/v1/user`. Usado em `dash.js`, `data.js`, `wa.js`.
- ⚠️ **Só autenticação — sem RBAC/autorização por perfil.**

### Banco de dados (Postgres via `pg`)
- Conexão: `new Client({ connectionString: DB_URL, ssl: false, connectionTimeoutMillis: 8000 })`.
- ⚠️ Abre/fecha **conexão nova a cada request** (sem pool/pooler; **Redis disponível mas não usado**).
- ⚠️ `ssl: false` (revertido de propósito no histórico — "valor comprovado em produção").
- Tabelas mapeadas: `imobiliarias`, `imoveis`, `usuarios`, `funil_negocios`, `canais_whatsapp`, `hub_dashboard`.
- Multi-tenant por `imobiliaria_id`, mas **sem isolamento no servidor** (`/api/data` devolve tudo p/ qualquer autenticado).

### WhatsApp (Evolution API)
- Env: `EVO_BASE`, `EVO_KEY`, `WA_INSTANCE` (default `ailogic-hub-principal`).
- `api/wa.js`: espelho + envio server-side. `api/wa-webhook.js`: recebe `messages.upsert`, responde via IA. `api/disparo.js`: broadcast único idempotente.
- ⚠️ **Duas allowlists de "modo teste" diferentes**:
  - `wa.js` (hardcoded no código): `['5511991612610','5511995568148']` (Jhonattan + Alessandro).
  - `wa-webhook.js` (do banco): coluna `ia_allowlist` em `canais_whatsapp`.

### IA do "Sam"  ⚠️ DIVERGÊNCIA IMPORTANTE
- Comentários/doc dizem **"Claude / ANTHROPIC_API_KEY"**, mas o código real usa **OpenAI**:
  - `OPENAI_API_KEY` → `POST https://api.openai.com/v1/chat/completions`, **`model: gpt-4o-mini`**, `max_tokens: 400`.
  - Fallback "básico" (respostas fixas) sem chave.

### Segredos / env vars
| Variável | Uso | Exposição |
|---|---|---|
| `SUPABASE_URL` | Auth + `/api/config` | Pública |
| `SUPABASE_ANON_KEY` | Auth client + validação JWT | Pública por design |
| `DB_URL` | Postgres | 🔒 Secreta |
| `EVO_BASE` / `EVO_KEY` | Evolution API | 🔒 Secreta |
| `WA_INSTANCE` | Instância WhatsApp | Config |
| `OPENAI_API_KEY` | IA do Sam | 🔒 Secreta |
| *(faltando)* `REDIS_URL` | Cache Redis | 🔒 (a criar quando integrar) |

`.gitignore` cobre `.env*`, `hub-config.js`, `hub-secrets.*`. `hub-config.js` é gerado no deploy (não versionado).

---

## 3. Discrepâncias a resolver (bloqueiam decisões)

1. **Topologia de hospedagem** — `vercel.json` aponta Vercel, mas o painel mostra a app no **Cloudfy** (`.cloudfy.live`) e o PDF cita `ailogichub.app`. Definir: frontend/API onde? Env vars onde?
2. **Commit de produção divergente** — o PDF diz produção no **commit `848291b`**, que **não existe** nesta branch (topo = `e874826`). As entregas REV1a de "foto do usuário" e "trava do Jurídico" **não estão neste código**. Confirmar o que está de fato em produção.
3. **Redis / n8n / Chatwoot ociosos** — provisionados (pagos no plano Ultra) mas **não integrados** ao código.
4. **"Jurídico" = perfil `advogado`** no banco, hoje com acesso geral (sem RBAC no servidor). A "trava" descrita é só visual/client-side.

---

## 4. Backlog de upgrades (candidatos)

| # | Upgrade | Serviço | Esforço | Risco | Precisa credencial? |
|---|---|---|---|---|---|
| U1 | Cache + reuso de conexão | Redis | Médio | Baixo | `REDIS_URL` |
| U2 | RBAC no servidor (perfis) | Supabase/`_auth` | Alto | Médio | Não (código) |
| U3 | Isolamento multi-tenant (`imobiliaria_id`) | `/api/data` | Alto | Médio | Não (código) |
| U4 | Migrar IA p/ Claude (ou parametrizar provedor) | wa-webhook | Baixo | Baixo | `ANTHROPIC_API_KEY` |
| U5 | Unificar allowlist WhatsApp (só banco) | wa.js | Baixo | Baixo | Não |
| U6 | Automação (disparos/e-mail/rotinas) | n8n | Médio | Baixo | Acesso n8n |
| U7 | Roteamento WhatsApp via CRM | Chatwoot | Alto | Alto* | Acesso Chatwoot |
| U8 | TLS na conexão do banco | `pg` | Baixo | Médio | Não |
| U9 | Ambiente de homologação separado | Cloudfy/Vercel | Médio | Baixo | Toggle painel |
| U10 | Backup diário | Cloudfy | Baixo | Baixo | Toggle painel |

\* *U7 muda a arquitetura atual (o app foi feito de propósito "sem Chatwoot") — decisão do cliente.*

---

## 5. Requisitos dos relatórios (mapeados ao código)

**DOCX (28/07) — 13 adequações que BLOQUEIAM os testes finais:**

| # | Item | Prio | Estado no código |
|---|---|---|---|
| 01 | Vincular gestor à imobiliária | CRÍTICO | Falta campo "gestor responsável" no cadastro |
| 02 | Corretores na imobiliária (até 2; 3º = plano) | CRÍTICO | CRUD existe; sem limite/gate de plano |
| 03 | Fluxo de cadastro integrado (convite+senha) | CRÍTICO | Não existe fluxo de convite |
| 04 | Aba Jurídico p/ Diretoria | CRÍTICO | Não existe aba Jurídico |
| 05 | Recuperação de senha por e-mail | CRÍTICO | "Esqueci a senha" é link morto (`login.html:97`) |
| 06 | Política de sessão (timeout) | ALTO | Só autoRefresh do Supabase; sem timeout inatividade |
| 07 | Foto do usuário | ALTO | Não implementado |
| 08 | Desempenho/abertura do WhatsApp | CRÍTICO | Falta loading/erro/retry e revisão de perf |
| 09 | Financeiro do Hub + escopo por usuário | CRÍTICO | Tela existe; sem perfil "financeiro" no banco |
| 10 | Nome do usuário + criação de senha | CRÍTICO | Depende do item 03 |
| 11 | Zerar homologação (com backup) | CRÍTICO | Operacional; Backup diário está Inativo |
| 12 | Assinatura digital via Google | DECISÃO | Do cliente; não iniciado |
| 13 | Cadastros em abas/subabas | ALTO | Não feito |

**Ordem recomendada pelo DOCX:** Etapa 1 (estrutura/vínculos: 1,2,3,9,10,13) → Etapa 2 (acesso/segurança: 4,5,6,7) → Etapa 3 (integrações: 8,12) → Etapa 4 (preparar teste: 11).

**PDF (REV1a) — pendências do cliente:** parametrização (planos, 50/50, SLAs, score), matriz de perfis (não há "financeiro" no banco: só admin, gestor, corretor, parceiro, advogado), início da mensalidade, CNPJ, site modelo OpenAI.

---

## 6. Manejo de credenciais (recomendado)

- **Nunca** colar segredo de produção em chat/ferramenta — preferir **credenciais de homologação**.
- Guardar segredos em **`.env` local** (já está no `.gitignore`) — nunca commitar.
- Passar à app via **env vars do deploy** (Vercel ou painel Cloudfy), não hardcoded.
- **Rotacionar** qualquer chave que tenha sido exposta.
- Variáveis a preencher no `.env` local:
  ```
  SUPABASE_URL=
  SUPABASE_ANON_KEY=
  DB_URL=
  EVO_BASE=
  EVO_KEY=
  WA_INSTANCE=ailogic-hub-principal
  OPENAI_API_KEY=          # (ou ANTHROPIC_API_KEY se migrar p/ Claude)
  REDIS_URL=               # (quando integrar Redis)
  ```

---

## 7. Próximos passos sugeridos (ordem prática)

1. **Confirmar topologia** (Vercel vs Cloudfy) e **o que está em produção** (commit `848291b`). — *destrava tudo*
2. **U1 (Redis)** + **U8 (TLS DB)** — ganhos rápidos, baixo risco, sem mudar arquitetura.
3. **U2/U3 (RBAC + multi-tenant)** — base crítica; destrava itens 01, 02, 04, 09, 10 do DOCX.
4. **U5 (allowlist)** + **U4 (IA Claude)** — pequenos e alinham marca/segurança.
5. **U6 (n8n)** para disparos/e-mail (item 05 do DOCX: recuperação de senha).
6. **Decidir U7 (Chatwoot)** com o cliente — muda arquitetura.
7. **U9/U10** (homologação + backup) antes de "zerar" (item 11).

---

## 8. Referência rápida de arquivos

| Arquivo | Papel |
|---|---|
| `api/_auth.js` | Guard de auth (só valida JWT; sem RBAC) |
| `api/config.js` | Entrega config pública (SUPABASE_URL + anon) |
| `api/data.js` | CRUD imobiliárias/imóveis/corretores (tabela `usuarios`) |
| `api/dash.js` | Dashboard + funil (`funil_negocios`, `hub_dashboard`) |
| `api/wa.js` | WhatsApp: espelho + envio (allowlist hardcoded) |
| `api/wa-webhook.js` | Webhook IA (OpenAI gpt-4o-mini; allowlist do banco) |
| `api/disparo.js` | Broadcast único (cron 7h BRT) |
| `auth.js` | Auth client (gate + interceptor de fetch) |
| `hub.js` / `hub.css` | Layout/nav compartilhados |
| `vercel.json` | Deploy Vercel (cron, redirects) |
| `*.html` | Telas (funil, imoveis, whatsapp, administrador, etc.) |

---
*Fim do handoff.*
