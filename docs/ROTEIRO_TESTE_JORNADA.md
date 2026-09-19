# Roteiro de teste guiado da jornada - AILogic Hub

Para a equipe rodar de ponta a ponta e anotar os gargalos. Cada passo tem "o que fazer" e "o que
conferir". Marque OK ou anote o problema (print ajuda muito). Uso interno.

Convencao de escrita: portugues do Brasil, sem travessao e sem til solto; acentos normais preservados.

## Antes de comecar (preparacao)
- Entrar no Hub com um usuario de Diretoria.
- Ter ao menos uma imobiliaria cadastrada e ativa.
- Ter ao menos um corretor COM CRECI e um SEM CRECI (para testar a regra de visita).
- Observacao de acesso: a assinatura em producao depende da SUPABASE_SERVICE_ROLE_KEY estar setada
  na Vercel. Se ainda nao estiver, o passo 7 (anexar assinado) vai acusar "armazenamento indisponivel".

## Passo 1. Entrada do lead (site publico + Sam)
- Fazer: abrir o site publico, usar a busca do Sam e pedir um imovel (ex.: "apartamento 3 quartos").
- Conferir: o Sam responde, sugere imoveis reais e o contato vira um lead dentro do Hub (tela Leads).
- Conferir (destaque): na secao de imoveis do site, os marcados como "Destaque no site" aparecem
  no topo, com o selo Destaque.

## Passo 2. Atendimento e o lead no Hub
- Fazer: abrir o lead gerado, atribuir a um corretor.
- Conferir: o telefone e os documentos do lead ficam ocultos para imobiliaria e corretor ate a visita
  concluida ou o contrato assinado (protecao de contato).

## Passo 3. Imovel (cadastro, autorizacao e destaque)
- Fazer: cadastrar (ou abrir) um imovel; tentar publicar como "Disponivel".
- Conferir: sem a autorizacao do proprietario anexada, o sistema NAO deixa publicar.
- Fazer: anexar a autorizacao e publicar.
- Fazer: marcar "Destaque no site" e salvar.
- Conferir: o imovel aparece em destaque no site publico (passo 1).

## Passo 4. Visita (regra do CRECI)
- Fazer: criar uma visita na Agenda atribuida ao corretor SEM CRECI.
- Conferir: o sistema bloqueia com a mensagem de que corretor sem CRECI nao faz visita.
- Fazer: criar a visita atribuida ao corretor COM CRECI.
- Conferir: agora salva normalmente e aparece na Agenda (testar as visoes Dia, Semana, Mes e Lista).
- Conferir: apos a visita, o contato do lead deixa de ficar oculto (passo 2).

## Passo 5. Proposta
- Fazer: registrar uma proposta para o imovel (na locacao, informar prazo 12 ou 30 meses e a garantia).
- Conferir: se a oferta for abaixo do valor minimo do proprietario, o sistema sinaliza "abaixo do
  minimo" sem nunca mostrar o piso ao cliente.
- Conferir: a proposta aparece na tela de Propostas com a margem.

## Passo 6. Documentacao e contrato (Jurídico)
- Fazer: atribuir um advogado ao negocio no Jurídico.
- Conferir: o caso mostra o bloco "Assinatura pelo Google Workspace eSignature" com os 3 passos.
- Conferir: as etapas do funil do Jurídico seguem a ordem definida (proposta assinada, documentacao,
  contrato, pagamentos, fechamento, assinatura de escritura so em compra e venda).

## Passo 7. Assinatura (Google Workspace eSignature, Fase 1)
- Fazer: assinar o contrato no Google Workspace e clicar em "Anexar assinado" no caso, escolhendo o PDF.
- Conferir: o caso passa a mostrar o selo "Assinado" e o link "Ver assinado".
- Se acusar "armazenamento indisponivel": falta a SERVICE_ROLE_KEY na Vercel (registrar e seguir).

## Passo 8. Fechamento e financeiro
- Fazer: mover o negocio para "Fechamento" (ganho) no funil.
- Conferir: o negocio reflete no Financeiro como ganho, com a comissao pela tabela (6% em compra e
  venda; primeiro aluguel na locacao).
- Conferir: KPIs do Financeiro (valor em negocios, comissao prevista, receita, ticket) batem.

## Passo 9. Area do Cliente
- Fazer: gerar o link de acesso do cliente (na tela de Propostas, "Enviar acesso") e abrir o link.
- Conferir: o cliente ve as propostas dele e os status, sem precisar de senha.

## Checagem transversal: reaproveitamento de dados (nao recadastrar)
Ao longo dos passos 2 a 9, conferir que NENHUMA etapa pede recadastrar dados que ja existem:
- O negocio criado a partir do lead ja traz o lead, o imovel e a imobiliaria vinculados.
- A proposta usa os dados do negocio (nao pede redigitar cliente e imovel).
- O caso no Jurídico usa o negocio (valor, comissao, partes) sem recadastro.
- O contrato e a Area do Cliente reaproveitam o que ja foi informado.
- Anotar qualquer tela que obrigue a digitar de novo algo que o sistema ja tem.

## Lista de atencao (bugs a confirmar)
- Tela Imobiliarias: conferir que carrega a lista (ou mostra "Nenhuma"/"Tentar novamente"), nunca
  ficando presa em "Carregando".
- Qualquer tela que fique em "Carregando" sem sair: anotar qual e o horario (ajuda a achar a causa).

## Como reportar
Para cada problema: em qual passo aconteceu, o que esperava, o que aconteceu, e um print. Isso vira a
lista de correcao antes de liberar para uso amplo.
