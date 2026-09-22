# Roadmap de ajustes - reuniao de 21/09/2026

Base: ata da reuniao de 21 de setembro de 2026. Lista tudo que foi pedido, com o status atual (o que
ja esta pronto vem marcado como Feito) e o que fazer, com sugestoes. Uso interno.

Legenda: [Feito] pronto no ar | [Parcial] parte feita | [A fazer] | [Depende] de terceiro/material.

## 1. Ja entregue (do que a ata pediu)
- [Feito] Botao de inserir contato manual em Pessoas e Contatos (antes so entrava pelo Sam).
- [Feito] Busca de imoveis pelo interesse do contato (na imobiliaria e no site).
- [Parcial] Botao de editar em Pessoas (falta restringir a quem criou, item A4).
- [Feito] Agenda: alinhamento e tamanho da fonte.
- [Feito] Separadores de hora e minuto (Data e Hora separados, hora HH:MM).
- [Feito] Botao salvar fixo na criacao de compromisso.
- [Feito] Notificacoes/lembretes de compromissos com antecedencia configuravel (5, 10, 15, 30 min, 1h, 2h, 1 dia).
- [Feito] Aviso de compromisso atrasado (vencido).
- [Feito] Fotos sem limite no anuncio (upload multiplo + links).
- [Parcial] Remover do menu o nao operacional (Em Breve removido; varredura ampla no A5).
- [Feito] Limpeza dos dados de teste do banco (mantendo os logins).
- [Feito] Correcao do horario do compromisso que deslocava ao salvar (fuso).

## 2. Ajustes rapidos (novos pedidos, baixa complexidade)
- [A fazer] A1. Remover a lista de e-mails pre-carregada na tela de login.
- [A fazer] A2. Incluir status "Ativo" nas imobiliarias (hoje so Implantando/Pausado).
- [A fazer] A3. Cor da etapa final do funil diferente do Perdido (nao confundir as pontas).
- [A fazer] A4. Edicao restrita a quem criou (registrar o autor) em contatos e imoveis, mais diretoria.
- [A fazer] A5. Ocultar do menu lateral os modulos/telas ainda nao usados.
- [A fazer] A6. Campos CEP, IPTU e condominio (obrigatorios) no cadastro de imoveis.

## 3. Funcionalidades (media complexidade)
- [A fazer] B1. Codigo automatico do imovel por tipologia (AP, CA, SL) + numeracao sequencial; sugestao: prefixo por imobiliaria e numero inicial configuravel.
- [A fazer] B2. Botao "gerar negocio" na tela do imovel, criando o card no funil ja vinculado ao imovel e ao lead.
- [A fazer] B3. Busca/vinculo de pessoas dentro da criacao de negocio (sem recadastro).
- [A fazer] B4. Documentos (contrato, proposta, ficha de visita) anexaveis nos cards de negociacao.
- [A fazer] B5. Corretor autonomo com permissao de edicao; campos do funil diferenciados por cor conforme o perfil.
- [A fazer] B6. Permissao configuravel: gestor autoriza corretor a criar evento na agenda de outro corretor.
- [A fazer] B7. Disponibilidade de visitas estilo Booking (dias/horarios no imovel; agenda bloqueia horarios ocupados).
- [A fazer] B8. Botao "solicitar parceria" no site (usuario logado) gerando card no funil.
- [A fazer] B9. Auto-preenchimento por CEP (endereco + pontos de referencia).

## 4. Integracoes e infraestrutura (dependem de acesso/terceiro)
- [Depende] C1. E-mail automatico no dominio ailogichub.com.br (SMTP + DNS) para senha temporaria e avisos.
- [Depende] C2. Integracao direta com WhatsApp a partir dos cards (base Evolution ja existe).
- [Depende] C3. Varredura automatica do site CIRAG para extrair imoveis; sugestao: gerar CSV e usar a importacao em lote existente.
- [Depende] C4. Assinatura digital Fase 2 (API) - so se o volume exigir; Fase 1 (Google) ja atende; destrava total depende da SERVICE ROLE KEY.
- [Depende] C5. Backup e seguranca (retencao 5 anos, copia externa, versionamento).

## 5. Pesquisa e estrategia
- [Depende] D1. Analisar o Imobzi (videos/script) para replicar cards, dashboard e cadastros.
- [A fazer] D2. Reduzir custo de IA (Jeev/Ollama) em tarefas internas.
- [A fazer] D3. Visualizacao 360 (Street View) no imovel - passo futuro.
- [Depende] D4. Substituir ferramentas externas (funil de cotacao/dashboard de milhas) pelo Hub (reuniao com a Fran).

## 6. Vindos de atas anteriores (ainda pendentes)
- [A fazer] Rodizio de leads. [Parcial] Mapa por CEP para prospeccao. [Parcial] Planos/limite de corretores (hoje liberado).
- [Depende] SERVICE ROLE KEY na Vercel; modelos de contrato e clausulas de autorizacao.

## Ordem sugerida
1) A1..A6. 2) B1, B2, B3. 3) B4..B9. 4) C1..C5 conforme os acessos. 5) D1..D4 em paralelo.

## Depende de voces
- Jhonattan: SERVICE ROLE KEY na Vercel, provedor/SMTP do e-mail, arquitetura de backup.
- Alessandro: acesso ao Imobzi, prints dos dados de imoveis, modelos de contrato e autorizacao.
- Decisoes: manter planos liberados ou reativar limite de corretores; escopo do WhatsApp.
