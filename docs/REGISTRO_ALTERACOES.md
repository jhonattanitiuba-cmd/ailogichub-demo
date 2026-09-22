# Registro de alterações - AILogic Hub

Documento vivo. Cada rodada de trabalho adiciona uma entrada aqui, com o que mudou,
por que, os arquivos tocados e o commit correspondente. Uso interno (a pasta docs
e arquivos .md não vão para produção pela Vercel, ver .vercelignore).

Convenção de escrita: português do Brasil, sem travessão e sem til solto; acentos normais preservados.

---

## Rodada 44 - Bloco B completo (B3 a B9)

Fecha o Bloco B do roadmap da reuniao de 21/09. Cada item seguiu a risca o pedido.

- B3 - Vinculo de pessoas na criacao de negocio (sem recadastro):
  - imoveis.html: o botao "Gerar negocio" agora abre um seletor para buscar uma pessoa (lead) ja
    cadastrada e vincular ao negocio, ou gerar sem vinculo.
  - api/dash.js (novo): aceita lead_id, valida o escopo (mesma imobiliaria do imovel) e grava o
    vinculo (lead_id) e o nome no card. Nova coluna funil_negocios.lead_id (idempotente).

- B4 - Documentos anexaveis nos cards (contrato, proposta, ficha de visita, outro):
  - api/dash.js: endpoints docs (listar), doc_add e doc_del; guardados em funil_negocios.documentos
    (jsonb). O arquivo sobe pelo upload existente (/api/data?action=upload, aceita PDF/imagem).
  - funil.html: no detalhe do negocio, secao de documentos (lista + anexar por tipo + remover) e um
    selo com a contagem de documentos no card.

- B5 - Corretor autonomo com edicao + cores do funil por perfil:
  - api/dash.js (move): o corretor autonomo (self) passa a poder mover/editar os proprios cards,
    seja pela imobiliaria ou por ser o responsavel (corretor_nome).
  - api/dash.js (novo): grava o perfil do responsavel no card (corretor_perfil). funil.html: a borda
    do card ganha cor por perfil (autonomo, corretor, gestor, diretoria, juridico) com legenda.

- B6 - Gestor autoriza agendar na agenda de outro corretor:
  - corretores.html: checkbox "Pode criar compromissos na agenda de outros corretores" (grava em
    usuarios.extra.agenda_outros). api/_auth.js expoe a permissao no escopo (agendaOutros).
  - api/data.js (agenda save): criar evento para outro corretor exige ser gestor/admin ou ter a
    permissao liberada; senao bloqueia com aviso.

- B7 - Disponibilidade de visitas estilo Booking:
  - imoveis.html: no cadastro do imovel, dias da semana + horario (das/ate) + duracao do slot,
    mostrados tambem no detalhe. api/data.js: endpoint slots (disponibilidade + horarios ocupados);
    agenda save bloqueia horario ja ocupado do imovel (conflito de visita). Nova coluna
    atividades.imovel_id (idempotente).
  - agenda.html: nas visitas, seletor de imovel e um aviso com a disponibilidade e os horarios ja
    ocupados; envia imovel_id no compromisso.

- B8 - Botao "solicitar parceria" no site:
  - vitrine.html: para o usuario logado no Hub, botao "Solicitar parceria" no detalhe do imovel.
  - api/dash.js: endpoint parceria cria um card no funil da imobiliaria DONA do imovel, com origem
    "Parceria (site)" e o nome do solicitante.

- B9 - Auto-preenchimento por CEP:
  - imoveis.html: ao digitar o CEP, preenche endereco, bairro, cidade e pontos de referencia via
    ViaCEP (sem sobrescrever o que ja estiver preenchido). Campo "Pontos de referencia" adicionado.

Validacao: sintaxe do backend e dos scripts das paginas ok; testes no navegador (API mockada) para
B3 (seletor + payload), B4 (painel de documentos), B5 (cores por perfil + legenda), B7 (seletor de
imovel na agenda + slots) e B8 (botao so para logado + payload). B9 usa o ViaCEP (rede do navegador).
Observacao: os inserts/updates que dependem das novas colunas foram validados por sintaxe e testes
mockados; o comportamento contra o banco real deve ser conferido pelo cliente.

---

