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
- Autenticação: o backend valida o access_token LOCALMENTE (HS256, via segredo JWT),
  sem depender do /auth/v1/user do provedor (que estava devolvendo 400). Depende da
  env var SUPABASE_JWT_SECRET configurada na Vercel (Production e Preview).
- Chave do go-live (a virar quando decidir abrir para o público): no painel WhatsApp,
  botão Treinar, ligar "Atendimento público (responder qualquer número)" e Salvar.
- Congelado para depois do go-live: unificação funil e negócios (P0-10, item 05).
- Depende de configuração do time (fora do código): SUPABASE_SERVICE_ROLE_KEY, SMTP do Supabase,
  política de backup do Postgres (item 06); decisão do provedor de assinatura digital (item 07).

---

## Rodada 17 - Bloco 1: motivo de perda detalhado no funil

Ao mover um card para Perdido/Recusado, o funil agora pede o motivo (lista padrao:
Preco fora do perfil, Comprou com concorrente, Desistiu, Sem credito, Imovel indisponivel,
Localizacao, Cliente nao respondeu, Fora do perfil de renda, Outro, com campo de detalhe).
O motivo alimenta o painel "Motivos de perda" e o relatorio.

- funil.html: seletor askMotivo() no drop em etapa perdida; envia body.motivo no move.
- api/dash.js (move): grava funil_negocios.motivo_perda ao entrar em Perdido/Recusado e limpa
  ao sair dessa etapa. Sanitiza para 200 chars.
Testado com Playwright (drag para Perdido abre o seletor; move carrega o motivo escolhido).
Deploy: precisa promover em producao.

---

## Rodada 16 - Bloco 1: metricas no ranking, gargalo do funil e valor minimo do imovel

Tres itens do Bloco 1, todos testados com Playwright (sem erro de pagina).

1) Metricas no ranking (funil.html, computePanels): o Ranking por imobiliaria passa a mostrar,
   por imobiliaria, o valor movimentado, numero de negocios, fechados, visitas e atendimentos,
   ordenado por valor (depois fechados, depois numero). Calculo no cliente a partir dos cards.

2) Gargalo do funil (funil.html): novo painel "Gargalo do funil" que mostra a concentracao de
   negocios por etapa e aponta a maior queda entre etapas consecutivas (onde os negocios travam),
   com nota explicando de qual etapa para qual e o percentual. Ajuda a gerar leitura de gargalo
   sem depender de relatorio externo.

3) Valor minimo do imovel (imoveis.html + api/data.js): campo "Valor minimo aceito pelo
   proprietario" no cadastro do imovel. Persiste no jsonb extra (sem migracao de banco) e volta
   pelo imovOut; aparece no detalhe. E o piso para a futura negociacao da IA (Bloco 2).

Arquivos: funil.html, imoveis.html. (data.js ja gravava o extra; nada a mudar la.)
Deploy: precisa promover em producao.

---

## Rodada 15 - Bloco 1 do roadmap: seguranca juridica (protecao do contato do lead)

Origem: reuniao de 15/09. Regra do cliente: imobiliaria e corretor NAO podem ver telefone,
e-mail ou documento do lead antes da visita (ou do contrato). Risco de processo e de bloqueio
no WhatsApp por contato direto indevido. Foi o primeiro item priorizado do Bloco 1.

Parte A - restricao de contato no backend (api/data.js):
- Constante REVELAR_CONTATO_EM (env, padrao 'visita'; alternativa 'contrato').
- maskContato(): zera telefone/e-mail e remove campos sensiveis do jsonb extra; marca
  contato_restrito=true e contato_libera_em.
- leadsLiberadosSet() (uma consulta) e podeRevelarContato(leadId): a "porta" e a VISITA
  registrada (atividade tipo visita concluida ou ja passada) ou, no modo 'contrato', um
  contrato assinado do negocio do lead.
