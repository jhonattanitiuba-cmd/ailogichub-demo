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
-- obs: funil_negocios NAO tem deleted_at (nao e soft-delete), por isso sem esse filtro
select count(*) total_cards,
  count(*) filter (where exists (
    select 1 from imoveis i where i.imobiliaria_id = f.imobiliaria_id
      and upper(i.codigo) = upper(f.imovel_codigo))) casam_por_codigo
from funil_negocios f;
```

Com o retorno, eu fixo no código o rótulo de etapa fechada (por exemplo GANHO ou FECHAMENTO) e
confirmo a regra de comissão.

---

## Passo 1: backfill (o unico passo manual, e o que ATIVA a propagacao)

Confirmado no Passo 0: `negocios.fechado_em` e `negocios.comissao` ja existem, e o enum tem `GANHO`.
A coluna `funil_negocios.negocio_id` ja e criada automaticamente pelo codigo (aditivo, em runtime),
entao NAO precisa criar coluna na mao. O unico passo manual e o backfill abaixo, que liga os cards
existentes aos negocios. Enquanto ele nao roda, a propagacao fica inerte (nada toca o financeiro).

Dos 36 cards, cerca de 9 casam por codigo (Passo 0); apenas esses serao vinculados. Os demais ficam
sem vinculo e nao propagam (seguro).

```sql
-- backfill do vinculo por imovel (melhor esforco): casa card e negocio da mesma imobiliaria
-- pelo codigo do imovel. Deixa null quando nao houver casamento seguro.
-- obs: funil_negocios NAO tem deleted_at (nao e soft-delete), por isso sem esse filtro no card.
update funil_negocios f
set negocio_id = n.id
from imoveis i
join negocios n on n.imovel_id = i.id and n.imobiliaria_id = f.imobiliaria_id and n.deleted_at is null
where f.negocio_id is null
  and i.imobiliaria_id = f.imobiliaria_id
  and upper(i.codigo) = upper(f.imovel_codigo);

-- conferir quantos ficaram vinculados
select count(*) vinculados from funil_negocios where negocio_id is not null;
```

Reversao (se quiser desativar a propagacao): `update funil_negocios set negocio_id = null;`
(zera os vinculos; a propagacao volta a ficar inerte). A coluna pode ser mantida sem problema.

---

## Passo 2: código (JA NO AR, inerte ate o backfill)

Ja implantado no `api/dash.js` (acao move): quando o card entra em etapa fechada (ganho) E tem
`negocio_id`, propaga para o negocio, sem quebrar o move (envolto em try/catch):

```js
if (won && negocioId) {
  await db(
    "update negocios set etapa_funil='GANHO'::negocio_etapa, fechado_em=coalesce(fechado_em, now()), " +
    "comissao=coalesce(comissao, round(coalesce(valor,0)*0.05)), updated_at=now() " +
    "where id=$2 and deleted_at is null returning id",
    ['GANHO', negocioId]
  );
}
```

A comissão usa 5% como padrão apenas quando estiver vazia (coalesce); se voces ja tem uma regra, eu
troco. A etapa vira GANHO e a data de fechamento e carimbada uma vez (coalesce). Nao cria nem apaga
negocio, so atualiza um existente ja vinculado.

Nada disso remove o `funil_negocios`: o board segue funcionando como hoje; ganhamos a propagacao para
o financeiro nos cards que tem vinculo.

Fora de escopo desta fase (proximos passos, se quiserem): fazer os leads novos (WhatsApp e site)
nascerem tambem como card no funil, e a unificacao total (board lendo direto de negocios). Sao
maiores e merecem fase propria.

---

## Passo 3: validação

1. Rodar o backfill do Passo 1 no Supabase e conferir a contagem de `vinculados`.
2. Teste ponta a ponta num card com vínculo: mover para Fechado no funil e conferir no financeiro que
   o negócio aparece como GANHO, com data de fechamento e comissão.
3. Teste num card sem vínculo: mover para Fechado e confirmar que nada quebra (apenas não propaga).

---

## Estado

- Fase 1: no ar (histórico de etapas + fechado_em no card).
- Fase 2 (código): no ar, porém INERTE (a coluna negocio_id existe mas está nula em todos os cards).
- Ativação: rodar o backfill do Passo 1 no Supabase. A partir daí, fechar um card vinculado propaga
  para o financeiro. Para desativar, `update funil_negocios set negocio_id = null;`.
