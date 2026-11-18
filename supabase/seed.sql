-- =====================================================
-- GESTLUX - DADOS DE EXEMPLO PARA O PITCH
-- 1) No Supabase: Authentication > Users > Add user
--    E-mail: demo@gestlux.com.br
--    Senha:  Demo@12345
-- 2) Execute este arquivo no SQL Editor.
--
-- Repetível e recuperável: cria o que falta e ignora o
-- que já existe. Pode rodar novamente a qualquer momento
-- para restaurar os dados de exemplo da demo.
-- =====================================================

do $$
declare
  v_user uuid;
  v_org uuid;
begin
  select id into v_user
  from auth.users
  where email = 'demo@gestlux.com.br'
  limit 1;

  if v_user is null then
    raise notice 'Crie o usuario demo@gestlux.com.br no Authentication antes de rodar o seed.';
    return;
  end if;

  select organizacao_id into v_org
  from public.perfis
  where id = v_user;

  if v_org is null then
    insert into public.organizacoes (nome, segmento, notificacoes)
    values ('Loja Central (exemplo)', 'varejo', true)
    returning id into v_org;

    insert into public.perfis (id, organizacao_id, nome, email, papel)
    values (v_user, v_org, 'Usuário Demo', 'demo@gestlux.com.br', 'admin');

    raise notice 'Organizacao e perfil criados.';
  elsif not exists (select 1 from public.organizacoes where id = v_org) then
    insert into public.organizacoes (nome, segmento, notificacoes)
    values ('Loja Central (exemplo)', 'varejo', true)
    returning id into v_org;

    update public.perfis
    set organizacao_id = v_org
    where id = v_user;

    raise notice 'Organizacao recriada e vinculada ao perfil.';
  else
    raise notice 'Organizacao e perfil ja existem.';
  end if;

  -- Produtos: insere apenas os que não existem ainda (por SKU).
  insert into public.produtos (organizacao_id, nome, sku, preco, quantidade, minimo)
  select v_org, x.nome, x.sku, x.preco, x.qtd, x.minimo
  from (values
    ('Camiseta Básica', 'CAM-001', 79.90, 120, 20),
    ('Calça Jeans', 'CAL-014', 189.90, 45, 15),
    ('Tênis Esportivo', 'TEN-032', 299.90, 9, 10),
    ('Boné Aba Reta', 'BON-008', 59.90, 60, 20),
    ('Mochila Urbana', 'MOC-021', 249.90, 8, 10),
    ('Meias Kit 3', 'MEI-003', 29.90, 200, 50)
  ) as x(nome, sku, preco, qtd, minimo)
  where not exists (
    select 1 from public.produtos p
    where p.organizacao_id = v_org and p.sku = x.sku
  );

  -- Movimentações: insere apenas se a organização não tiver nenhuma.
  if not exists (
    select 1 from public.movimentacoes where organizacao_id = v_org
  ) then
    insert into public.movimentacoes (organizacao_id, produto_id, tipo, quantidade, valor, criado_em)
    select
      v_org,
      p.id,
      'venda',
      x.qtd,
      p.preco * x.qtd,
      now() - (x.dias || ' days')::interval
    from public.produtos p
    cross join (values
      ('CAM-001', 3, 0), ('CAL-014', 2, 1), ('TEN-032', 1, 1),
      ('BON-008', 4, 2), ('MOC-021', 1, 3), ('MEI-003', 6, 4),
      ('CAM-001', 2, 5), ('CAL-014', 1, 6)
    ) as x(sku, qtd, dias)
    where p.organizacao_id = v_org and p.sku = x.sku;

    raise notice 'Vendas de exemplo criadas.';
  else
    raise notice 'Movimentacoes ja existem (nada duplicado).';
  end if;

  raise notice 'Seed concluido para demo@gestlux.com.br.';
end $$;