- list de leads para nao-admin mascara cada lead que ainda nao passou pela porta. As respostas
  de save e assign de lead tambem mascaram. A diretoria (isAdmin), operadora do Hub, ve tudo.
- Ponto unico: a tela Pessoas e Contatos tambem e montada a partir de leads, entao fica
  protegida junto. O funil (dash) nao serve telefone, entao nao vazava.
- Ao salvar/concluir uma visita (agenda), invalida o cache de leads para liberar na hora.

Parte B - guarda na persona do Sam (api/_persona.js):
- Regra critica: nunca compartilhar telefone/e-mail/documento do cliente com corretor,
  imobiliaria ou terceiros antes da visita; se pedirem o contato pelo WhatsApp, recusar com
  educacao e avisar do risco de bloqueio e de LGPD, orientando a seguir pelo Hub.

Front (aviso claro, sem vazar dado): leads.html e pessoas.html mostram "Restrito ate a visita"
no lugar do telefone/e-mail quando contato_restrito. Testado com Playwright (label aparece no
lead restrito, contato do lead liberado continua visivel, sem erro de pagina).

Deploy: precisa promover em producao. Config opcional na Vercel: REVELAR_CONTATO_EM='contrato'
para liberar so apos o contrato assinado (padrao atual: apos a visita).

Arquivos: api/data.js, api/_persona.js, leads.html, pessoas.html.

---

## Rodada 14 - Validacao da Fase 2 do funil (propagacao de fechamento para negocios)

Objetivo: confirmar, com dados reais, que ao mover um card vinculado para a etapa "Fechado"
o negocio correspondente (tabela negocios) e marcado como GANHO.

Verificacoes feitas no banco (Supabase):
- enum negocio_etapa contem: LEAD, CONTATO, VISITA, PROPOSTA, NEGOCIACAO, FECHAMENTO, GANHO,
  PERDIDO. Confirma que o rotulo GANHO usado no codigo (ENUM_GANHO) e valido.
- Rodado o UPDATE exato que api/dash.js executa na acao move (card -> Fechado, com negocio_id),
  no negocio de teste 4b8304fd (card do Bruno Dias, 5aff6c6c): retornou etapa_funil=GANHO,
  comissao mantida em 90000.00 (coalesce nao sobrescreve valor existente) e fechado_em carimbado.
  Resultado conforme esperado.
- Teste revertido em seguida (negocio de volta para CONTATO, card para qualif_ia): base limpa.

Conclusao: a logica de propagacao esta correta contra o schema real. O disparo automatico
(o app chamar esse UPDATE quando o card entra em Fechado) esta implementado e revisado em codigo
(api/dash.js, acao move, campos won && negocio_id). Teste ponta a ponta pela interface (arrastar o
card e ver propagado:true no request move) fica disponivel para conferencia visual quando desejado.

Nenhuma alteracao de codigo nesta rodada (so validacao). Sem commit de codigo.

---

## Rodada 13 - INCIDENTE: 401 em massa (o /auth/v1/user do provedor recusava tokens validos)

Contexto: mesmo apos resolver a Rodada 12 (deploys voltaram a subir), o sistema continuou
mostrando 0 em tudo e 401 em todas as APIs.

Diagnostico (ferramenta temporaria criada e depois removida):
- Pagina /diag.html + /api/me?diag=token + /api/config?diag=1 mostraram, no navegador do usuario:
  servidor alcanca o GoTrue (health 200), anon key valida (settings 200), o cliente ENVIA o
  Authorization: Bearer, o token esta valido (nao expirado, sub/email/aud/role corretos, HS256),
  MAS o /auth/v1/user do Supabase self-hosted (cloudfy) responde HTTP 400 "Bad request" para
  esse token valido. Removendo a apikey da chamada o 400 persistia, entao a anon key nao era a causa.
- Conclusao: o endpoint /auth/v1/user do provedor esta quebrado para validar token. Como o
  backend validava TODA requisicao batendo nesse endpoint, tudo caia em 401.

