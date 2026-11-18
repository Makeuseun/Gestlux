-- =====================================================
-- GESTLUX - DADOS DE EXEMPLO PARA O PITCH
-- 1) No Supabase: Authentication > Users > Add user
--    E-mail: demo@gestlux.com.br
--    Senha:  Demo@12345
-- 2) Execute este arquivo no SQL Editor.
--
-- Repetível: se o usuário demo já tiver perfil,
-- o script não altera nada. Pode rodar novamente.
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

  if exists (select 1 from public.perfis where id = v_user) then
    raise notice 'Demo ja semeada para este usuario. Nada foi alterado.';
    return;
  end if;

  insert into public.organizacoes (nome, segmento, notificacoes)
  values ('Loja Central (exemplo)', 'varejo', true)
  returning id into v_org;

  insert into public.perfis (id, organizacao_id, nome, email, papel)
  values (v_user, v_org, 'Usuário Demo', 'demo@gestlux.com.br', 'admin');

  insert into public.produtos (organizacao_id, nome, sku, preco, quantidade, minimo) values
    (v_org, 'Camiseta Básica', 'CAM-001', 79.90, 120, 20),
    (v_org, 'Calça Jeans', 'CAL-014', 189.90, 45, 15),
    (v_org, 'Tênis Esportivo', 'TEN-032', 299.90, 9, 10),
    (v_org, 'Boné Aba Reta', 'BON-008', 59.90, 60, 20),
    (v_org, 'Mochila Urbana', 'MOC-021', 249.90, 8, 10),
    (v_org, 'Meias Kit 3', 'MEI-003', 29.90, 200, 50);

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
  where p.sku = x.sku;
end $$;
