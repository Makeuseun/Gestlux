/* ===========================
   GESTLUX - CAMADA DE DADOS
   Supabase (remoto) com fallback local
   =========================== */
(function () {
  'use strict';

  const CFG = window.GESTLUX_CONFIG || {};
  const CHAVE_DB = 'gestlux_local_db';
  let cliente = null;
  let modo = 'local';
  let dbLocal = null;
  let iniciado = false;

  function uid() {
    return 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function agora(diasAtras) {
    return new Date(Date.now() - (diasAtras || 0) * 86400000).toISOString();
  }

  function bancoInicial() {
    const produtos = [
      { id: uid(), nome: 'Camiseta Básica', sku: 'CAM-001', preco: 79.90, quantidade: 120, minimo: 20 },
      { id: uid(), nome: 'Calça Jeans', sku: 'CAL-014', preco: 189.90, quantidade: 45, minimo: 15 },
      { id: uid(), nome: 'Tênis Esportivo', sku: 'TEN-032', preco: 299.90, quantidade: 9, minimo: 10 },
      { id: uid(), nome: 'Boné Aba Reta', sku: 'BON-008', preco: 59.90, quantidade: 60, minimo: 20 },
      { id: uid(), nome: 'Mochila Urbana', sku: 'MOC-021', preco: 249.90, quantidade: 8, minimo: 10 },
      { id: uid(), nome: 'Meias Kit 3', sku: 'MEI-003', preco: 29.90, quantidade: 200, minimo: 50 }
    ];

    const vendas = [
      ['CAM-001', 3, 0], ['CAL-014', 2, 1], ['TEN-032', 1, 1],
      ['BON-008', 4, 2], ['MOC-021', 1, 3], ['MEI-003', 6, 4],
      ['CAM-001', 2, 5], ['CAL-014', 1, 6]
    ];

    const movimentacoes = vendas.map(function (v) {
      const produto = produtos.find(function (p) { return p.sku === v[0]; });
      return {
        id: uid(),
        produto_id: produto.id,
        produto_nome: produto.nome,
        tipo: 'venda',
        quantidade: v[1],
        valor: produto.preco * v[1],
        criado_em: agora(v[2])
      };
    });

    return {
      organizacao: { id: 'local-org', nome: 'Loja Central (exemplo)', segmento: 'varejo', notificacoes: true, respostas: {}, modulos: ['7', '8'] },
      usuarios: [{ id: 'local-user', nome: 'Usuário Demo', email: 'demo@gestlux.com.br', papel: 'admin' }],
      convites: [],
      produtos: produtos,
      movimentacoes: movimentacoes
    };
  }

  function db() {
    if (dbLocal) return dbLocal;
    try {
      dbLocal = JSON.parse(localStorage.getItem(CHAVE_DB) || 'null') || bancoInicial();
    } catch (e) {
      dbLocal = bancoInicial();
    }
    salvarDb();
    return dbLocal;
  }

  function salvarDb() {
    localStorage.setItem(CHAVE_DB, JSON.stringify(dbLocal));
  }

  function usuarioLocal() {
    let salvo = null;
    try {
      salvo = JSON.parse(localStorage.getItem('gestlux_user') || 'null');
    } catch (e) {
      salvo = null;
    }
    return {
      id: (salvo && salvo.id) || 'local-user',
      nome: (salvo && salvo.nome) || 'Usuário Demo',
      email: (salvo && salvo.email) || 'demo@gestlux.com.br',
      papel: (salvo && salvo.papel) || 'admin',
      organizacao_id: db().organizacao.id,
      organizacao: db().organizacao
    };
  }

  async function iniciar() {
    if (iniciado) return;
    iniciado = true;

    // 2026: publishable key é o nome novo; anon key legada continua válida.
    // Nunca aceitar service_role/sb_secret no navegador.
    const chavePublica = CFG.supabasePublishableKey || CFG.supabaseAnonKey;
    const chaveSegura = chavePublica && !/service_role|sb_secret/i.test(chavePublica);

    if (CFG.supabaseUrl && chaveSegura && window.supabase && window.supabase.createClient) {
      try {
        cliente = window.supabase.createClient(CFG.supabaseUrl, chavePublica);
        const resultado = await cliente.auth.getSession();
        if (!resultado.error) {
          modo = 'remoto';
          return;
        }
      } catch (e) {
        cliente = null;
      }
    }
    cliente = null;
    modo = 'local';
    db();
  }

  async function login(email, senha) {
    if (modo === 'remoto') {
      const { data, error } = await cliente.auth.signInWithPassword({ email: email, password: senha });
      if (error) throw error;
      return await usuario() || { nome: email.split('@')[0], email: email };
    }

    localStorage.setItem('gestlux_token', 'demo-token-' + Date.now());
    localStorage.setItem('gestlux_user', JSON.stringify({ nome: email.split('@')[0] || 'Usuário Demo', email: email }));
    return usuarioLocal();
  }

  async function cadastro(nome, email, senha, segmento, tokenConvite) {
    if (modo === 'remoto') {
      const { data, error } = await cliente.auth.signUp({
        email: email,
        password: senha,
        options: { data: { nome: nome, segmento: segmento || 'varejo' } }
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error('Confirme o e-mail ou desative a confirmação no Supabase para a demo.');
      }

      if (tokenConvite) {
        const convite = await cliente.rpc('aceitar_convite', {
          p_token: tokenConvite,
          p_nome_usuario: nome,
          p_email_usuario: email
        });
        if (convite.error) throw convite.error;
      } else {
        const criacao = await cliente.rpc('criar_organizacao', {
          p_nome: nome,
          p_segmento: segmento,
          p_nome_usuario: nome,
          p_email_usuario: email
        });
        if (criacao.error) throw criacao.error;
      }
      return await usuario() || { nome: nome, email: email };
    }

    const convite = tokenConvite ? localConviteValido(tokenConvite) : null;
    const papel = convite ? convite.papel : 'admin';
    localStorage.setItem('gestlux_token', 'demo-token-' + Date.now());
    localStorage.setItem('gestlux_user', JSON.stringify({
      id: uid(), nome: nome, email: email, segmento: segmento || 'varejo', papel: papel
    }));
    const atual = db();
    if (!convite) atual.organizacao.segmento = segmento;
    atual.usuarios.push({ id: uid(), nome: nome, email: email, papel: papel });
    if (convite) convite.status = 'aceito';
    salvarDb();
    return usuarioLocal();
  }

  function localConviteValido(token) {
    const atual = db();
    if (!atual.convites) atual.convites = [];
    return atual.convites.find(function (c) {
      return c.token === token && c.status === 'pendente';
    }) || null;
  }

  // Preferências do onboarding (respostas + módulos ativos).
  async function salvarOnboarding(respostas, modulos) {
    const dadosRespostas = respostas && typeof respostas === 'object' ? respostas : {};
    const listaModulos = Array.isArray(modulos) ? modulos.map(String) : [];

    if (modo === 'remoto') {
      const { error } = await cliente.rpc('salvar_onboarding', {
        p_respostas: dadosRespostas,
        p_modulos: listaModulos
      });
      if (error) throw error;
      return;
    }

    const atual = db();
    atual.organizacao.respostas = dadosRespostas;
    atual.organizacao.modulos = listaModulos;
    salvarDb();
  }

  async function logout() {
    if (modo === 'remoto') {
      await cliente.auth.signOut();
      return;
    }
    ['gestlux_token', 'gestlux_user'].forEach(function (chave) {
      localStorage.removeItem(chave);
      sessionStorage.removeItem(chave);
    });
  }

  async function usuario() {
    if (modo === 'remoto') {
      const resultado = await cliente.auth.getUser();
      const user = resultado.data && resultado.data.user;
      if (!user) return null;

      const perfil = await cliente
        .from('perfis')
        .select('nome, email, papel, organizacao_id')
        .eq('id', user.id)
        .maybeSingle();

      let org = null;
      if (perfil.data && perfil.data.organizacao_id) {
        const orgResult = await cliente
          .from('organizacoes')
          .select('nome, segmento, notificacoes, respostas, modulos')
          .eq('id', perfil.data.organizacao_id)
          .maybeSingle();
        org = orgResult.data;
      }

      return {
        id: user.id,
        nome: (perfil.data && perfil.data.nome) || user.email.split('@')[0],
        email: user.email,
        papel: (perfil.data && perfil.data.papel) || 'admin',
        organizacao_id: perfil.data && perfil.data.organizacao_id,
        organizacao: org || { nome: 'Minha organização', segmento: 'varejo', notificacoes: true, respostas: {}, modulos: ['7', '8'] }
      };
    }
    return usuarioLocal();
  }

  async function carregarDados() {
    if (modo === 'remoto') {
      const [produtos, movimentacoes] = await Promise.all([
        cliente.from('produtos').select('*').order('nome'),
        cliente.from('movimentacoes').select('*').order('criado_em', { ascending: false }).limit(50)
      ]);
      if (produtos.error) throw produtos.error;
      if (movimentacoes.error) throw movimentacoes.error;
      return { produtos: produtos.data || [], movimentacoes: movimentacoes.data || [] };
    }
    const atual = db();
    return {
      produtos: atual.produtos.slice(),
      movimentacoes: atual.movimentacoes.slice().sort(function (a, b) {
        return new Date(b.criado_em) - new Date(a.criado_em);
      })
    };
  }

  async function adicionarProduto(dados) {
    if (modo === 'remoto') {
      const user = await usuario();
      const { data, error } = await cliente.from('produtos').insert([{
        organizacao_id: user.organizacao_id,
        nome: dados.nome,
        sku: dados.sku || null,
        preco: Number(dados.preco) || 0,
        quantidade: Number(dados.quantidade) || 0,
        minimo: Number(dados.minimo) || 0,
        tipo_produto: dados.tipo_produto || null,
        data_validade: dados.data_validade || null,
        nota_fiscal: dados.nota_fiscal || null
      }]).select().single();
      if (error) throw traduzirErroProduto(error);
      return data;
    }
    const produto = {
      id: uid(),
      nome: dados.nome,
      sku: dados.sku || '',
      preco: Number(dados.preco) || 0,
      quantidade: Number(dados.quantidade) || 0,
      minimo: Number(dados.minimo) || 0,
      tipo_produto: dados.tipo_produto || null,
      data_validade: dados.data_validade || null,
      nota_fiscal: dados.nota_fiscal || null
    };
    db().produtos.push(produto);
    salvarDb();
    return produto;
  }

  // Atualiza o cadastro do produto. Se a quantidade mudar,
  // registra uma movimentação de ajuste (entrada ou saída).
  async function atualizarProduto(id, dados) {
    const novaQuantidade = Math.round(Number(dados.quantidade));
    if (!isFinite(novaQuantidade) || novaQuantidade < 0) {
      throw new Error('Informe uma quantidade válida.');
    }

    if (modo === 'remoto') {
      const user = await usuario();
      const atual = await cliente.from('produtos')
        .select('quantidade')
        .eq('id', id)
        .eq('organizacao_id', user.organizacao_id)
        .maybeSingle();
      if (!atual.data) throw new Error('Produto não encontrado.');

      const { error } = await cliente.from('produtos').update({
        nome: dados.nome,
        sku: dados.sku || null,
        preco: Number(dados.preco) || 0,
        quantidade: novaQuantidade,
        minimo: Number(dados.minimo) || 0,
        tipo_produto: dados.tipo_produto || null,
        data_validade: dados.data_validade || null,
        nota_fiscal: dados.nota_fiscal || null
      }).eq('id', id);
      if (error) throw traduzirErroProduto(error);

      const delta = novaQuantidade - Math.round(Number(atual.data.quantidade));
      if (delta !== 0) {
        const mov = await cliente.from('movimentacoes').insert([{
          organizacao_id: user.organizacao_id,
          produto_id: id,
          produto_nome: dados.nome,
          tipo: delta > 0 ? 'entrada' : 'saida',
          quantidade: Math.abs(delta),
          valor: 0
        }]);
        if (mov.error) throw mov.error;
      }
      return;
    }

    const atual = db();
    const produto = atual.produtos.find(function (p) { return p.id === id; });
    if (!produto) throw new Error('Produto não encontrado.');

    const delta = novaQuantidade - Math.round(Number(produto.quantidade));
    produto.nome = dados.nome;
    produto.sku = dados.sku || '';
    produto.preco = Number(dados.preco) || 0;
    produto.quantidade = novaQuantidade;
    produto.minimo = Number(dados.minimo) || 0;
    produto.tipo_produto = dados.tipo_produto || null;
    produto.data_validade = dados.data_validade || null;
    produto.nota_fiscal = dados.nota_fiscal || null;

    if (delta !== 0) {
      atual.movimentacoes.push({
        id: uid(),
        produto_id: produto.id,
        produto_nome: produto.nome,
        tipo: delta > 0 ? 'entrada' : 'saida',
        quantidade: Math.abs(delta),
        valor: 0,
        criado_em: new Date().toISOString()
      });
    }
    salvarDb();
  }

  // A exclusão preserva o histórico: se o produto tem vendas/movimentações
  // registradas, só pode ser excluído com estoque zerado. As movimentações
  // ficam com produto_nome para continuar nos relatórios.
  async function excluirProduto(id) {
    const mensagemEstoque = 'Este produto tem histórico e ainda tem estoque. Zere o estoque para poder excluí-lo.';

    if (modo === 'remoto') {
      const user = await usuario();
      const atual = await cliente.from('produtos')
        .select('quantidade')
        .eq('id', id)
        .eq('organizacao_id', user.organizacao_id)
        .maybeSingle();
      if (!atual.data) throw new Error('Produto não encontrado.');

      if (Number(atual.data.quantidade) > 0) {
        const count = await cliente.from('movimentacoes')
          .select('id', { count: 'exact', head: true })
          .eq('produto_id', id);
        if (count.error) throw count.error;
        if ((count.count || 0) > 0) throw new Error(mensagemEstoque);
      }

      const { error } = await cliente.from('produtos').delete().eq('id', id);
      if (error) throw traduzirErroProduto(error);
      return;
    }

    const atual = db();
    const produto = atual.produtos.find(function (p) { return p.id === id; });
    if (!produto) throw new Error('Produto não encontrado.');

    const temHistorico = atual.movimentacoes.some(function (m) { return m.produto_id === id; });
    if (Number(produto.quantidade) > 0 && temHistorico) throw new Error(mensagemEstoque);

    atual.movimentacoes.forEach(function (m) {
      if (m.produto_id === id) m.produto_id = null;
    });
    atual.produtos = atual.produtos.filter(function (p) { return p.id !== id; });
    salvarDb();
  }

  function traduzirErroProduto(erro) {
    if (erro && erro.code === '23505') {
      return new Error('SKU já cadastrado nesta organização.');
    }
    return erro;
  }

  async function registrarVenda(produtoId, quantidade, vendedor) {
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) throw new Error('Informe uma quantidade válida.');

    const pessoa = vendedor || await usuario();
    const vendedorId = pessoa && pessoa.id ? pessoa.id : null;
    const vendedorNome = pessoa && pessoa.nome ? pessoa.nome : null;

    if (modo === 'remoto') {
      const { error } = await cliente.rpc('registrar_venda_com_pessoa', {
        p_produto_id: produtoId,
        p_quantidade: qtd,
        p_vendedor_id: vendedorId,
        p_vendedor_nome: vendedorNome
      });
      if (error) throw error;
      return;
    }

    const atual = db();
    const produto = atual.produtos.find(function (p) { return p.id === produtoId; });
    if (!produto) throw new Error('Produto não encontrado.');
    if (produto.quantidade < qtd) throw new Error('Estoque insuficiente.');
    produto.quantidade -= qtd;
    atual.movimentacoes.push({
      id: uid(),
      produto_id: produtoId,
      produto_nome: produto.nome,
      tipo: 'venda',
      quantidade: qtd,
      valor: produto.preco * qtd,
      vendedor_id: vendedorId,
      vendedor_nome: vendedorNome,
      criado_em: new Date().toISOString()
    });
    salvarDb();
  }

  // Entrada manual de estoque: sempre gera uma movimentação do tipo "entrada".
  async function registrarEntrada(produtoId, quantidade, observacao) {
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) throw new Error('Informe uma quantidade válida.');
    const obs = String(observacao || '').trim().slice(0, 200);

    if (modo === 'remoto') {
      const user = await usuario();
      const produto = await cliente.from('produtos')
        .select('nome, quantidade')
        .eq('id', produtoId)
        .eq('organizacao_id', user.organizacao_id)
        .maybeSingle();
      if (!produto.data) throw new Error('Produto não encontrado.');

      const mov = await cliente.from('movimentacoes').insert([{
        organizacao_id: user.organizacao_id,
        produto_id: produtoId,
        produto_nome: produto.data.nome,
        tipo: 'entrada',
        quantidade: qtd,
        valor: 0,
        observacao: obs
      }]);
      if (mov.error) throw mov.error;

      const atualiza = await cliente.from('produtos')
        .update({ quantidade: Number(produto.data.quantidade) + qtd })
        .eq('id', produtoId);
      if (atualiza.error) throw atualiza.error;
      return;
    }

    const atual = db();
    const produto = atual.produtos.find(function (p) { return p.id === produtoId; });
    if (!produto) throw new Error('Produto não encontrado.');
    produto.quantidade = Number(produto.quantidade) + qtd;
    atual.movimentacoes.push({
      id: uid(),
      produto_id: produtoId,
      produto_nome: produto.nome,
      tipo: 'entrada',
      quantidade: qtd,
      valor: 0,
      observacao: obs,
      criado_em: new Date().toISOString()
    });
    salvarDb();
  }

  async function salvarConfig(dados) {
    if (modo === 'remoto') {
      const user = await usuario();
      const { error } = await cliente.from('organizacoes').update({
        nome: dados.organizacao,
        segmento: dados.segmento,
        notificacoes: dados.notificacoes
      }).eq('id', user.organizacao_id);
      if (error) throw error;
      return;
    }
    db().organizacao = Object.assign({}, db().organizacao || {}, {
      id: 'local-org',
      nome: dados.organizacao,
      segmento: dados.segmento,
      notificacoes: dados.notificacoes
    });
    localStorage.setItem('gestlux_config', JSON.stringify(dados));
    salvarDb();
  }

  async function listarUsuarios() {
    if (modo === 'remoto') {
      const user = await usuario();
      const { data, error } = await cliente.from('perfis')
        .select('id, nome, email, papel, criado_em')
        .eq('organizacao_id', user.organizacao_id);
      if (error) throw error;
      return data || [];
    }
    return db().usuarios.slice();
  }

  async function detalhesConvite(token) {
    if (!token) throw new Error('Link de convite inválido.');
    if (modo === 'remoto') {
      const { data, error } = await cliente.rpc('detalhes_convite', { p_token: token });
      if (error) throw error;
      return (data && data[0]) || null;
    }
    const convite = localConviteValido(token);
    if (!convite) return null;
    return {
      email: convite.email,
      nome: convite.nome,
      papel: convite.papel,
      organizacao: db().organizacao.nome,
      segmento: db().organizacao.segmento
    };
  }

  async function criarConvite(email, nome, papel) {
    const emailLimpo = String(email || '').trim().toLowerCase();
    if (!emailLimpo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      throw new Error('Informe um e-mail válido.');
    }
    if (!['admin', 'gerente', 'operador'].includes(papel)) throw new Error('Papel inválido.');

    if (modo === 'remoto') {
      const { data, error } = await cliente.rpc('criar_convite', {
        p_email: emailLimpo,
        p_nome: String(nome || '').trim(),
        p_papel: papel
      });
      if (error) throw traduzirErroConvite(error);
      return data;
    }

    const atual = db();
    if (!atual.convites) atual.convites = [];
    if (atual.convites.some(function (c) { return c.email === emailLimpo && c.status === 'pendente'; })) {
      throw new Error('Já existe um convite pendente para este e-mail.');
    }
    const token = encodeURIComponent(uid().replace(/[^a-z0-9]/gi, '') + Math.random().toString(36).slice(2, 18));
    atual.convites.push({
      id: uid(),
      email: emailLimpo,
      nome: String(nome || '').trim(),
      papel: papel,
      token: token,
      status: 'pendente',
      criado_em: new Date().toISOString()
    });
    salvarDb();
    return token;
  }

  async function listarConvites() {
    if (modo === 'remoto') {
      const { data, error } = await cliente.from('convites')
        .select('id, email, nome, papel, token, status, criado_em')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    const atual = db();
    if (!atual.convites) atual.convites = [];
    return atual.convites.slice();
  }

  async function cancelarConvite(token) {
    if (!token) return;
    if (modo === 'remoto') {
      const { error } = await cliente.rpc('cancelar_convite', { p_token: token });
      if (error) throw error;
      return;
    }
    const atual = db();
    const convite = (atual.convites || []).find(function (c) { return c.token === token; });
    if (convite) convite.status = 'cancelado';
    salvarDb();
  }

  async function atualizarPapel(usuarioId, papel) {
    if (!['admin', 'gerente', 'operador'].includes(papel)) throw new Error('Papel inválido.');
    if (modo === 'remoto') {
      const { error } = await cliente.rpc('atualizar_papel', {
        p_usuario_id: usuarioId,
        p_papel: papel
      });
      if (error) throw error;
      return;
    }
    const atual = db();
    const pessoa = (atual.usuarios || []).find(function (u) { return u.id === usuarioId; });
    if (!pessoa) throw new Error('Pessoa não encontrada.');
    pessoa.papel = papel;
    salvarDb();
  }

  function traduzirErroConvite(erro) {
    if (erro && erro.code === '23505') {
      return new Error('Já existe um convite pendente para este e-mail.');
    }
    return erro;
  }

  window.GESTLUX_BACKEND = {
    iniciar: iniciar,
    get modo() { return modo; },
    get remoto() { return modo === 'remoto'; },
    login: login,
    cadastro: cadastro,
    logout: logout,
    usuario: usuario,
    carregarDados: carregarDados,
    adicionarProduto: adicionarProduto,
    atualizarProduto: atualizarProduto,
    excluirProduto: excluirProduto,
    registrarVenda: registrarVenda,
    registrarEntrada: registrarEntrada,
    salvarOnboarding: salvarOnboarding,
    salvarConfig: salvarConfig,
    listarUsuarios: listarUsuarios,
    detalhesConvite: detalhesConvite,
    criarConvite: criarConvite,
    listarConvites: listarConvites,
    cancelarConvite: cancelarConvite,
    atualizarPapel: atualizarPapel
  };
})();