Correcao (api/_auth.js):
- Validacao LOCAL do access_token (HS256) usando crypto nativo (createHmac + timingSafeEqual),
  a partir do segredo JWT em SUPABASE_JWT_SECRET (aceita tambem GOTRUE_JWT_SECRET / JWT_SECRET).
  Confere assinatura, exp e sub; monta o user ({id, email, user_metadata}) para o resolveScope.
- getUser tenta a verificacao local primeiro; se ha segredo e a assinatura nao bate, recusa; se
  nao ha segredo, cai no fallback antigo (/auth/v1/user). Sem dependencia nova (so crypto).
- Ganho extra: sem uma chamada de rede por requisicao, autenticacao ficou mais rapida.
- Acao do time (fora do codigo, ja feita): adicionar SUPABASE_JWT_SECRET nas env vars da Vercel
  (Production e Preview) com o "JWT Secret" do Supabase, e redeploy.

Limpeza (esta rodada, apos confirmar o sistema no ar):
- Removidos os diagnosticos temporarios: diag.html, o branch ?diag=token de api/me.js e o
  branch ?diag=1 de api/config.js. Mantida a correcao real e o log de recusa em _auth.js.

Verificacao: funil voltou a exibir 36 negocios e R$ 24.349.000 em pipeline; contatos e dashboard
carregando. Confirmado pelo usuario ("deu certo").

Arquivos: api/_auth.js (correcao), api/me.js e api/config.js (limpeza), diag.html (removido).

---

## Rodada 12 - INCIDENTE: deploys falhando (limite de 12 funcoes no Hobby)

Commit: (esta rodada)

Sintoma: app inteiro mostrando 0 (funil, pessoas, dashboard) e 401 em todas as APIs. Causa raiz
achada nos Deployments da Vercel: "No more than 12 Serverless Functions can be added to a Deployment
on the Hobby plan". O projeto chegou a 16 funcoes, entao TODO deploy falhava e o site ficou preso
num deploy antigo (varias entregas recentes nao estavam no ar de fato).

Correcao (reduzir de 16 para 12, sem perder nada que o usuario usa):
- api/persona.js -> api/_persona.js (era modulo compartilhado, nao rota; sai da contagem). require
  atualizado em wa-webhook.js.
- Removido api/disparo.js (cron legado de broadcast fixo) + bloco crons do vercel.json.
- Removido api/health.js (healthcheck de uptime; re-adicionar quando subir para Pro).
- Removido api/authcheck.js; o diagnostico de rede/cert foi dobrado em /api/config?diag=1.
- Mantidas as 12 rotas usadas: config, copilot, dash, data, juris, me, parceria, proposta,
  sam-web, vitrine, wa, wa-webhook.

Recomendacao: subir para o plano Vercel Pro (limite muito maior) para nao precisar cortar funcoes e
re-adicionar health/disparo. Enquanto isso, o Hobby fica exatamente no limite (12).

Observacao: o 401 sera reavaliado assim que o deploy passar, ja que o site estava preso em codigo
antigo. Diagnostico de rede/cert disponivel em /api/config?diag=1.

---

## Rodada 11 - Unificacao do funil, Fase 2 (propagacao ao financeiro, inerte ate o backfill)

Commit: (esta rodada)

- Inspecao do banco (Supabase) confirmou: enum negocio_etapa = LEAD, CONTATO, VISITA, PROPOSTA,
  NEGOCIACAO, FECHAMENTO, GANHO, PERDIDO (ganho = GANHO); negocios ja tem fechado_em e comissao;
  funil_negocios nao tem deleted_at; 9 de 36 cards casam com imovel por codigo.
