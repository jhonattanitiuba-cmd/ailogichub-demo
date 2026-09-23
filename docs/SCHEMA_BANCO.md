# Schema do banco — AILogic Hub

Reconstruído a partir do código (api/*.js e _db/juridico_v1.sql), que é a fonte de verdade do que o
Hub cria e usa. A base foi criada no Supabase (fora deste repositório); a app aplica alterações
incrementais (`alter table ... add column if not exists`) e usa `extra jsonb` para os campos de
formulário. Por isso: as colunas escalares abaixo são as efetivamente lidas/gravadas pela app; os
tipos exatos (not null, defaults, tamanho) da base vêm do Supabase. As chaves do `extra` são listadas
porque a app depende delas.

Há DOIS bancos:
1. Banco do Hub (Supabase Postgres) — variável de ambiente `DB_URL`. É o que a app usa (tabelas abaixo).
2. Banco do WhatsApp/Evolution (Postgres separado) — gerido pela Evolution API; tabelas próprias
   (Chat, Message, Contact, Instance, Chatwoot*). Não faz parte do schema da app; só a `canais_whatsapp`
   e as `ia_*` (abaixo, no banco do Hub) guardam o estado da integração.

Tipos usados: uuid, text, numeric, int, boolean, timestamptz, jsonb. Enums: `perfil_usuario`,
`lead_status`, `negocio_etapa`.

---

## Núcleo (cadastros)

### usuarios  — corretores, gestores, diretoria, advogados (fonte dos logins)
Escalares: `id uuid` (PK), `imobiliaria_id uuid` (nullable — diretoria/admin não tem),
`nome text`, `email text`, `telefone text`, `creci text`, `perfil perfil_usuario`, `ativo boolean`,
`auth_user_id uuid` (liga ao login do Supabase Auth), `extra jsonb`,
`created_at`, `updated_at`, `deleted_at` (soft delete).
Chaves em `extra`: cpf, telefone2, creci_uf, creci_situacao, endereco, regioes, tipos_imovel, idiomas,
horarios, agenda_outros (B6), departamento, supervisor_id/supervisor_nome (estagiário), e recebimento
(restrito): fav_nome, fav_doc, banco, agencia, conta, conta_tipo, pix; documentos[] (anexos).

### imobiliarias
Escalares: `id uuid` (PK), `nome`, `creci`, `slug`, `telefone`, `email`, `site`, `instagram`,
`endereco`, `cidade`, `lat`, `lng`, `raio_atuacao_m`, `ativo boolean`, `gestor_id uuid`,
`plano text`, `extra jsonb`, `created_at`, `updated_at`, `deleted_at`.
Chaves em `extra`: razao_social, nome_fantasia, cnpj, inscricao_municipal, whatsapp, creci_uf,
rt_nome, rt_creci (responsável técnico), rep_nome, rep_cpf (representante legal), recebimento restrito
(fav_nome, fav_doc, banco, agencia, conta, conta_tipo, pix), documentos[].

### imoveis
Escalares: `id uuid` (PK), `imobiliaria_id uuid`, `titulo`, `codigo`, `tipo`, `finalidade`, `status`,
`preco numeric`, `area_util numeric`, `quartos int`, `suites int`, `banheiros int`, `vagas int`,
`endereco`, `bairro`, `cidade`, `descricao`, `lat`, `lng`, `extra jsonb`,
`created_at`, `updated_at`, `deleted_at`.
Chaves em `extra`: foto, fotos[], destaque, valor_minimo, cep, iptu, condominio, referencia, uso,
subtipo, numero, complemento, uf, unidade, bloco, lote, area_privativa, area_construida, area_total,
area_terreno, andar, total_andares, mobilia, ar_condicionado, varanda, acessibilidade, posicao_solar,
ano_construcao, vista, financiamento, fgts, permuta, condicoes_pagamento, chaves, video, tour, planta,
disponibilidade{dias[],hora_ini,hora_fim,duracao_min}, matricula, cartorio, cartorio_uf,
inscricao_municipal, cib, onus, comissao_pct, comissao_base, comissao_pagador, comissao_cond, portais,
autorizacao_url, autorizacao_ok, criado_por, origem, documentos[].

### leads  — "Pessoas & Contatos" / Cliente interessado
Escalares: `id uuid` (PK), `imobiliaria_id uuid`, `nome`, `telefone`, `email`, `status lead_status`,
`fonte_id uuid`, `responsavel_id uuid`, `score`, `interesse`, `motivo_perda`, `ultimo_contato`,
`extra jsonb`, `created_at`, `updated_at`, `deleted_at`.
Chaves em `extra`: criado_por, objetivo, uso_finalidade, tipo_desejado, regioes, prazo, orcamento_max,
entrada, financiamento, perfil_imovel, canal_origem, horario_preferido, cidade_uf, pessoa_tipo,
documentos[]. Observação: telefone/e-mail são mascarados na API até a visita (segurança jurídica).

### fontes_lead
`id uuid` (PK), `imobiliaria_id uuid`, `nome`, `canal`, `ativo boolean`. (Somente leitura na app.)

---

## Negócios e funil

### negocios  — negócio "oficial" (somente leitura na app; alimenta o financeiro)
`id uuid` (PK), `imobiliaria_id`, `lead_id`, `imovel_id`, `responsavel_id`,
`etapa_funil negocio_etapa` (LEAD … GANHO, PERDIDO), `valor numeric`, `comissao numeric`,
`rlor numeric`, `motivo_perda`, `fechado_em`, `created_at`, `updated_at`, `deleted_at`.

### funil_negocios  — cards do quadro (kanban), denormalizado
`id` (PK), `imobiliaria_id`, `imob_nome`, `lead_nome`, `lead_id text` (B3),
`imovel_desc`, `imovel_codigo`, `corretor_nome`, `corretor_perfil` (B5), `valor`, `etapa`, `origem`,
`tentativas`, `sla`, `status_label`, `ultimo_contato`, `motivo_perda`,
`fechado_em` (Fase 1 funil), `negocio_id uuid` (vínculo card→negócio), `documentos jsonb` (B4),
`criado_em`.

### funil_config  — etapas configuráveis por visão/imobiliária
`scope text` (PK), `etapas jsonb`, `updated_at`.

### funil_historico  — auditoria de movimentação de card
`id bigserial` (PK), `card_id`, `imobiliaria_id`, `etapa_de`, `etapa_para`, `autor_id`, `autor_nome`,
`criado_em`.

### negocio_advogado  — atribuição de casos ao jurídico (_db/juridico_v1.sql)
`negocio_id uuid`, `advogado_id uuid` (PK composto), `honorario_pct numeric`, `resumo_ia text`,
`resumo_em timestamptz`, `criado_em timestamptz`.

---

## Agenda, contratos, propostas, acesso

### atividades  — agenda (compromissos e visitas)
`id uuid` (PK), `imobiliaria_id`, `titulo`, `tipo`, `inicio timestamptz`, `fim timestamptz`,
`concluida boolean`, `lead_id`, `negocio_id`, `responsavel_id`, `imovel_id uuid` (B7), `created_at`.

### contratos
`id uuid` (PK), `imobiliaria_id`, `negocio_id`, `status_assinatura`, `assinado_em`, `url_assinado`,
`created_at`.

### propostas
`id bigserial` (PK), `imobiliaria_id uuid`, `imovel_codigo text`, `cliente text`, `whatsapp text`,
`valor numeric`, `status text` (default 'nova'), `lead_id uuid`, `extra jsonb`, `created_at`.

### cliente_acesso  — token de acesso do cliente (área do cliente)
`token_hash text` (PK), `lead_id uuid`, `whatsapp text`, `imobiliaria_id uuid`, `criado_em`,
`expira_em`.

---

## WhatsApp / IA (estado da integração, no banco do Hub)

### canais_whatsapp  — estado do canal por instância
`instancia` (chave), `status`, `ultimo_evento`, `desconectado_em`, `espelho_desde`, `perfil_nome`,
`numero`, `ia_ativa boolean`, `ia_allowlist`, `ia_persona`, `ia_tools`, `updated_at`.

### ia_atendimento  — controle da IA por conversa
`remote_jid text` (PK), `ia_pausada boolean`, `atendente_id uuid`, `nao_lidas int`, `ultimo_lido_em`,
`lead_id uuid`, `atualizado_em`.

### ia_historico  — histórico de mensagens da IA
`id` (PK), `remote_jid text`, `role text`, `conteudo text`, `created_at`.

### hub_dashboard  — cache de dados do painel
`chave text` (PK, ex.: 'principal'), `dados jsonb`.

---

## Enums

- `perfil_usuario`: corretor, estagiario, gerente, admin, diretoria, advogado, parceiro, comercial…
  (a app adiciona valores com `alter type ... add value if not exists`).
- `lead_status`: novo, qualificado, … (usado em filtros ilike '%qualif%').
- `negocio_etapa`: LEAD, … , GANHO, PERDIDO (confirmado no banco).

## Observações importantes

- Soft delete (`deleted_at is null`) em: imobiliarias, imoveis, usuarios, leads, negocios.
- Muitos campos "ricos" vivem em `extra jsonb` (não são colunas), por escolha de design — evita
  migração a cada campo novo. Para relatórios SQL, use `extra->>'chave'`.
- `funil_negocios` é o quadro operacional (denormalizado); `negocios` é o registro oficial ligado ao
  financeiro. O vínculo entre eles é `funil_negocios.negocio_id`.
- O dump/senha reais do banco NÃO estão neste documento nem no repositório (apenas via env `DB_URL`
  na Vercel).
