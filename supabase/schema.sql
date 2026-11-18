-- =====================================================
-- GESTLUX - SCHEMA INICIAL (SUPABASE / POSTGRES)
-- Execute este arquivo no SQL Editor do seu projeto.
-- =====================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------
-- Tabelas
-- -----------------------------------------------------
create table if not exists public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text not null default 'varejo',
  notificacoes boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  nome text not null,
  email text not null,
  papel text not null default 'admin' check (papel in ('admin', 'gerente', 'operador')),
  criado_em timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  nome text not null,
  sku text,
  preco numeric(12, 2) not null default 0,
  quantidade integer not null default 0,
  minimo integer not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida', 'venda')),
  quantidade integer not null,
  valor numeric(12, 2) not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists produtos_organizacao_idx on public.produtos (organizacao_id);
create index if not exists movimentacoes_organizacao_idx on public.movimentacoes (organizacao_id, criado_em desc);

-- SKU único dentro da organização (o seed usa isso para não duplicar).
create unique index if not exists produtos_org_sku_uq on public.produtos (organizacao_id, sku) where sku is not null;

-- -----------------------------------------------------
-- Função auxiliar: organização do usuário autenticado.
-- SECURITY DEFINER evita recursão nas políticas de RLS.
-- -----------------------------------------------------
create or replace function public.organizacao_atual()
returns uuid
language sql
security definer
set search_path = public
as $$
  select organizacao_id from public.perfis where id = auth.uid() limit 1;
$$;

-- -----------------------------------------------------
-- Cadastro atômico: cria organização + perfil do usuário.
-- -----------------------------------------------------
create or replace function public.criar_organizacao(
  p_nome text,
  p_segmento text,
  p_nome_usuario text,
  p_email_usuario text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if exists (select 1 from public.perfis where id = auth.uid()) then
    return public.organizacao_atual();
  end if;

  insert into public.organizacoes (nome, segmento)
  values (p_nome, p_segmento)
  returning id into v_org;

  insert into public.perfis (id, organizacao_id, nome, email, papel)
  values (auth.uid(), v_org, p_nome_usuario, p_email_usuario, 'admin');

  return v_org;
end;
$$;

revoke all on function public.criar_organizacao(text, text, text, text) from public;
grant execute on function public.criar_organizacao(text, text, text, text) to authenticated;

-- -----------------------------------------------------
-- Venda atômica: valida estoque, grava a movimentação e
-- baixa o produto em uma única transação (evita corrida).
-- -----------------------------------------------------
create or replace function public.registrar_venda(
  p_produto_id uuid,
  p_quantidade integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_preco numeric(12, 2);
  v_estoque integer;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade inválida.';
  end if;

  v_org := public.organizacao_atual();

  select preco, quantidade into v_preco, v_estoque
  from public.produtos
  where id = p_produto_id and organizacao_id = v_org
  for update;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;

  if v_estoque < p_quantidade then
    raise exception 'Estoque insuficiente.';
  end if;

  insert into public.movimentacoes (organizacao_id, produto_id, tipo, quantidade, valor)
  values (v_org, p_produto_id, 'venda', p_quantidade, v_preco * p_quantidade);

  update public.produtos
  set quantidade = quantidade - p_quantidade
  where id = p_produto_id;
end;
$$;

revoke all on function public.registrar_venda(uuid, integer) from public;
grant execute on function public.registrar_venda(uuid, integer) to authenticated;

-- -----------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------
alter table public.organizacoes enable row level security;
alter table public.perfis enable row level security;
alter table public.produtos enable row level security;
alter table public.movimentacoes enable row level security;

drop policy if exists "organizacao do usuario" on public.organizacoes;
drop policy if exists "organizacao leitura" on public.organizacoes;
drop policy if exists "organizacao atualizacao" on public.organizacoes;

-- Leitura e atualização da própria organização.
-- Sem política de DELETE: a organização não pode ser apagada pelo front
-- (evita cascade apagando perfis, produtos e movimentações).
create policy "organizacao leitura" on public.organizacoes
  for select using (id = public.organizacao_atual());

create policy "organizacao atualizacao" on public.organizacoes
  for update using (id = public.organizacao_atual())
  with check (id = public.organizacao_atual());

drop policy if exists "perfil proprio" on public.perfis;
create policy "perfil proprio" on public.perfis
  for select using (id = auth.uid() or organizacao_id = public.organizacao_atual());

drop policy if exists "produtos da organizacao" on public.produtos;
create policy "produtos da organizacao" on public.produtos
  for all using (organizacao_id = public.organizacao_atual())
  with check (organizacao_id = public.organizacao_atual());

drop policy if exists "movimentacoes da organizacao" on public.movimentacoes;
create policy "movimentacoes da organizacao" on public.movimentacoes
  for all using (organizacao_id = public.organizacao_atual())
  with check (organizacao_id = public.organizacao_atual());