- api/dash.js: ensureFunilExtras passa a criar tambem a coluna funil_negocios.negocio_id (aditivo).
  Na acao move, quando o card e ganho E tem negocio_id, propaga para o negocio:
  etapa_funil=GANHO, fechado_em (coalesce), comissao (coalesce, 5% default), escopado por id e
  deleted_at, dentro de try/catch (nunca quebra o move). Resposta inclui { fechado, propagado }.
- Fica INERTE ate o backfill preencher negocio_id (nenhum card tem vinculo por padrao). O backfill
  e o interruptor de ativacao, roda no Supabase (docs/MIGRACAO_FUNIL_FASE2.md, Passo 1). Reversao:
  update funil_negocios set negocio_id = null.
- docs/MIGRACAO_FUNIL_FASE2.md: atualizado para a realidade confirmada (so o backfill e manual;
  fechado_em ja existe; coluna criada pelo codigo; GANHO fixado no codigo).

Validação: syntax check; escrita nao destrutiva (coalesce) e escopada, so atualiza negocio existente
ja vinculado. A validacao ponta a ponta acontece apos o backfill, no ambiente com banco.

Ativacao: backfill rodado no Supabase em 14/09/2026, 9 cards vinculados (dos 36). A propagacao ao
financeiro dispara quando um desses cards for movido para Fechado. Reversao: update funil_negocios
set negocio_id = null.

---

## Rodada 10 - Unificacao do funil, Fase 1 (historico + fechado_em no card)

Commit: (esta rodada)

- api/dash.js: a acao move do funil passa a, alem de trocar a etapa:
  - garantir (aditivo, idempotente) a coluna funil_negocios.fechado_em e a tabela funil_historico
    (create/alter if not exists);
  - marcar fechado_em ao entrar numa etapa fechada (ganho), mantendo o primeiro carimbo, e limpar
    ao sair dela;
  - registrar o historico da movimentacao (etapa de/para, autor, quando), sem nunca quebrar o move.
  - nova acao historico (autenticada, escopada por imobiliaria) para ler a trilha de um card.
- Nao toca em negocios nem no financeiro. Etapa fechada = chave que comeca com "fechad" ou "ganho";
  "perdido" nao conta como fechado.

Esta e a metade segura da unificacao. A Fase 2 (ligar o funil aos negocios e alimentar
comissao/financeiro) exige migracao de banco e vai num documento separado para rodar no Supabase e
validar antes de ligar.

Validação: syntax check; a escrita segue o padrao aditivo ja usado (create/alter if not exists),
a ser confirmada de ponta a ponta no ambiente com banco.

---

## Rodada 9 - Tela de propostas (gestao pelo time)

Commit: (esta rodada)

- propostas.html (nova tela): lista as propostas recebidas (site e futuramente WhatsApp), com KPIs
  (total, novas, em andamento, fechadas), busca, filtro por status, troca de status inline e link
  de WhatsApp por linha. Mesmo padrao visual das demais telas.
- api/proposta.js: novas acoes autenticadas, alem do submit publico:
  - action=list (GET): lista as propostas escopadas por imobiliaria (admin ve todas), via requireAuth.
  - action=status (POST): atualiza o status (nova, em_andamento, fechada, descartada), com escopo por
    imobiliaria. Cria a tabela sob demanda se ainda nao existir.
- auth.js: 'propostas' adicionada a matriz de menu (gestor, comercial, corretor; admin ve tudo) e ao
  conjunto GUARDED (bloqueio de acesso direto por URL para quem nao pode ver).
- hub.js: injeta o item "Propostas" na sidebar de todas as telas (como Marketing 360 e Em Breve),
  gated pelo restrictMenu.

Validação: testado no navegador. Tela renderiza, KPIs e troca de status funcionam (POST correto);
o item de menu aparece para admin e gestor e fica escondido para financeiro (gating correto). A
leitura/escrita no banco segue o padrao ja usado (requireAuth + escopo por imobiliaria) e sera
confirmada de ponta a ponta no ambiente com banco.

---

