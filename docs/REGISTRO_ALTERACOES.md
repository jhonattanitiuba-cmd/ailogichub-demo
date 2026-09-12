# Registro de alterações - AILogic Hub

Documento vivo. Cada rodada de trabalho adiciona uma entrada aqui, com o que mudou,
por que, os arquivos tocados e o commit correspondente. Uso interno (a pasta docs
e arquivos .md não vão para produção pela Vercel, ver .vercelignore).

Convenção de escrita: português do Brasil, sem travessão e sem til solto; acentos normais preservados.

---

## Estado atual (resumo rápido)

- No ar (produção, branch main): login e permissões por perfil, cadastro de imóveis,
  atendimento do Sam no WhatsApp com geração de lead, curadoria com estoque real,
  proposta honesta no site, agenda do corretor corrigida, switch de atendimento público,
  higiene de erros (500 sem vazamento mais logs) e rate limit no cadastro público.
- Chave do go-live (a virar quando decidir abrir para o público): no painel WhatsApp,
  botão Treinar, ligar "Atendimento público (responder qualquer número)" e Salvar.
- Congelado para depois do go-live: unificação funil e negócios (P0-10, item 05).
- Depende de configuração do time (fora do código): SUPABASE_SERVICE_ROLE_KEY, SMTP do Supabase,
  política de backup do Postgres (item 06); decisão do provedor de assinatura digital (item 07).

---

## Rodada 5 - Higiene de segurança (parte 2): rate limit no cadastro público

Commit: 1f75254

- api/_cache.js: novo helper rateAllow (INCR mais EXPIRE atômico), com degradação segura (fail-open):
  sem Redis pronto ou em qualquer erro, retorna allowed=true e nunca barra usuário legítimo.
- api/parceria.js: limita a 5 envios por IP a cada 10 minutos (429 quando excede), usando
  x-forwarded-for. Protege o único endpoint público de escrita contra flood, além do honeypot
  que já existia. Log de erro adicionado no catch.

Por que: a vistoria apontou ausência de rate limit no /api/parceria (risco de spam e abuso de insert).

---

## Rodada 4 - Higiene de segurança (parte 1): erros e observabilidade

Commit: 045f93b

- api/data.js, api/dash.js, api/wa.js, api/juris.js: as respostas 500 deixaram de devolver
  a mensagem interna crua ao cliente (info disclosure) e passaram a retornar mensagem genérica;
  o detalhe vai para console.error no servidor.
- api/wa-webhook.js e api/disparo.js: log de erro no servidor; corpo passou a "erro interno"
  (os callers são Evolution e cron, não o navegador).
- api/vitrine.js, api/sam-web.js, api/copilot.js: adicionado console.error nos catches,
  mantendo a resposta amigável já existente.

Por que: a vistoria apontou vazamento de e.message nos 500 e ausência total de logs em api/.
Formato das respostas preservado; nenhuma tela mudou de comportamento.

---

## Rodada 3 - Chave do go-live: atendimento público da IA

Commit: 5abb9ba

- api/wa.js (action config-save): passou a gravar ia_allowlist via a flag ia_publica, somente
  para admin. true grava ["*"] (responde qualquer número, go-live); false grava [] (não responde
  números novos automaticamente). Persona, ativa e tools seguem iguais para os demais perfis.
- whatsapp.html (drawer Treinar): novo switch "Atendimento público (responder qualquer número)",
  lê o estado de ia_allowlist (ligado quando contém '*') e envia ia_publica ao salvar.

Por que: o go-live do Sam para clientes reais dependia de abrir a allowlist da IA, que só existia
no banco. Agora é um clique do admin, com rollback imediato (desligar o switch), sem SQL manual.

---

## Rodada 2 - P0-04: Sam gera lead no CRM

Commit: fc0411a

- api/wa-webhook.js:
  - imobiliariaHub(): resolve a imobiliária central que recebe os leads do WhatsApp
    (env HUB_IMOBILIARIA_ID, senão imobiliária com extra.hub=true, senão a mais antiga).
  - garantirLead(): cria ou vincula o lead da conversa de forma idempotente por telefone dentro
    da Hub, grava origem=whatsapp e remote_jid no extra, e liga ia_atendimento.lead_id (jid para lead).
  - enriquecerLead(): a cada mensagem do cliente atualiza ultimo_contato, guarda o interesse
    (primeira mensagem substantiva) e sobe o score por sinais de intenção. Sem custo de IA extra.
  - Ligado no fluxo de DM logo após marcarEntrada, dentro de try/catch (não afeta a resposta).

Por que: o funil nascia vazio porque o Sam só conversava, nada virava lead estruturado.
Decisões tomadas com o time: o lead nasce numa imobiliária Hub central (o time roteia pelo inbox)
e é criado já no primeiro contato, enriquecido ao longo da conversa.

Observação operacional: em modo teste, a IA só responde os números da allowlist, então só esses
geram lead. Ao abrir "Atendimento público", passa a valer para todos.

---

## Rodada 1 - Correções P0-05, P0-06, P0-07

Commit: eed4aed

- api/wa-webhook.js e api/sam-web.js (P0-05): removido o piso de preço fixo (venda maior ou igual a
  700000, locação maior ou igual a 4000) que escondia parte do estoque do Sam. Agora oferece todo o
  portfólio disponível, ordenado por preço desc nulls last.
- api/data.js, save de agenda (P0-06): corretor ou autônomo (self) sem responsável informado assume
  a si mesmo, senão o próprio compromisso sumia da lista dele (filtrada por responsavel_id).
- imovel.html (P0-07): removida a mensagem falsa "proposta registrada" e o link de assinatura
  automática que não existia. Agora valida nome e WhatsApp, gera o contrato timbrado para
  conferência e faz o handoff real da proposta ao time pelo WhatsApp.

Por que: três bugs de alta severidade da verificação profunda, todos correção interna sem
dependência externa. Validado no navegador o fluxo da proposta.

---

## Trabalho anterior (contexto)

Antes desta fase de correções de go-live, já estavam no ar (commit f637817 e anteriores):
aba "Em Breve", vistoria de segurança Fase 0 e 1, performance Fase 2, permissões por perfil
(menu, acesso e home, isolamento por imobiliária), novas logos, Marketing 360 ligado ao Hub,
página de LGPD e privacidade com consentimento, e endpoint /api/health para monitor de uptime.

---

## Backlog (pendente, por risco)

- Médio, precisa janela de teste: guardScreen sem fail-open em auth.js (hoje, se /api/me falha,
  o menu some mas a tela abre por URL direta; os dados seguem protegidos pelo RBAC do servidor).
- Maior risco, não recomendado em cima do go-live: ativar a CSP em modo enforce (vercel.json),
  hoje em modo de relato. Pode quebrar scripts inline; exige testar página a página.
- Congelado para pós go-live: unificação funil e negócios com fechado_em e histórico (P0-10).
- Com o time (fora do código): SUPABASE_SERVICE_ROLE_KEY, SMTP do Supabase, política de backup
  (item 06); decisão do provedor de assinatura digital, que destrava contrato e documentação
  (P0-08 e P0-09, item 07).
