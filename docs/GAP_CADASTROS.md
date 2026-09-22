# Gap de cadastros — Guia (Gabriel) x AILogic Hub

Comparação campo a campo entre o guia "Informações dos cadastros do Hub" e o que o Hub captura hoje,
com um plano de implementação por fases. Base: telas atuais (imoveis, corretores, imobiliarias,
pessoas/leads) e o backend (api/data.js, jsonb `extra`). Documento de trabalho; nada foi alterado no
código ainda.

Legenda: ✅ já existe · 🟡 parcial · ❌ falta · 🆕 entidade nova.

---

## 1. Imóvel

**Hoje temos:** título, imobiliária, código (automático), tipo, finalidade, status, preço, valor
mínimo (interno), área (útil), quartos, suítes, banheiros, vagas, CEP, IPTU, condomínio, cidade,
bairro, endereço, pontos de referência, disponibilidade de visitas (dias/horário/duração), fotos
(upload + capa + galeria), autorização de divulgação (PDF), destaque no site, descrição.

| Seção do guia | Situação | Observação |
|---|---|---|
| Identificação (código, finalidade, tipo) | ✅ | Falta **uso** (residencial/comercial/misto/rural), **subtipo** e vínculo a **condomínio/empreendimento** |
| Endereço | 🟡 | Tem CEP/logradouro/bairro/cidade/referência. Falta **número, complemento, unidade, bloco/torre, lote/quadra, UF, nível de endereço divulgável** |
| Áreas e cômodos | 🟡 | Tem área útil e cômodos. Falta **área privativa/construída/total/terreno separadas, unidade (m²/ha), fonte da metragem, andar, total de andares** |
| Características | ❌ | Falta **mobiliado/semi/vazio, itens inclusos, ar-condicionado, varanda, acessibilidade, posição solar, vista, acabamento, conservação, ano de construção/reforma, tipo de vaga** |
| Condomínio (detalhado) | ❌ | Falta **nome, portaria, elevadores, lazer (piscina/academia/salão…), regras, animais** |
| Valores | 🟡 | Tem preço/aluguel/condomínio/IPTU/mínimo. Falta **IPTU anual x parcelas, outras despesas, itens inclusos, data de atualização** |
| Negociação | ❌ | Falta **aceita financiamento/FGTS/permuta, condições de pagamento, prazo; na locação: garantias, uso permitido** |
| Disponibilidade (comercial) | 🟡 | Tem status. Falta **status por finalidade, ocupação atual, data de desocupação/entrada, última confirmação e responsável** |
| Pessoas e origem | ❌ | Falta **proprietário(s), captador, indicador, origem da captação, responsável, datas de entrada/validação** (depende das entidades novas) |
| Visitas e mídia | 🟡 | Tem disponibilidade + fotos + autorização. Falta **acesso/chaves e responsável, instruções de portaria, ordem das imagens, vídeo/tour/planta** |
| Documentação | ❌ | Falta **matrícula, cartório/UF, inscrição municipal, CIB, ônus/débitos/pendências, conferência dos anexos** |
| Comercialização | ❌ | Falta **comissão (base, pagador, condição), canais/portais autorizados, código por portal, responsável/CRECI da divulgação** |
| Casos específicos | ❌ | **Lançamento** (construtora, registro, torre/unidade, obra, memorial), **Rural** (CCIR/CAR/ITR/georref.), **Comercial** (zoneamento/licenças) |

## 2. Corretor

**Hoje temos:** nome, imobiliária, e-mail, telefone, CRECI, perfil, status, permissão de agenda de
outros (B6), login (senha) via Supabase.

