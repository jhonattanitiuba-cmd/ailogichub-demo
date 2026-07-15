-- AILOGIC HUB — Módulo Jurídico (fase 1). DDL idempotente (rodada em runtime por api/juris.js ensureDDL).
create table if not exists negocio_advogado(
  negocio_id uuid not null,
  advogado_id uuid not null,
  honorario_pct numeric,
  resumo_ia text,
  resumo_em timestamptz,
  criado_em timestamptz default now(),
  primary key(negocio_id, advogado_id)
);
alter table negocio_advogado add column if not exists honorario_pct numeric;
alter table negocio_advogado add column if not exists resumo_ia text;
alter table negocio_advogado add column if not exists resumo_em timestamptz;
-- % de honorário do advogado fica em usuarios.extra.honorario_pct (jsonb, sem coluna nova)