## Rodada 43 - Bloco B (B1 e B2): codigo automatico do imovel e gerar negocio a partir do imovel

- api/data.js (B1): ao cadastrar um imovel sem codigo, o sistema gera um codigo automatico no
  formato PREFIXO-NUMERO (ex.: AP-1001 para apartamento, CA para casa, SL para sala comercial,
  LF loft, CO cobertura, TE terreno, GP galpao, IM os demais). A numeracao comeca em 1000 e sobe
  por imobiliaria, com verificacao de unicidade. Vale tambem para a importacao em lote. Quem
  informar um codigo manualmente continua com o codigo informado.
- api/dash.js (B2): novo endpoint POST /api/dash?action=novo cria um card de negocio no funil a
  partir de um imovel (le titulo, codigo, preco e imobiliaria do imovel; entra na primeira etapa
  do funil configurado, com origem "Hub"). Respeita o escopo: usuario que nao e diretoria so gera
  negocio de imovel da propria imobiliaria.
- imoveis.html (B2): no detalhe do imovel, botao "Gerar negocio" que chama o endpoint acima e, ao
  concluir, oferece ir direto ao funil.

Por que: itens B1 e B2 do Bloco B do roadmap. B1 valida sozinho; B2 validado no navegador com API
mockada (botao visivel, payload correto, sem erros de pagina). O insert real no funil_negocios
ainda deve ser testado pelo cliente com o banco real.

---

## Rodada 42 - Bloco A (A4): edicao restrita ao criador, gestor e diretoria

- api/data.js: os cadastros de imoveis e de contatos (leads) passam a gravar o autor (criado_por).
  Na edicao, so podem editar: quem criou o registro, o gestor da imobiliaria (perfil gerente ou o
  gestor_id da imobiliaria) e a diretoria. Registros antigos sem autor nao sao bloqueados
  (retrocompatibilidade), e em erro de infra nao bloqueia. O insert de leads tem fallback caso a
  tabela nao tenha a coluna extra, para nao travar a criacao.

Por que: item A4 do Bloco A (regra escolhida: criador + gestor + diretoria). A5 (ocultar itens do
menu) ficou de fora por decisao do cliente (manter o menu como esta por enquanto).

Com isto o Bloco A esta concluido: A1 (login), A2 (status Ativo), A3 (cores do funil), A4 (edicao por
autor) e A6 (CEP/IPTU/condominio). A5 dispensado.

---

## Rodada 41 - Bloco A do roadmap (parte 1): login, status, funil e campos do imovel

- login.html (A1): removida a lista de e-mails corporativos pre-carregada no campo de login.
- imobiliarias.html (A2): status "Ativo" adicionado (alem de Implantando e Pausado); a edicao
  passa a respeitar o status salvo.
- funil.html (A3): a etapa final (Fechamento) ganhou destaque verde e a de Perdido ficou vermelha,
  para nao confundir as duas pontas do funil.
- imoveis.html (A6): novos campos CEP, IPTU e Condominio no cadastro do imovel (aparecem tambem no
  detalhe). Guardados junto do imovel; preparam o auto-preenchimento por CEP (B9).

Por que: primeiros itens do Bloco A do roadmap da reuniao de 21/09. Validado no navegador: login sem
a lista, status Ativo salvando, cores do funil e CEP/IPTU/condominio no cadastro.

---

## Rodada 40 - Lembretes da agenda: aviso de compromisso atrasado (vencido)

