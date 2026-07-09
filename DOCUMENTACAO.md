# AILogic Hub — Documentação técnica

Documentação para desenvolvedores. Descreve arquitetura, APIs, banco de dados,
front-end, autenticação/RBAC, deploy e como estender a plataforma.

> **Escopo:** este é um CRM imobiliário multi-imobiliária. Front-end estático
> (HTML/CSS/JS puro), back-end serverless na Vercel, Postgres no Supabase
> (self-hosted), integração WhatsApp via Evolution API e IA via OpenAI.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Stack e dependências](#3-stack-e-dependências)
4. [Estrutura de arquivos](#4-estrutura-de-arquivos)
5. [Variáveis de ambiente](#5-variáveis-de-ambiente)
6. [Autenticação e RBAC](#6-autenticação-e-rbac)
7. [APIs (serverless)](#7-apis-serverless)
8. [Banco de dados](#8-banco-de-dados)
9. [Front-end](#9-front-end)
10. [Fluxos principais](#10-fluxos-principais)
11. [Deploy](#11-deploy)
12. [Desenvolvimento local](#12-desenvolvimento-local)
13. [Como adicionar uma nova tela](#13-como-adicionar-uma-nova-tela)
14. [Segurança](#14-segurança)
15. [Limitações e pendências](#15-limitações-e-pendências)

---

## 1. Visão geral

O AILogic Hub centraliza a operação de várias imobiliárias parceiras:
imobiliárias, corretores, leads, imóveis, funil de vendas, agenda, contratos,
financeiro e atendimento por WhatsApp — tudo em uma plataforma única, com
controle de acesso por perfil.

Cada tela é uma página HTML independente que consome as APIs serverless em
`/api/*`. As APIs falam com o Postgres (Supabase), com o Evolution (WhatsApp) e
com a OpenAI (IA). Não há framework de front-end nem build step obrigatório.

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador (usuário)                                         │
│   • páginas HTML estáticas (uma por tela)                   │
│   • auth.js: sessão Supabase, tema, interceptor de fetch    │
│   • hub.js: navegação/ícones                                │
└───────────────┬─────────────────────────────────────────────┘
                │  fetch  (Authorization: Bearer <jwt>)
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel — Funções serverless em /api                        │
│   • _auth.js  guard + RBAC (resolve perfil/imobiliária)     │
│   • data.js   CRUD genérico (imobiliarias, imoveis, leads…) │
│   • dash.js   dashboard + funil (list/move)                 │
│   • wa.js     WhatsApp (Evolution) — auditoria/envio        │
│   • wa-webhook.js  entrada de mensagens + IA (desligada)    │
│   • disparo.js     cron diário                              │
│   • config.js      config pública p/ o front                │
└──────┬───────────────────┬───────────────────┬──────────────┘
       │ pg                │ HTTPS             │ HTTPS
       ▼                   ▼                   ▼
  Postgres (Supabase)   Evolution API       OpenAI
  (DB_URL)              (WhatsApp)           (GPT-4o-mini)
```

**Princípios**
- Toda rota `/api/*` (exceto `config` e `wa-webhook`) exige um JWT válido do Supabase.
- O RBAC filtra os dados por imobiliária no servidor (não confie no front).
- O front nunca fala direto com o Postgres nem com o Evolution — só via `/api`.

---

## 3. Stack e dependências

| Camada | Tecnologia |
|---|---|
| Hospedagem / serverless / cron | Vercel |
| Front-end | HTML + CSS + JS (sem framework, sem build) |
| Auth | Supabase Auth (GoTrue) |
| Banco | PostgreSQL (Supabase self-hosted) |
| Acesso ao banco | [`pg`](https://www.npmjs.com/package/pg) (única dependência npm) |
| WhatsApp | Evolution API |
| IA | OpenAI (`gpt-4o-mini`) — atualmente desligada |
| Supabase SDK (front) | `@supabase/supabase-js@2` via CDN |

`package.json`:
```json
{ "name": "ailogichub", "private": true, "version": "1.0.0", "dependencies": { "pg": "^8.13.0" } }
```

---

## 4. Estrutura de arquivos

```
/
├── api/                     # funções serverless (Vercel)
│   ├── _auth.js             # guard de autenticação + RBAC (helper, não é rota pública)
│   ├── config.js            # GET → devolve config pública (URL + anon key) como JS
│   ├── data.js              # CRUD genérico por entidade
│   ├── dash.js              # dashboard + funil (list/move)
│   ├── wa.js                # WhatsApp: status/conectar/chats/mensagens/enviar/config IA
│   ├── wa-webhook.js        # webhook de entrada do Evolution (+ IA, hoje desligada)
│   └── disparo.js           # cron diário (mensagem inicial)
├── assets/                  # ícones do app (favicon, logo, PWA)
├── auth.js                  # front: sessão, tema, interceptor de fetch, gate
├── hub.js                   # front: navegação/realce do menu, ícones
├── hub.css                  # estilos compartilhados (legado; telas novas têm CSS próprio)
├── hub-config.example.js    # exemplo de config pública (o real é servido por /api/config)
├── index.html               # redirect: logado → /visaogeral, senão → /login
├── login.html               # tela de acesso (Supabase signIn / signUp)
├── <tela>.html              # uma página por tela (ver seção Front-end)
├── vercel.json              # rotas, cleanUrls, cron, redirect raiz
├── package.json
└── DOCUMENTACAO.md          # este arquivo
```

Arquivos **gitignored** (nunca versionar): `.env`, `hub-config.js`, `node_modules`, `.vercel`.

---

## 5. Variáveis de ambiente

Configuradas na Vercel (Project → Settings → Environment Variables).

| Variável | Usada por | Descrição |
|---|---|---|
| `SUPABASE_URL` | `_auth.js`, `config.js` | URL pública do Supabase (ex.: `https://xxx.cloudfy.live`). **Nunca** o `localhost:8000` interno. |
| `SUPABASE_ANON_KEY` | `_auth.js`, `config.js` | Chave anônima (pública, vai ao navegador). |
| `DB_URL` | `data.js`, `dash.js`, `wa.js`, `_auth.js`, `disparo.js`, `wa-webhook.js` | Connection string do Postgres. |
| `EVO_BASE` | `wa.js`, `wa-webhook.js`, `disparo.js` | Base URL do Evolution API. |
| `EVO_KEY` | idem | API key do Evolution. |
| `WA_INSTANCE` | idem | Nome da instância WhatsApp (default `ailogic-hub-principal`). |
| `OPENAI_API_KEY` | `wa-webhook.js` | Chave da OpenAI (só usada quando a IA for religada). |

> Os nomes `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` também são
> aceitos como fallback (`_auth.js` e `config.js`), embora o projeto **não** seja Next.js.

**Segredos:** `DB_URL`, `EVO_KEY`, `OPENAI_API_KEY` e a service_role key do Supabase
são secretos — só em env vars, nunca no repo. A `anon key` é pública por design.

---

## 6. Autenticação e RBAC

### Autenticação (`api/_auth.js`)

1. O front loga via Supabase (`supabase.auth.signInWithPassword`) e guarda a sessão
   em `localStorage` sob a chave `ailogic-auth`.
2. `auth.js` intercepta todo `fetch('/api/...')` e injeta `Authorization: Bearer <access_token>`.
3. No servidor, `requireAuth(req, res)`:
   - lê o Bearer token;
   - valida chamando o GoTrue: `GET {SUPABASE_URL}/auth/v1/user`;
   - se inválido → `401`.

### RBAC (escopo por imobiliária)

`requireAuth` resolve o **contexto** do usuário e retorna:

```js
{ user, authId, email, perfil, imobiliariaId, isAdmin }
```

- **perfil / imobiliariaId**: buscados na tabela `usuarios` por `auth_user_id`
  (fonte de verdade), com fallback para `user.user_metadata` (`perfil`, `imobiliaria_id`).
- **isAdmin**: `true` se `perfil ∈ {admin, administrador, diretor, diretoria, dono, owner, super}`.

**Regras aplicadas nas APIs de dados:**

| Ação | Admin | Não-admin |
|---|---|---|
| `list` | vê tudo | só `where imobiliaria_id = <escopo>` (para `imobiliarias`, `where id = <escopo>`). Sem escopo → lista vazia. |
| `save` | qualquer | força `imobiliaria_id = <escopo>`; só edita registro do próprio escopo; para `imobiliarias`, só edita a própria e não cria nova. |
| `delete` | qualquer | só apaga registro do próprio escopo (checagem antes de excluir). |
| funil (`dash.js`) | tudo | `where imobiliaria_id = <escopo>`; `move` só em cartão do escopo. |

> Usuário autenticado **sem** `imobiliariaId` e sem perfil admin **não vê nenhum dado** (padrão seguro). É preciso vincular o usuário (perfil + imobiliária) para ele operar.

### Vincular um usuário a uma imobiliária

Duas formas (a primeira é a recomendada):

1. Preencher `usuarios.auth_user_id` com o `id` do usuário no Supabase Auth, com
   `imobiliaria_id` e `perfil` na mesma linha.
2. Ou definir no Supabase Auth o `user_metadata`:
   `{ "perfil": "corretor", "imobiliaria_id": "<uuid>" }`.

---

## 7. APIs (serverless)

Todas em `/api`. Respostas em JSON. Todas (menos `config` e `wa-webhook`) exigem auth.

### `GET /api/config`
Pública. Devolve `window.HUB_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY }` como
JavaScript (carregado via `<script src="/api/config">` no `<head>` das telas).

### `/api/data` — CRUD genérico
Query: `?ent=<entidade>&action=<list|save|delete>`.

**Entidades** (`ent` → tabela):

| ent | tabela | escrita? |
|---|---|---|
| `imobiliarias` | `imobiliarias` | sim |
| `imoveis` | `imoveis` | sim |
| `corretores` | `usuarios` | sim |
| `leads` | `leads` | sim (create/update) |
| `fontes` | `fontes_lead` | **read-only** |
| `negocios` | `negocios` | **read-only** |
| `agenda` | `atividades` | **read-only** |
| `contratos` | `contratos` | **read-only** |

- **`list`** (GET): `{ rows: [...] }`, já filtrado por RBAC. Tabelas com soft-delete
  (`imobiliarias`, `imoveis`, `usuarios`, `leads`, `negocios`) trazem só `deleted_at is null`.
- **`save`** (POST, body JSON): insere (sem `id`) ou atualiza (com `id`). Cada entidade
  tem mapeamento próprio; imóveis usam `MAP_TIPO/MAP_FIN/MAP_ST` para converter rótulos
  bonitos (“Apartamento”, “Venda”, “Disponível”) nos enums do banco. Campos extras do
  formulário vão para a coluna `extra jsonb`.
- **`delete`** (POST `{id}`): hard-delete. Para `imobiliarias`, bloqueia se houver imóveis
  ou corretores vinculados.

Cada linha é serializada por um *formatter* (`imobOut`, `imovOut`, `corOut`, `leadOut`,
`fonteOut`, `negOut`, `atividadeOut`, `contratoOut`).

### `/api/dash` — dashboard e funil
- **default** (GET): `select dados from hub_dashboard where chave='principal'` → objeto
  agregado (contém `funil.etapas`, `funil.kpis`, etc.). *Observação: é um agregado; hoje
  não é recalculado — o front calcula os KPIs a partir de `/api/data`.*
- **`?action=funil`** (GET): cartões do kanban a partir de `funil_negocios` (escopo RBAC).
- **`?action=move`** (POST `{id, etapa}`): atualiza a etapa de um cartão (escopo RBAC).

### `/api/wa` — WhatsApp (Evolution)
Query `?action=...`:

| action | método | descrição |
|---|---|---|
| `status` | GET | status do canal |
| `connect` | GET | inicia pareamento (QR/pairing code) |
| `disconnect` | DELETE→ | encerra a instância |
| `zerar` | GET | reinicia o corte de espelhamento (`espelho_desde`) |
| `chats` | GET | lista conversas reais (exclui grupos) |
| `messages` | GET `&jid=` | histórico de uma conversa |
| `send` | POST `{jid,text}` | envia mensagem ao cliente |
| `config` | GET | lê config da IA (`ia_ativa`, `ia_persona`, `ia_allowlist`) |
| `config-save` | POST | salva persona/ativação da IA |

### `/api/wa-webhook` — entrada de mensagens
Recebe eventos `messages.upsert` do Evolution. **Não** exige auth (é o Evolution quem chama).
Contém a lógica de resposta por IA (OpenAI), porém há uma **trava global**:

```js
const IA_RESPOSTA_DESLIGADA = true; // webhook nunca responde automaticamente
```

Para religar a IA: mudar para `false` (a resposta então respeita `ia_ativa` + allowlist no banco).

### `/api/disparo` — cron
Agendado no `vercel.json` (`0 10 * * *`, 10h UTC). Envia uma mensagem inicial idempotente
via Evolution. Suporta `?dry=1` para simular sem enviar.

---

## 8. Banco de dados

PostgreSQL (Supabase). ~23 tabelas no schema `public`. Principais:

| Tabela | Papel |
|---|---|
| `imobiliarias` | imobiliárias parceiras (nome, creci, cidade, lat/lng, `extra`, soft-delete) |
| `usuarios` | corretores/usuários (`auth_user_id`, `imobiliaria_id`, `perfil`, soft-delete) |
| `imoveis` | catálogo (tipo, finalidade, status, preço, endereço, lat/lng, `extra`, soft-delete) |
| `imovel_midia` | fotos dos imóveis |
| `leads` | leads (status, `fonte_id`, `responsavel_id`, score, soft-delete) |
| `fontes_lead` | origens de lead (canal) |
| `lead_transicoes`, `lead_responsavel_historico` | histórico de leads |
| `negocios` | negócios (valor, comissão, `rlor`, `etapa_funil`, `fechado_em`, soft-delete) |
| `funil_negocios` | visão desnormalizada dos cartões do kanban |
| `negocio_comentarios`, `negocio_advogado` | apoio a negócios |
| `atividades` | agenda (título, tipo, início, fim, concluída) |
| `contratos` | contratos/assinatura (d4sign, `status_assinatura`, `assinado_em`, `url_assinado`) |
| `conversas_whatsapp`, `mensagens`, `templates_whatsapp`, `canais_whatsapp` | WhatsApp |
| `hub_dashboard` | agregado do dashboard (`chave`, `dados jsonb`) |
| `regras_distribuicao` | regras de distribuição de leads |
| `consentimentos_lgpd` | consentimentos LGPD |
| `log_auditoria`, `notificacoes` | auditoria e notificações |

**Convenções**
- Colunas escalares + coluna `extra jsonb` para campos livres do formulário.
- Soft-delete via `deleted_at` (nas tabelas marcadas acima).
- Quase toda tabela de negócio tem `imobiliaria_id` (base do RBAC).

---

## 9. Front-end

### Padrão de tela
Cada `<tela>.html` é **autossuficiente**: `<head>` com scripts de auth + `<style>` próprio
+ `<body>` com sidebar e conteúdo + `<script>` controlador no fim.

Ordem dos scripts no `<head>` (importa):
```html
<script>try{document.documentElement.setAttribute('data-theme',localStorage.getItem('ailogic_theme')||'light')}catch(e){}</script>
<script src="/api/config"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/auth.js"></script>
<script>/* gate legado por localStorage */</script>
```

### `auth.js` (carregado em todas as telas)
- **Tema:** aplica `data-theme` (claro/escuro) e expõe `window.hubTheme.{get,set,toggle}` (persistido em `ailogic_theme`).
- **Interceptor de fetch:** anexa `Authorization: Bearer <token>` a toda requisição `/api/`; em `401`, redireciona para `/login`.
- **Gate:** sem sessão → redireciona para `/login`.
- **Sessão:** `hubAuth.signIn/signOut`, `hubAuth.token()`.
- **Perfil na sidebar:** `paintUser()` pinta nome/perfil/iniciais do usuário logado.

### Tema (claro/escuro)
CSS via variáveis. Cada tela declara `:root { ...claro... }` e
`:root[data-theme="dark"] { ...escuro... }`. O botão de tema (`#themeToggle`) chama
`hubTheme.toggle()` e troca o ícone SVG (sol/lua) via `syncIcon()`.

### Componentes recorrentes
- **Shell:** `.app` (grid `262px 1fr`), `.sidebar` (navy, fixa), `.main` (rolagem interna).
- **KPIs:** cartões `.kpi` com `<div class="value" data-k="chave">` preenchidos por `kset()`.
- **Tabela:** `.table-wrap > table`, cabeçalho sticky, linha clicável → modal de detalhe.
- **Modais:** `.modal-bg.open` (detalhe e, no CRUD, formulário).
- **Kanban (funil):** colunas `.kcol` com cartões arrastáveis (HTML5 drag-and-drop).

### Telas por estágio
- **Reais (com dados):** `visaogeral`, `imobiliarias`, `corretores`, `pessoas`, `leads`,
  `funil`, `agenda`, `whatsapp`, `imoveis`, `mapa`, `captacao`, `assinaturas`,
  `financeiro`, `relatorios` (+ `config-ia`).
- **CRUD real:** `imoveis`, `imobiliarias`, `corretores`.
- **Em construção (estado honesto):** `credito`, `locacao`, `anuncios`, `site`,
  `integracoes`, `suporte`, `emails`, `administrador`, `insights`.

---

## 10. Fluxos principais

**Login →** `login.html` chama `hubAuth.signIn` → Supabase → sessão em `localStorage` → `/visaogeral`.

**Listar dados →** tela chama `fetch('/api/data?ent=X&action=list')` → `auth.js` injeta o token
→ `data.js` valida, aplica RBAC e retorna `{rows}` → tela renderiza KPIs/tabela.

**Criar/editar (CRUD) →** formulário monta objeto → `POST /api/data?ent=X&action=save`
→ recarrega a lista.

**Mover no funil →** arrastar cartão → `POST /api/dash?action=move {id,etapa}`.

**WhatsApp →** `chats`/`messages` (leitura), `send` (envio otimista no front). IA de resposta desligada.

**Criar lead a partir do WhatsApp →** botão na conversa → `POST /api/data?ent=leads&action=save`.

---

## 11. Deploy

- Push para `main` no GitHub (`jhonattanitiuba-cmd/ailogichub-demo`) → Vercel faz o deploy.
- `vercel.json`:
  - `cleanUrls: true` (URLs sem `.html`), `trailingSlash: false`;
  - redirect `/` → `/visaogeral`;
  - cron `/api/disparo` diário às 10h UTC.
- No Hobby, o limite é 12 funções serverless; hoje são ~7 (`data, dash, wa, wa-webhook, disparo, config, _auth`).
- Após alterar env vars, é preciso **novo deploy** para valerem.

---

## 12. Desenvolvimento local

Como é HTML estático + funções, o jeito mais fiel é o **Vercel CLI**:

```bash
npm i -g vercel      # ou npx vercel
vercel dev           # sobe front + /api com as env vars do projeto
```

Para as funções rodarem localmente é preciso um `.env` (gitignored) com as variáveis
da seção 5. Para testes pontuais de auth, basta `SUPABASE_URL` + `SUPABASE_ANON_KEY`
(as rotas de dados exigem também `DB_URL`).

> Sem `vercel dev`, abrir os HTML direto (`file://`) não funciona: as chamadas `/api/*`
> não existem.

---

## 13. Como adicionar uma nova tela

1. **Duplicar** uma tela existente do mesmo tipo (ex.: `leads.html` para listagem;
   `imoveis.html` para CRUD) — herda shell, tema, modais e o toggle.
2. Ajustar título, itens do menu e os `data-k` dos KPIs.
3. No controlador (`<script>` no fim), trocar a entidade e os campos.
4. **Se precisar de uma entidade nova** no `/api/data`:
   - criar um formatter (`xOut`) em `data.js`;
   - adicionar em `TABLE`, `OUT` e, se tiver soft-delete, em `SOFT`;
   - se for só leitura, adicionar em `READONLY`.
5. Garantir que a tabela tenha `imobiliaria_id` (para o RBAC funcionar) ou tratar o caso.
6. Manter o padrão de **estado vazio honesto** (sem números fictícios).

---

## 14. Segurança

- **Auth obrigatória** em todas as rotas de dados; token validado no GoTrue.
- **RBAC no servidor** — o front nunca é fonte de verdade de permissão.
- **Segredos** só em env vars; `.env` e `hub-config.js` são gitignored.
- **Webhook** (`wa-webhook`) é público por necessidade; valida o formato do evento e
  ignora grupos/bots/mensagens próprias.
- **IA de resposta desligada** por padrão (`IA_RESPOSTA_DESLIGADA = true`).

**Recomendações**
- Habilitar TLS na conexão do Postgres quando o servidor suportar (hoje `ssl: false`).
- Rotacionar chaves periodicamente e sempre que houver suspeita de exposição.
- Vincular cada usuário à sua imobiliária/perfil para o RBAC valer na prática.

---

## 15. Limitações e pendências

- **`ssl: false`** na conexão do Postgres (conexão sem TLS) — revisitar.
- **Hardcodes no WhatsApp** (`wa.js`, `disparo.js`): nomes/números de teste (Jhonattan,
  Alessandro) ainda no código — mover para configuração.
- **IA de resposta desligada** — religar de forma controlada quando desejado.
- **`hub_dashboard`** é um agregado estático; os KPIs reais são computados no front a
  partir de `/api/data`. Um recálculo server-side pode ser adicionado.
- **9 telas “Em construção”** aguardam fonte de dados (Crédito, Locação, Anúncios, Site,
  Integrações, Suporte, E-mails, Administrador, Insights).
- **`login.html` e `config-ia.html`** funcionam, mas não seguem o tema global claro/escuro.
- **`hub.css`** é legado; as telas reconstruídas trazem CSS próprio (tema-aware).

---

*Última revisão desta doc: acompanha o estado do `main`. Ao evoluir a plataforma,
mantenha este arquivo atualizado — é a referência para quem chegar depois.*