| Seção do guia | Situação | Observação |
|---|---|---|
| Dados pessoais | 🟡 | Tem nome. Falta **CPF, nome profissional, nacionalidade, estado civil, identidade/nascimento, foto** |
| Contato | 🟡 | Tem celular/e-mail. Falta **telefone alternativo, endereço completo** |
| Dados profissionais | 🟡 | Tem CRECI. Falta **UF do CRECI, situação, data/comprovante da verificação, autônomo x vinculado, período dos vínculos** |
| Atuação | ❌ | Falta **venda/locação, regiões/bairros, tipos de imóvel, especialidades, idiomas, horários** |
| Conta e documentos | 🟡 | Tem e-mail/perfil/status. Falta **contrato de parceria (versão/assinatura), documentos (identidade/CRECI)** |
| Recebimento | ❌ | Falta **favorecido, CPF/CNPJ, banco/agência/conta ou Pix, titularidade, dados fiscais** (acesso restrito) |

## 3. Imobiliária

**Hoje temos:** nome, CRECI, telefone, e-mail, site, instagram, endereço, cidade, mapa (lat/lng),
raio, status, gestor (nome/e-mail/tel), corretor de contato, plano.

| Seção do guia | Situação | Observação |
|---|---|---|
| Dados da empresa | ❌ | Falta **razão social, CNPJ, nome fantasia, matriz/filial, inscrição municipal, regime tributário, logomarca** |
| Endereço e contato | 🟡 | Tem endereço/telefone/e-mail/site/redes. Falta **WhatsApp, contatos comercial/operacional/financeiro** |
| Habilitação | 🟡 | Tem CRECI. Falta **UF/situação/comprovante, responsável técnico (nome/CPF/CRECI/contato)** |
| Representante legal | ❌ | Falta **nome, CPF, cargo, contato, poderes/procuração, signatários** |
| Equipe e atuação | 🟡 | Tem gestor + corretores vinculados. Falta **perfis de acesso formalizados, filiais, regiões, segmentos** |
| Documentos | ❌ | Falta **CNPJ, contrato social, comprovação de CRECI, representação, contrato de parceria** |
| Financeiro | ❌ | Falta **favorecido, CNPJ, banco/conta ou Pix, titularidade, divisão com corretor** (acesso restrito) |

## 4. Indicador 🆕

**Hoje:** ❌ não existe. Pessoa que apresenta proprietário, imóvel ou cliente ao Hub.
Precisa: identificação (PF/PJ, código, situação), contato, dados da indicação (tipo, indicado,
imóvel/interesse, canal, responsável), autorização/termo (aceite, versão, privacidade),
acompanhamento (situação, vínculos, motivo de recusa/duplicidade) e bonificação (percentual/valor,
favorecido, Pix, comprovante).

## 5. Proprietário 🆕

**Hoje:** ❌ não existe (só há leads). Precisa: identificação (PF/PJ, CPF/CNPJ, estado civil,
representante), contato, vínculo com imóvel(is) e condição (proprietário/coproprietário/representante,
percentual), complementos (regime de bens, cônjuge, procuração, espólio), condições autorizadas
(preço, limite, comissão, exclusividade, imagens/visitas, autorização vinculada ao imóvel),
documentos e dados de repasse (Pix/conta — restrito), relacionamento (origem, captador, histórico).

## 6. Cliente interessado (hoje = "Leads/Pessoas")

**Hoje temos:** nome, imobiliária, telefone, e-mail, interesse (texto livre) — com máscara de contato
até a visita.

| Seção do guia | Situação | Observação |
|---|---|---|
| Identificação inicial | 🟡 | Tem nome/telefone/e-mail. Falta **PF/PJ, cidade/UF, canal e horário preferidos** |
| Objetivo | ❌ | Falta **comprar/alugar, moradia/investimento/comercial, tipo, cidade, bairros, prazo** (hoje tudo cai em "interesse") |
| Orçamento | ❌ | Falta **valor máximo, entrada, recursos/financiamento, FGTS/permuta, pré-aprovação** |
| Perfil do imóvel | ❌ | Falta **área, dormitórios, suítes, vagas, mobiliado, lazer, indispensáveis x desejáveis** |
| Uso e ocupação | ❌ | Falta **ocupantes, animais, mudança; comercial: atividade/estrutura** |
| Origem e responsável | 🟡 | Tem responsável (responsavel_id). Falta **canal de origem estruturado, campanha, indicador** |
| Atendimento | 🟡 | Tem status. Falta **imóveis enviados/favoritos/recusados, motivos, próximo contato** |
| Visita e proposta | 🟡 | Há atividades/agenda. Falta **ficha assinada, proposta vinculada e situação** |
| Qualificação completa / PJ / Análise financeira / Documentos | ❌ | Campos de proposta/contrato: CPF, identidade, estado civil, renda/garantia, contrato social (PJ), documentos e aceites |