- hub.js: alem do lembrete de aproximacao, o motor agora avisa os compromissos VENCIDOS (passaram da
  hora e continuam pendentes). Toast vermelho com "Venceu ha X" e o selo Atrasado; avisa uma vez por
  compromisso, so para eventos dos ultimos 30 dias. Quando ha muitos, mostra um resumo ("N
  compromissos atrasados") em vez de varios toasts.

Por que: pedido para tambem notificar quando o compromisso estiver vencido. Validado no navegador: um
compromisso pendente com hora passada dispara o aviso de atrasado.

---

## Rodada 39 - Correcao: horario do compromisso deslocava ao salvar (fuso)

- agenda.html (comb): a data e hora digitadas (locais) eram enviadas como texto sem fuso e o banco
  interpretava como UTC, deslocando o horario (ex.: 20:43 virava 17:43, 3h a menos no Brasil). Agora o
  formulario monta o instante a partir da data e hora locais e envia em ISO (com fuso), entao o
  horario salvo e exibido bate com o que foi digitado.

Por que: o cliente relatou "coloco um horario, quando salva ele muda". Validado no navegador com o
fuso de Sao Paulo: digitar 20:43 salva e exibe 20:43.

---

## Rodada 38 - Lembretes da agenda: alerta na tela antes do compromisso

- hub.js: novo motor de lembretes (roda em todas as telas do Hub). A cada 60s verifica os
  compromissos da agenda e, quando um se aproxima da data/hora, mostra um alerta na tela (toast no
  canto superior) com o titulo, quanto falta e botoes "Ver na agenda" e "Ok". Se o navegador
  autorizar, dispara tambem uma notificacao do sistema. Nao repete o mesmo aviso (dedupe por evento).
- agenda.html: a pessoa configura a antecedencia. No cabecalho, "Lembrete padrao" (desligado, no
  horario, 15 min, 30 min, 1 hora, 2 horas, 1 dia). No formulario do compromisso, "Lembrar antes"
  por evento (ou usar o padrao). Ao definir um lembrete, pede permissao de notificacao do sistema.

Detalhe tecnico: a preferencia fica guardada no navegador (por dispositivo). O alerta aparece
enquanto o Hub esta aberto; a notificacao do sistema, quando autorizada, aparece mesmo com a aba em
segundo plano. Validado no navegador: com lembrete de 30 min, um compromisso proximo dispara o toast.

Por que: pedido de um sistema de notificacao mostrando na tela quando um evento da agenda chega a
data, com a antecedencia configuravel pela pessoa.

---

## Rodada 37 - Agenda: card de compromisso mais claro (data e hora separadas)

- agenda.html: no formulario de compromisso, os campos Inicio e Fim deixaram de ser um so campo
  datetime e viraram dois campos cada: Data (dd/mm/aaaa) e Hora (HH:MM, com os dois pontos), com
  rotulos claros "Inicio (data e hora)" e "Fim (data e hora)". Tamanhos ajustados.
- O rodape com o botao Salvar agora fica fixo (sticky) no rodape do card, entao o Salvar continua
  visivel e acessivel mesmo com o seletor de hora aberto (util no celular).
- O salvamento junta data+hora automaticamente; exige a data de inicio.

Por que: o card de editar compromisso estava confuso; pedido para separar data e hora, ajustar
tamanhos e manter o Salvar a mao ao informar a hora. Validado no navegador: edicao abre com data e
hora separadas, rodape fixo, e salva juntando os dois.

---

## Rodada 36 - Pessoas e Contatos: editar e buscar imoveis pelo interesse

- pessoas.html: coluna Acoes com botao "Editar" (abre o formulario ja preenchido e salva) e botao
  "Buscar imoveis". No detalhe da pessoa, mostra o Interesse e traz "Buscar na imobiliaria" e "Buscar
  no site", que usam o texto do interesse como busca.
- imoveis.html: passou a aceitar ?q= na URL (alem do ?codigo= que ja existia), pre-preenchendo a busca.
- vitrine.html: passou a aceitar ?q= na URL, abrindo direto o grid filtrado pelo termo.
- api/data.js (update de leads): telefone e email agora usam coalesce, para a edicao nao apagar o
  contato quando o editor ve os campos mascarados (lead com contato restrito).

Como funciona a busca: a partir da pessoa, "Buscar na imobiliaria" abre a tela de Imoveis filtrada
pelo interesse; "Buscar no site" abre a vitrine publica filtrada pelo mesmo termo.

Quem cadastra: os leads entram sozinhos pelo Sam (site e WhatsApp) e, manualmente, pela tela de
Pessoas (Diretoria, gestor da imobiliaria ou corretor, cada um no seu escopo).

Por que: pedido para editar pessoas e para acionar a busca de imoveis conforme o interesse escrito.

---

## Rodada 35 - Pessoas e Contatos: botao para inserir manualmente

- pessoas.html: a tela era so de consulta (listava os leads, sem como inserir). Agora tem o botao
  "Nova pessoa" com formulario (nome, imobiliaria, telefone, e-mail, interesse), que cadastra na base
  de leads (ent=leads). Recarrega a lista apos salvar. Valida nome e imobiliaria obrigatorios.

Por que: com o banco zerado, era preciso um caminho manual para inserir pessoas/contatos (antes so
entravam pelo Sam). Validado no navegador: abre o formulario, salva com os campos certos e a pessoa
aparece na lista.

---

## Rodada 34 - Remocao do "Em Breve" do sistema

- hub.js: removida a injecao do item "Em Breve" na barra lateral (aparecia em todas as telas).
  Agora a sidebar nao mostra mais esse atalho.
- embreve.html: a pagina virou um redirecionamento para /visaogeral, para nao deixar 404 caso
  alguem tenha o link salvo. As outras ocorrencias de "em breve" (placeholder de foto, dicas de
  tela) sao textos legitimos e foram mantidas.

Por que: pedido do cliente para tirar a parte "Em Breve" do sistema.

---

## Rodada 33 - Site: destaque de imoveis, blindagem da tela Imobiliarias e roteiro de teste

- Vitrine de destaques (Tela 3 do site): a diretoria marca "Destaque no site" no cadastro do imovel
  (imoveis.html) e esses imoveis aparecem primeiro na secao de imoveis do site publico (site.html),
  com o selo "Destaque". Ordenacao: destaque, depois com foto, depois maior valor. api/vitrine.js
  passou a expor o campo destaque. Assim o cliente controla a "selecao dos melhores imoveis".
- imobiliarias.html: blindagem do carregamento. A requisicao tem timeout de 12s e nunca deixa a tela
  presa em "Carregando"; em falha, mostra "Nao foi possivel carregar... Tentar novamente" e zera os
  indicadores. Corrige o comportamento do print enviado pelo cliente.
- docs/ROTEIRO_TESTE_JORNADA.md: roteiro guiado de ponta a ponta para a equipe rodar, com o que fazer
  e o que conferir em cada etapa, mais a checagem transversal de reaproveitamento de dados (nenhuma
  etapa deve exigir recadastro do mesmo negocio) e a lista de atencao a bugs.

Por que: itens da fase de consolidacao pedidos apos a leitura da conversa dos ultimos dias. O ajuste
de tamanho de fonte das telas 1 e 2 do site depende dos prints, que ainda nao chegaram. Validado no
navegador: destaque sobe ao topo com selo, e a tela Imobiliarias cai em estado de erro com "tentar
novamente" em vez de travar.

---

## Rodada 32 - Consolidacao da jornada: visita exige CRECI e assinatura Google explicita

- api/data.js (save de agenda): visita atribuida a corretor sem CRECI e bloqueada (estagiario nao faz
  visita). Vale na criacao e na edicao; quando nao ha responsavel a validar ou em erro de infra, nao
  bloqueia. Mensagem clara orientando atribuir a um corretor habilitado ou cadastrar o CRECI.
- juridico.html: novo bloco "Assinatura pelo Google Workspace eSignature" com os 3 passos (gerar,
  assinar no Google, anexar aqui) e textos do anexo apontando o Google Workspace, deixando o fluxo
  imediato de assinatura explicito para o time.
- docs/AUDITORIA_JORNADA.md: mapa da jornada ponta a ponta com estado por etapa e gargalos priorizados
  (P0 SERVICE_ROLE_KEY e bucket privado de documentos; P1 visita sem CRECI e e-mail transacional).

Por que: inicio da fase de consolidacao (concluir e testar a jornada antes de funcao nova). Estes dois
itens de codigo nao dependem de acesso externo. Assinatura ponta a ponta em producao ainda aguarda a
SERVICE_ROLE_KEY na Vercel.

---

## Rodada 31 - Financeiro: tabela de comissoes do cliente (Bloco 4, controle financeiro)

- api/dash.js (fechamento do funil): a comissao deixou de ser 5% fixo e passou a seguir a tabela
  definida pelo cliente: 6% em compra e venda; primeiro aluguel (1x o valor do negocio) em locacao e
  temporada. Le a finalidade do imovel vinculado ao negocio. Preserva a comissao ja gravada (so
  calcula quando estava vazia); afeta apenas fechamentos novos, nada e reescrito no historico.
- financeiro.html: as comissoes (KPIs "Comissao prevista" e "Receita realizada", coluna da tabela,
  detalhe e divisao de repasse) passam a usar a mesma regra, com a finalidade do imovel. Quando o
  negocio ja tem comissao registrada, esse valor e mantido. Nova barra "Tabela de comissoes" no topo
  da lista, mostrando 6% (compra e venda) e 1o aluguel (locacao) para o time.

Por que: item "controle financeiro" do Bloco 4, sem depender de terceiros. Os demais itens do bloco
(cartao de credito, integracao bancaria, portais externos) seguem dependendo de provedor ou de
reuniao. Validado no navegador: venda a 6%, locacao e temporada a 1 aluguel, comissao gravada
preservada, e os totais (valor, comissao, receita, ticket) batendo.

---

## Rodada 30 - Agenda: visoes Dia e Semana (estilo calendario)

- agenda.html: o seletor de visao passou de "Calendario / Lista" para "Dia / Semana / Mes / Lista".
  A visao de Mes (o calendario que ja existia) e a Lista continuam iguais.
- Visao Dia: mostra os compromissos do dia escolhido em ordem de horario, com hora de inicio e fim,
  tipo, imobiliaria e status (Concluido, Atrasado ou Pendente). Setas para dia anterior/proximo e
  botao Hoje. Clicar em um item abre o detalhe.
- Visao Semana: sete colunas (Dom a Sab) com o dia da semana e o numero do dia; a coluna de hoje fica
  destacada. Cada compromisso aparece como uma etiqueta com o horario. Setas para semana
  anterior/proxima e botao Hoje. Clicar na etiqueta abre o detalhe; clicar na coluna abre o novo
  compromisso ja com a data daquele dia.

Por que: dar ao time visoes de curto prazo (o dia e a semana) alem do panorama do mes, no estilo de
uma agenda de calendario, para os testes. Sem dependencia externa, sem mexer no backend. Validado no
navegador as quatro visoes, a navegacao (dia, semana, mes) e a abertura de detalhe pela etiqueta.

---

## Rodada 24 - Funil: volta o Perdido e a Visita na imobiliaria (ajustes do cliente)

- Diretoria (10): ..., Fechamento, Pesquisa, Perdido (voltou a coluna Perdido).
- Imobiliaria e Corretor (9): Atendimento, Envio de imoveis, Visita, Proposta, Documentacao,
  Contrato, Pagamentos, Fechamento, Perdido (voltou Visita, que faltava, e Perdido).
- Juridico (6): mantido (Proposta assinada, Documentacao, Contrato, Pagamentos, Fechamento,
  Assinatura de escritura). Regra de negocio: "Assinatura de escritura" so se aplica a compra e
  venda; locacao encerra em Fechamento (a coluna existe, so os negocios de venda a usam).

Com o Perdido de volta, o seletor de motivo de perda volta a funcionar nas visoes comercial.
Testado com Playwright. Deploy: subido para producao.

---

## Rodada 23 - Funil: quatro visoes definitivas por perfil (sequencias exatas do cliente)

Sequencias fechadas pelo cliente (exatas, sem adicionar nem tirar):
- Diretoria (9): Atendimento, Envio de imoveis, Visita, Proposta, Documentacao, Contrato,
  Pagamentos, Fechamento, Pesquisa.
- Imobiliaria e Corretor (7, mesma): Atendimento, Envio de imoveis, Proposta, Documentacao,
  Contrato, Pagamentos, Fechamento. (sem Visita e sem Pesquisa)
- Juridico (6): Proposta assinada, Documentacao, Contrato, Pagamentos, Fechamento,
  Assinatura de escritura.

Implementacao (api/dash.js): DEFAULT_ETAPAS_HUB/IMOB/JURIDICO; loadEtapas(scope, view) escolhe
por view; a acao funil calcula view = hub|juridico|imob (juridico usa o escopo dos negocios
atribuidos ao advogado). "Fechamento" usa a chave 'fechado' (reflete no financeiro/ganho).
funil.html: ETLBL ganhou proposta_assinada e escritura. Testado com Playwright (9/7/6 colunas
na ordem certa). Deploy: subido para producao.

Pendencias sinalizadas ao cliente:
- Nenhuma visao tem coluna "Perdido": sem ela nao ha como marcar negocio perdido nem usar o
  seletor de motivo de perda. Aguardando decisao (manter/como tratar perdas).
- Imobiliaria/Corretor sem a etapa "Visita" (conforme enviado); a confirmar se e intencional.
- Juridico "ativa apos proposta assinada": as etapas ja estao certas; o gatilho de so entrar
  apos a assinatura vem junto da integracao de assinatura digital.

---

## Rodada 22 - Correcao do funil do Hub (sequencia definida pelo cliente)

O cliente corrigiu a sequencia do Hub. Novo funil do Hub (admin):
Atendimento, Envio de imoveis, Visita, Proposta, Documentacao, Contrato, Pagamentos,
Finalizacao, Pesquisa, e Perdido (mantida no fim para negocios perdidos + seletor de motivo).

- api/dash.js: DEFAULT_ETAPAS_HUB reescrito com essa sequencia. "Finalizacao" usa a chave
  'fechado' (continua refletindo no financeiro/ganho). "Pesquisa" e etapa nova (pos-venda).
- funil.html: KPI "Fechados" passa a contar a etapa de fechamento por rotulo (finaliz) e pela
  chave 'fechado'; ETLBL ganhou 'pesquisa'.
Testado com Playwright (10 colunas na ordem certa; KPI Fechados conta Finalizacao).
Deploy: subido para producao.

Observacao: o funil da imobiliaria segue como estava (termina em Fechado/Perdido, sem Pesquisa).
A confirmar com o cliente se a visao da imobiliaria deve ficar igual a do Hub.

---

## Rodada 21 - Funil com duas visoes (Hub x imobiliaria), conforme a ata

A ata define duas sequencias de funil. Implementadas como padroes por perfil (ainda editaveis
pelo botao "Editar etapas" por escopo):

- Diretoria (admin) -> funil do Hub (14 etapas): Novo lead, Qualificação por IA, Lead qualificado,
  Distribuído, Aceito em atendimento, Visita, Reunião, Proposta, Negociação, Documentação,
  Contrato, Fechado, Pós-venda, Pedido recusado.
- Imobiliaria (gestor/comercial/corretor) -> funil da imobiliaria (9 etapas): Atendimento,
  Envio de imóveis, Visita, Proposta, Documentação, Contrato, Pagamentos, Fechado, Perdido.

Implementacao:
- api/dash.js: DEFAULT_ETAPAS_HUB e DEFAULT_ETAPAS_IMOB; loadEtapas escolhe o padrao pelo isAdmin
  quando nao ha customizacao salva (deixou de herdar o 'global' para a imobiliaria, para as visoes
  ficarem distintas). Chaves reaproveitadas dos cards atuais para nao perder nada; o backend ja
  cria coluna para qualquer etapa presente nos cards.
- funil.html: o rotulo enviado pelo servidor (por visao) tem prioridade; ETLBL virou fallback com
  rotulos amigaveis e acentuados para colunas que venham so com a chave crua.

Compatibilidade: fechamento (fechado), perdido e o seletor de motivo continuam funcionando nas
duas visoes (chaves fechado/perdido preservadas). Testado com Playwright (HUB mostra 14 colunas,
IMOB 9, distribuido some como "Distribuído" no Hub e "Envio de imóveis" na imobiliaria; card em
etapa fora da visao aparece com rotulo amigavel). Deploy: subido para producao.

Arquivos: api/dash.js, funil.html.

---

## Rodada 20 - Hotfix: coluna direita do funil cortava o conteudo dos paineis

Sintoma (visto em producao): os paineis da coluna direita do funil (Resumo operacional,
Motivos de perda) apareciam so com o titulo e o conteudo cortado/sobreposto. Agravado pela
adicao do painel "Gargalo do funil".

Causa: .side e um flex column com overflow-y:auto, mas os paineis tinham flex-shrink padrao
(1) e overflow:hidden. Quando o conteudo passava da altura, o flexbox encolhia os paineis e o
overflow:hidden cortava, em vez de a coluna rolar.

Correcao (funil.html, CSS): .side>.panel{flex:0 0 auto} (paineis nao encolhem; a coluna rola).
Validado com Playwright (nenhum painel corta conteudo; print isolado mostra os 5 paineis
completos).

Arquivo: funil.html. Deploy: subido para producao.

---

## Rodada 19 - Bloco 2: locacao online (parametros + guardrail do valor minimo)

Primeiro item do nucleo imobiliario (Bloco 2). Extende a proposta publica do imovel para
locacao e liga o valor minimo do imovel a uma classificacao automatica da oferta.

- imovel.html: quando o imovel e de Locacao, a proposta mostra Prazo do contrato (12/30 meses)
  e Garantia (Calcao / Seguro fianca). Envia esses campos e mostra ao cliente uma mensagem
  generica de margem (dentro da faixa / abaixo do esperado) SEM revelar o piso do proprietario.
- api/proposta.js: recebe prazo/garantia/finalidade; busca o valor_minimo do imovel pelo codigo
  e classifica a oferta em 'dentro' | 'abaixo' | 'sem_referencia' (guardrail para a IA/time
  negociarem dentro da margem). Grava tudo no extra da proposta e devolve so a classificacao.
  A listagem autenticada passa a incluir o extra.
- propostas.html: nova coluna "Margem" mostrando Dentro da faixa (verde) / Abaixo do minimo
  (ambar) e, embaixo, prazo e garantia da locacao.

Testado com Playwright (selects de locacao aparecem, POST leva os campos, mensagem de margem
generica, coluna Margem na tela do time). Deploy: precisa promover em producao.
Observacao: a negociacao automatica da IA (ida e volta) fica para uma proxima etapa; aqui
entregamos a captura estruturada + o guardrail que impede aceitar abaixo do minimo.

Arquivos: imovel.html, api/proposta.js, propostas.html.

---

## Rodada 27 - Bloco 2: Area do Cliente (acompanhamento por link magico)

O cliente acompanha as propostas dele sem senha, por um link magico enviado pelo time.

- api/proposta.js: tabela cliente_acesso (guarda so o HASH do token + validade 30 dias, escopo
  por lead/whatsapp/imobiliaria). Acao publica "area" valida o token (com rate limit) e devolve
  SO os dados daquele cliente: nome + propostas (imovel, valor, status amigavel, prazo/garantia).
  Acao autenticada "area_link" gera o token e devolve a url + um link de WhatsApp pronto; escopada
  por imobiliaria (admin gera de qualquer, os demais so da propria).
- area.html (nova pagina publica, mobile-first): le o token da url, mostra a saudacao, a lista de
  propostas com status (Recebida, Em analise, Aceita, Nao seguiu) e um botao "Falar com o time".
  Trata link invalido/expirado. noindex.
- propostas.html: botao "Enviar acesso" por proposta -> gera o link e abre o WhatsApp do cliente
  ja com a mensagem.
Seguranca: so o hash do token vai ao banco; o retorno e escopado ao cliente do token; rate limit.
Testado com Playwright (area renderiza propostas/status, link expirado, botao gera area_link).
Deploy: subido para producao. Nao adiciona funcao serverless (reusa proposta.js; area.html e estatica).

Proximas ondas da Area do Cliente (nao nesta): favoritos, chat com juridico e com o assistente,
e a etapa da negociacao em linguagem do cliente.

---

## Rodada 26 - Bloco 2: documento de autorizacao do proprietario (obrigatorio para publicar)

Regra da reuniao: nenhum imovel pode ser publicado sem a autorizacao de divulgacao assinada
pelo proprietario.

- api/data.js: acao upload passa a aceitar application/pdf (alem de imagens), limite 12MB.
  No save de imovel, quando o status e "Disponivel" (publicar), exige extra.autorizacao_url/ok;
  senao bloqueia com mensagem clara. Em update, preserva a autorizacao existente se o cliente
  nao reenviar. Salvar como Reservado/Inativo (rascunho) continua liberado sem autorizacao.
- imoveis.html: campo "Autorizacao de divulgacao do proprietario (obrigatoria para publicar)"
  no cadastro (PDF ou imagem), com status (anexada + link "ver" / pendente). No salvar, sobe o
  arquivo antes e vincula ao imovel; carrega a autorizacao existente ao editar.
Testado com Playwright (campo aparece, upload chamado, autorizacao_url vai no save; sem erro).
Deploy: subido para producao.

---

## Rodada 25 - Bloco 2: Fase 1 da assinatura (anexar contrato assinado no Hub)

Permite fechar o ciclo de assinatura usando a assinatura do Google (ou qualquer PDF assinado),
sem contratar provedor pago agora.

- api/juris.js: nova acao anexar_assinado. Recebe o PDF assinado (base64), sobe para o Supabase
  Storage (bucket imoveis, caminho contratos/<negocioId>/<rand>.pdf) e faz upsert em contratos
  (status_assinatura='assinado', assinado_em=now, url_assinado). Permissao: diretoria ou o
  advogado do caso. casos passou a devolver url_assinado.
- juridico.html: botao "Anexar assinado" por caso (vira "Substituir" quando ja ha um), link
  "Ver assinado" e o badge muda para Assinado. Upload por seletor de PDF (max 12MB).
Testado com Playwright (botao dispara o seletor; POST leva negocioId + PDF; sem erros).
Deploy: subido para producao.

Fluxo (Fase 1): o Hub gera o contrato -> a pessoa envia para assinatura pelo Google Drive ->
volta assinado -> anexa aqui no caso do juridico -> fica registrado como Assinado com o PDF.

Ponto de atencao (hardening futuro, LGPD): hoje o PDF vai para o bucket publico (caminho
aleatorio, dificil de adivinhar, mas sem controle de acesso). Para contratos assinados o ideal
e um bucket privado com URL assinada de curta duracao. Recomendado migrar quando priorizarmos
seguranca de documentos.

---

## Rodada 29 - Bloco 3: filtros e ordenacao de corretores (com/sem CRECI, alfabetica, recentes)

- corretores.html: novos filtros na toolbar. Filtro CRECI (Com e sem / Com CRECI / Sem CRECI =
  estagiario) e ordenacao (Ordem alfabetica / Cadastros recentes). O padrao passa a ser alfabetico.
  A diferenciacao com/sem CRECI ja existia (estagiario sem CRECI, com corretor responsavel).
- api/data.js: corOut passa a devolver created_at (para ordenar por recentes).
Testado com Playwright (default A-Z; filtro sem CRECI mostra so estagiario; com CRECI ordenado;
recentes por data desc). Deploy: subido para producao.

Observacao (follow-up): a regra "estagiario sem CRECI nao realiza visitas" sera aplicada no
guard da agenda quando fizermos a agenda dia/semana/mes.

---

## Rodada 28 - Bloco 3: importacao de imoveis em lote (CSV)

Onboarding mais rapido: sobe varios imoveis de uma planilha (dor operacional citada na reuniao).

- api/data.js: acao bulk (ent=imoveis) insere ate 300 imoveis por vez, escopada por imobiliaria
  (admin escolhe a imobiliaria; os demais na propria). Entram como status Inativo (rascunho),
  entao o time revisa e publica cada um anexando a autorizacao (nao fura a regra do Bloco 2).
  Retorna inserted/total/erros. Aceita application/pdf ja estava no upload; aqui e so JSON.
- imoveis.html: botao "Importar planilha" abre um modal com selecao da imobiliaria, link "Baixar
  modelo CSV" e upload do arquivo. Parser de CSV proprio (sem biblioteca): detecta separador
  virgula ou ponto-e-virgula, trata aspas, cabecalho flexivel (titulo, codigo, tipo, finalidade,
  preco, area, quartos, suites, banheiros, vagas, cidade, bairro, endereco, descricao, com/sem
  acento). Mostra quantos serao importados e o resultado.
Testado com Playwright (CSV ; do Excel, 2 imoveis lidos, POST com as linhas, resultado ok).
Deploy: subido para producao. Sem nova funcao serverless.

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

## Rodada 18 - Bloco 1: filtro por tipo (residencial/comercial) em Imoveis

imoveis.html: novo filtro de categoria (Residencial x Comercial) na toolbar, ao lado do de
finalidade (Venda/Locacao = compra/locacao, ja existente). Categoria derivada do tipo do imovel
(robusto a rotulo ou chave). Cobre "filtros por tipo (residencial, comercial ou compra)" do
pedido. Testado com Playwright. Deploy: precisa promover em producao.

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
