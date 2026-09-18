# Auditoria da jornada ponta a ponta - AILogic Hub

Objetivo desta fase (decisão do cliente, reuniao noturna): antes de qualquer funcao nova,
ter uma versao realmente funcional entregando ponta a ponta o que foi prometido ao mercado.
Primeiro concluir, testar a jornada inteira e corrigir os gargalos; depois seguir.

Este documento mapeia cada etapa da jornada, o estado real no codigo e os gargalos, com
prioridade. E o checklist de "concluir e testar". Uso interno (a pasta docs nao vai para producao).

Convencao de escrita: portugues do Brasil, sem travessao e sem til solto; acentos normais preservados.

---

## A jornada prometida (a espinha)

Lead entra (site/vitrine + Sam) -> atendimento -> imovel -> visita -> proposta ->
documentacao -> contrato assinado -> pagamentos -> fechamento -> Area do Cliente.

## Estado por etapa

| Etapa | Onde vive | Estado | Observacao |
|---|---|---|---|
| 1. Lead entra (site + Sam) | vitrine.js, sam-web.js | Funciona | Sam atende com estoque real e gera lead. Testar volume. |
| 2. Atendimento e leads | data.js, leads.html | Funciona | Contato do lead protegido ate visita/contrato (Bloco 1). |
| 3. Imovel | data.js, imovel.html, imoveis.html | Funciona | Autorizacao do proprietario obrigatoria para publicar (Bloco 2). |
| 4. Visita | agenda (dia/semana/mes/lista) | Funciona | Gargalo P1: falta o bloqueio "estagiario sem CRECI nao faz visita". |
| 5. Proposta | proposta.js, propostas.html, imovel.html | Funciona | Prazo/garantia (locacao) e guardrail de valor minimo (Bloco 2). |
| 6. Documentacao e contrato | juris.js, juridico.html | Bloqueado em producao | Depende de SUPABASE_SERVICE_ROLE_KEY para anexar o assinado. |
| 7. Assinatura | juris.js (anexar_assinado) | Pronto (Fase 1) | Google Workspace eSignature: assina no Google e anexa o PDF. |
| 8. Pagamentos | funil (etapa), financeiro.html | Parcial | So a etapa do funil + confirmacao manual de repasse. Cobranca real e Bloco 4 (gateway), adiada. |
| 9. Fechamento | dash.js (move/fechamento) | Funciona | Propaga GANHO + comissao pela tabela do cliente (6% venda, 1o aluguel locacao). |
| 10. Area do Cliente | proposta.js (area/area_link), area.html | Funciona | Acesso por link no WhatsApp. E-mail depende de SMTP. |

---

## Gargalos priorizados (o que fechar antes do teste completo)

### P0 - destrava a jornada
1. **SUPABASE_SERVICE_ROLE_KEY na Vercel.** Sem ela, o anexo do contrato assinado (o passo do
   Google eSignature) e uploads em geral respondem "armazenamento indisponivel". Responsavel: Jhonattan.
2. **Bucket privado para documentos (LGPD).** Hoje o contrato assinado vai para um caminho publico
   do bucket `imoveis`. Contrato e proposta devem ficar em bucket privado com link assinado temporario.
   Acao: criar bucket `documentos` (Jhonattan) + trocar o codigo para gravar la e servir por URL assinada (eu).

### P1 - completa e da seguranca
3. **Bloqueio de visita para estagiario sem CRECI.** Regra operacional/juridica ja levantada. Acao: eu.
4. **E-mail transacional no ailogichub.com.br.** Ligar magic link por e-mail, avisos de proposta e os
   e-mails do Supabase Auth. Depende de provedor + credenciais SMTP + DNS (SPF/DKIM/DMARC). Definicao: Jhonattan.
5. **Textos da tela de assinatura** apontando "assinar no Google Workspace" para o passo ficar explicito. Acao: eu.
6. **Teste guiado de cada etapa com dados reais** (o "testar a jornada"): percorrer lead -> ... -> Area do
   Cliente com uma imobiliaria de teste e registrar o que quebra.

### P2 - depende de definicao ou de terceiro
7. **Pagamentos (cobranca real).** Precisa de gateway (Bloco 4). A etapa do funil e o controle de
   repasse existem; a cobranca automatica fica para depois da decisao de provedor.
8. **Backup e seguranca.** PITR, copia externa independente com versionamento, retencao de 5 anos
   (a confirmar com a Dra. Eliane), teste de restauracao. Arquitetura de infra: Jhonattan; ajustes de codigo: eu.
9. **Log de auditoria das operacoes sensiveis.** Ja existe o historico do funil; padronizar uma trilha
   unica das acoes sensiveis. Acao: eu, na consolidacao.

---

## O que depende de acesso (Jhonattan) x o que eu faco no codigo

Voce (acessos/infra): SERVICE_ROLE_KEY na Vercel; bucket privado `documentos`; provedor e credenciais
de e-mail + DNS do dominio; arquitetura de backup (Supabase PITR + copia externa).

Eu (codigo, sem depender de terceiro): bucket privado no fluxo de contrato assinado; bloqueio de visita
sem CRECI; textos do passo de assinatura Google; roteiro de teste guiado da jornada; trilha de auditoria.

---

## Ordem sugerida de execucao

1. Voce seta a SERVICE_ROLE_KEY (destrava assinatura e uploads).
2. Eu movo contrato assinado para bucket privado + link assinado (assim que o bucket existir).
3. Eu fecho os P1 de codigo (visita sem CRECI, textos da assinatura Google).
4. Rodamos o teste guiado da jornada de ponta a ponta e anotamos os gargalos reais.
5. Corrigimos o que o teste apontar.
6. So entao voltamos a funcao nova (restante do Bloco 3 e Bloco 4).