## Campos comuns a todos os cadastros

Código único ✅ (id/código), datas de criação/atualização ✅ (created_at/updated_at), responsável
pelo cadastro 🟡 (criado_por já existe em imóvel/lead), situação ✅, observações internas ❌ (não há
campo dedicado), vínculos pessoa/imóvel/negócio 🟡, **anexos com tipo/validade/conferência** ❌ (só há
documentos no funil e a autorização do imóvel), termos/assinaturas com versão e data 🟡 (Fase 1 da
assinatura). Regra do guia: características aceitam "sim/não/não informado"; dados bancários e
documentos pessoais são de **acesso restrito** — hoje só a máscara de contato do lead atende parte
disso.

---

## Plano por fases

A regra do cliente ("concluir e testar a jornada antes de novas funções") pesa aqui: a maior parte
deste guia é **novo cadastro/campos**. Sugestão de sequência do mais barato/impactante ao mais pesado.

### Fase 1 — Enriquecer os cadastros que já existem (baixo risco)
Campos que entram no `extra` (jsonb) sem migração de schema — round-trip já suportado.
- **Imóvel:** uso, subtipo, número/complemento/unidade/bloco/lote, UF, áreas separadas (privativa/
  construída/total/terreno), andar, características (mobiliado, ar-condicionado, varanda,
  acessibilidade, vista, ano), negociação (financiamento/FGTS/permuta), chaves/acesso, vídeo/tour.
- **Corretor:** CPF, telefone alternativo, endereço, UF/situação do CRECI, atuação (regiões/tipos/
  idiomas/horários).
- **Imobiliária:** razão social, CNPJ, nome fantasia, inscrição municipal, WhatsApp, responsável
  técnico, representante legal.
- **Cliente interessado (lead):** estruturar o "interesse" em objetivo + orçamento + perfil do imóvel
  + origem estruturada (em vez de texto livre).
- Esforço: médio, incremental por tela. Sem tabelas novas.

### Fase 2 — Anexos e dados restritos (segurança)
- Módulo de **anexos por cadastro** (tipo, emissão, validade, conferência) reutilizando o upload
  existente — hoje só o funil e a autorização do imóvel têm anexo.
- **Dados bancários/Pix** (corretor e imobiliária) com acesso restrito (só diretoria/gestor).
- Documentação do imóvel (matrícula, cartório, ônus) e comercialização (comissão, portais).
- Esforço: médio/alto. Exige regras de permissão finas e provavelmente colunas/estruturas novas.

### Fase 3 — Entidades novas (Indicador e Proprietário)
- **Indicador:** nova entidade + tela, vínculo com quem indicou, termo e bonificação.
- **Proprietário:** nova entidade + tela, vínculo com imóvel e condições autorizadas (hoje a
  autorização vive no imóvel; passaria a referenciar o proprietário).
- Qualificação completa do cliente (proposta/contrato: CPF, renda, garantia, PJ).
- Esforço: alto. São tabelas, telas e vínculos novos; muda a jornada de captação.

### Dependências
- Nada de externo trava a Fase 1. Fase 2 (dados restritos) casa com a política de privacidade e o
  backup (Bloco C5). Fase 3 é a maior e deve entrar depois da jornada estar validada ponta a ponta.
