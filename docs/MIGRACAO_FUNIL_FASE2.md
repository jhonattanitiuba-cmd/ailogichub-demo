# Unificação do funil - Fase 2 (ligar ao financeiro)

Objetivo: quando um card do funil é fechado (ganho), o negócio correspondente em `negocios` deve
refletir isso (data de fechamento, valor, comissão), para o financeiro enxergar. Isto mexe no núcleo
financeiro e exige migração de banco, então roda no Supabase (como a Fase 0) e valida antes de ligar
o código em produção.

Por que uma fase separada: os cards do funil (`funil_negocios`) são denormalizados (guardam texto:
nome do lead, descrição e código do imóvel, nome do corretor), sem `lead_id`, `imovel_id` nem
`negocio_id`. E as etapas do board são texto livre (`fechado`, `perdido`...), enquanto
`negocios.etapa_funil` é um enum do Postgres (`negocio_etapa`). Por isso precisamos criar o vínculo e
confirmar o vocabulário antes de gravar no financeiro.

Convenção: português do Brasil, sem travessão e sem til solto; acentos preservados.

---

## Passo 0: inspecionar o que existe (rodar e me mandar o resultado)

Estas queries não alteram nada. O resultado define os valores certos no código (evita chute).

```sql
-- valores reais do enum de etapa dos negocios
select enumlabel from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'negocio_etapa' order by e.enumsortorder;

-- colunas atuais de negocios (existe fechado_em? comissao?)
select column_name, data_type from information_schema.columns
where table_name = 'negocios' order by ordinal_position;

-- colunas atuais de funil_negocios (ja tem fechado_em da Fase 1? tem negocio_id?)
select column_name, data_type from information_schema.columns
where table_name = 'funil_negocios' order by ordinal_position;

-- quantos cards do funil casam com um imovel pelo codigo (mede a qualidade do vinculo)
select count(*) total_cards,
  count(*) filter (where exists (
    select 1 from imoveis i where i.imobiliaria_id = f.imobiliaria_id
      and upper(i.codigo) = upper(f.imovel_codigo))) casam_por_codigo
from funil_negocios f where f.deleted_at is null;
```

Com o retorno, eu fixo no código o rótulo de etapa fechada (por exemplo GANHO ou FECHAMENTO) e
confirmo a regra de comissão.

---

## Passo 1: migração (aditiva, reversível)

Só adiciona colunas e faz backfill do vínculo. Não apaga nem altera dado existente.

```sql
-- 1) vinculo card -> negocio
alter table funil_negocios add column if not exists negocio_id uuid;

-- 2) data de fechamento no negocio (se ainda nao existir)
alter table negocios add column if not exists fechado_em timestamptz;

-- 3) backfill do vinculo por imovel (melhor esforco): casa card e negocio da mesma
--    imobiliaria pelo codigo do imovel. Deixa null quando nao houver casamento seguro.
update funil_negocios f
set negocio_id = n.id
from imoveis i
join negocios n on n.imovel_id = i.id and n.imobiliaria_id = f.imobiliaria_id and n.deleted_at is null
where f.negocio_id is null
  and f.deleted_at is null
  and i.imobiliaria_id = f.imobiliaria_id
  and upper(i.codigo) = upper(f.imovel_codigo);
```

Observação: o backfill é melhor esforço. Cards sem imóvel cadastrado, ou com mais de um negócio no
mesmo imóvel, ficam com `negocio_id` nulo e simplesmente não propagam para o financeiro (seguro).

Reversão (se preciso): `alter table funil_negocios drop column negocio_id;` e
`alter table negocios drop column fechado_em;` (as colunas são aditivas; remover volta ao estado
anterior sem perda do dado original).

---

## Passo 2: código (eu aplico depois que a migração estiver no ar e validada)

Na ação `move` do `api/dash.js`, quando o card entra em etapa fechada (ganho) E tem `negocio_id`:

```js
// pseudocodigo do que sera adicionado apos o update do card:
if (won && negocioId) {
  await db(
    "update negocios set etapa_funil = $1::negocio_etapa, fechado_em = coalesce(fechado_em, now()), " +
    "comissao = coalesce(comissao, round(coalesce(valor,0) * 0.05)), updated_at = now() where id = $2",
    [ETAPA_FECHADA_ENUM, negocioId]
  );
}
```

Onde `ETAPA_FECHADA_ENUM` é o rótulo confirmado no Passo 0 (por exemplo 'GANHO'). A comissão usa 5%
como padrão apenas quando estiver vazia; se vocês já têm uma regra, eu troco por ela.

Nada disso remove o `funil_negocios`: o board segue funcionando como hoje; ganhamos a propagação para
o financeiro nos cards que têm vínculo.

Fora de escopo desta fase (próximos passos, se quiserem): fazer os leads novos (WhatsApp e site)
nascerem também como card no funil, e a unificação total (board lendo direto de negocios). São
maiores e merecem fase própria.

---

## Passo 3: validação (antes e depois de ligar)

1. Rodar o Passo 0 e o Passo 1 no Supabase. Conferir que as colunas foram criadas e quantos cards
   receberam `negocio_id` (a query de contagem do Passo 0 ajuda a estimar).
2. Me enviar os rótulos do enum e a contagem. Eu fixo o `ETAPA_FECHADA_ENUM` e faço deploy do código.
3. Teste ponta a ponta num card com vínculo: mover para Fechado no funil e conferir no financeiro que
   o negócio aparece como fechado, com data e comissão.
4. Teste num card sem vínculo: mover para Fechado e confirmar que nada quebra (apenas não propaga).

---

## Estado

- Fase 1: no ar (histórico de etapas + fechado_em no card). Não depende de nada disto.
- Fase 2: aguardando rodar o Passo 0 e o Passo 1 no Supabase para eu concluir o Passo 2.