## Rodada 8 - P0-07: proposta do site vira registro e lead no CRM

Commit: (esta rodada)

- api/proposta.js (novo endpoint público): recebe a proposta feita na página do imóvel e
  (1) registra numa tabela propostas (criada sob demanda, create table if not exists) e
  (2) gera ou vincula um lead na imobiliária Hub central (mesmo critério do WhatsApp, dedupe por
  telefone, origem proposta-site), para o funil não nascer vazio também pelo canal do site.
  Tem rate limit por IP (fail-open) e não concede acesso nem gera contrato assinado.
- imovel.html: o botão "Gerar proposta e contrato" passa a enviar a proposta ao endpoint de forma
  não bloqueante. Se o registro falhar, o fluxo atual segue igual (abre o contrato e o link de
  WhatsApp), então nada quebra para o cliente.

Validação: fluxo do front testado no navegador nos dois casos (endpoint ok e endpoint com erro):
em ambos o contrato abre e a mensagem honesta aparece; o envio é não bloqueante. A escrita no
banco segue o mesmo padrão já provado (parceria.js e o lead do WhatsApp) e será confirmada de
ponta a ponta no ambiente com banco.

---

## Rodada 7 - Documentação: análise da CSP e manual do time

Commit: (esta rodada, só documentos, sem mudança de código nem de produção)

- docs/ANALISE_CSP.md: diagnóstico completo para ativar a CSP em modo de bloqueio sem quebrar tela.
  Varredura das telas servidas em produção: o único bloqueador real é o Leaflet (mapa) carregado
  do unpkg em bemvindo.html; o resto ou é backup fora do deploy ou já passa. Traz a correção
  necessária (trocar o Leaflet para o cdn.jsdelivr, que já é liberado), a política proposta e o
  plano de ativação com reversão. Nada foi ligado: a CSP segue em Report-Only.
- docs/MANUAL_TIME_GOLIVE.md: manual dos itens que dependem do time (fora de código): a
  SUPABASE_SERVICE_ROLE_KEY no Vercel, o SMTP do Supabase, a política de backup e a escolha do
  provedor de assinatura digital. Cada um com o porquê, o passo a passo, como validar e um checklist.

Entregues também como PDF apresentável para repasse ao time.

---

## Rodada 6 - Segurança: guardScreen sem fail-open

Commit: b07f318

- auth.js (applyPerms): quando o /api/me falha, faz uma nova tentativa após 800ms (blip de rede) e,
  no fallback real, passa a bloquear o acesso direto por URL usando o perfil local, mas somente
  quando há um perfil conhecido no metadata. Sem perfil local, mantém o comportamento antigo
  (só esconde o menu, não redireciona) para nunca prender um admin sem perfil no metadata.
- Fecha a brecha em que, com o /api/me indisponível, o shell de uma tela fora do escopo abria
  por URL. Os dados já eram protegidos pelo RBAC do servidor; isto alinha o shell da interface.
- Redireciona sempre para a home do perfil (não entra em loop, pois a home está no escopo).

Validação: testado com navegador nos quatro cenários (servidor ok bloqueia; servidor falha com
perfil local bloqueia; servidor falha sem perfil local não prende; tela permitida permanece).

Observação: a CSP em modo enforce (o outro item de segurança) ficou para uma janela de teste
dedicada, por ser a de maior risco de quebrar scripts inline das telas.

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

- Maior risco, não recomendado em cima do go-live: ativar a CSP em modo enforce (vercel.json),
  hoje em modo de relato. Pode quebrar scripts inline; exige testar página a página.
- Congelado para pós go-live: unificação funil e negócios com fechado_em e histórico (P0-10).
- Com o time (fora do código): SUPABASE_SERVICE_ROLE_KEY, SMTP do Supabase, política de backup
  (item 06); decisão do provedor de assinatura digital, que destrava contrato e documentação
  (P0-08 e P0-09, item 07).
