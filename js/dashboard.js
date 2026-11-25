/* ===========================
   GESTLUX - DASHBOARD OPERACIONAL
   Dados reais do backend com fallback local
   =========================== */
(function () {
  'use strict';

  const B = window.GESTLUX_BACKEND || null;
  const modulos = (window.GESTLUX && window.GESTLUX.modulos) || [];
  let grafico = null;
  let viewAtual = 'home';
  let dados = { produtos: [], movimentacoes: [] };
  let usuarioAtual = null;
  let buscaEstoque = '';
  let filtroTipoProduto = '';
  let filtroInicio = '';
  let filtroFim = '';
  let filtroVendedor = '';
  let filtroTipoMov = '';

  function esc(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function substituir(texto, mapa) {
    return String(texto || '').replace(/\{(\w+)\}/g, function (_, chave) {
      return Object.prototype.hasOwnProperty.call(mapa, chave) ? String(mapa[chave]) : '{' + chave + '}';
    });
  }

  function toast(mensagem, tipo) {
    if (window.mostrarToast) window.mostrarToast(mensagem, tipo);
  }

  async function carregarFornecedores() {
    const lista = document.getElementById('lista-fornecedores');
    if (!lista || !B) return;
    let nomes = [];
    try {
      nomes = await B.listarFornecedores();
    } catch (e) {
      nomes = [];
    }
    lista.innerHTML = nomes.map(function (nome) {
      return '<option value="' + esc(nome) + '"></option>';
    }).join('');
  }

  function numero(valor) {
    const n = Number(valor);
    return isFinite(n) ? n : 0;
  }

  function dinheiro(valor) {
    return 'R$ ' + numero(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function modulosAtivos() {
    const org = (usuarioAtual && usuarioAtual.organizacao) || {};
    const selecionados = (org.modulos || []).map(String);
    if (!selecionados.length) return modulos.slice();
    return modulos.filter(function (m) { return selecionados.indexOf(String(m.id)) !== -1; });
  }

  function papelAtual() {
    return (usuarioAtual && usuarioAtual.papel) || 'operador';
  }

  function podeAcessar(view) {
    const papel = papelAtual();
    if (papel === 'admin') return true;
    if (papel === 'gerente') {
      return ['home', 'inventory', 'reports', 'users'].indexOf(view) !== -1;
    }
    return ['home', 'inventory', 'reports'].indexOf(view) !== -1;
  }

  function podeGerenciarProdutos() {
    return ['admin', 'gerente'].indexOf(papelAtual()) !== -1;
  }

  function semPermissaoHTML() {
    return '<div class="card"><div class="card-header"><h3>' + esc('Sem permissão') + '</h3></div>' +
      '<div class="card-body"><p class="texto-suave">' +
      esc('Seu papel não tem acesso a esta área.') + '</p></div></div>';
  }

  function aplicarPreferenciasNav() {
    const org = (usuarioAtual && usuarioAtual.organizacao) || {};
    const temSelecao = !!(org.modulos && org.modulos.length);
    const ativos = modulosAtivos().map(function (m) { return String(m.id); });
    const usaVarejo = !temSelecao || ativos.indexOf('7') !== -1 || ativos.indexOf('8') !== -1;

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (item) {
      const view = item.getAttribute('data-view');
      const li = item.closest('li');
      if (!li) return;
      const porPapel = podeAcessar(view);
      const porModulo = view === 'inventory' || view === 'reports' ? usaVarejo : true;
      li.hidden = !porPapel || !porModulo;
    });
  }

  function dataCurta(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  }

  function dataHora(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function chaveDia(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function nomeProduto(mov) {
    if (mov.produto_nome) return mov.produto_nome;
    const produto = dados.produtos.find(function (p) { return p.id === mov.produto_id; });
    return produto ? produto.nome : "Produto";
  }

  function vendas30() {
    const corte = Date.now() - 30 * 86400000;
    return dados.movimentacoes.filter(function (m) {
      return m.tipo === 'venda' && new Date(m.criado_em).getTime() >= corte;
    });
  }

  function produtosEmAlerta() {
    return dados.produtos.filter(function (p) {
      return numero(p.quantidade) <= numero(p.minimo);
    });
  }

  async function carregar() {
    if (!B) return;

    try {
      usuarioAtual = await B.usuario();
    } catch (e) {
      usuarioAtual = null;
    }

    try {
      dados = await B.carregarDados();
    } catch (e) {
      dados = { produtos: [], movimentacoes: [] };
      toast('Não foi possível carregar os dados do backend.', 'erro');
    }
  }

  async function recarregarEAtualizar() {
    await carregar();
    await renderizarViewAtual();
  }

  function atualizarModoBadge() {
    const badge = document.getElementById('modo-badge');
    if (!badge || !B) return;
    badge.textContent = B.remoto ? "Supabase conectado" : "Modo local";
    badge.classList.toggle('modo-remoto', B.remoto);
    badge.title = B.remoto ? 'Postgres + Auth + RLS' : 'localStorage';
  }

  function atualizarCabecalho() {
    const cfg = views[viewAtual] || views.home;
    const org = (usuarioAtual && usuarioAtual.organizacao) || {};
    const nomeOrg = String(org.nome || '').trim();
    const segmento = String(org.segmento || 'varejo');
    const rotuloSegmento = {
      empresarial: 'Empresarial', educacional: 'Educacional',
      saude: 'Saúde', varejo: 'Varejo', outro: 'Outro'
    }[segmento] || segmento;

    let subtituloTexto = cfg.subtitle;
    if (nomeOrg && viewAtual === 'home') {
      subtituloTexto = 'Indicadores reais de ' + nomeOrg + ' · ' + rotuloSegmento + '.';
    } else if (nomeOrg && viewAtual === 'modules') {
      subtituloTexto = 'Módulos ativos em ' + nomeOrg + ' · ' + rotuloSegmento + '.';
    }

    const titulo = document.getElementById('view-title');
    const subtitulo = document.getElementById('view-subtitle');
    if (titulo) titulo.textContent = cfg.title;
    if (subtitulo) subtitulo.textContent = subtituloTexto;
    const papel = document.getElementById('user-papel');
    if (papel) papel.textContent = nomePapel(papelAtual());
    atualizarModoBadge();
  }

  function definirValor(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  }

  function definirTrend(id, texto, classe) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'metric-trend ' + (classe || 'neutral');
    el.textContent = texto;
  }

  function atualizarMetricas() {
    const vendas = vendas30();
    const total = vendas.reduce(function (soma, m) { return soma + numero(m.valor); }, 0);
    const itens = vendas.reduce(function (soma, m) { return soma + numero(m.quantidade); }, 0);
    const alertas = produtosEmAlerta();

    definirValor('metrica-vendas', dinheiro(total));
    definirValor('metrica-produtos', String(dados.produtos.length));
    definirValor('metrica-alertas', String(alertas.length));
    definirValor('metrica-pedidos', String(vendas.length));

    definirTrend('metrica-vendas-trend', substituir("{n} itens vendidos", { n: itens }), 'positive');
    definirTrend('metrica-produtos-trend', B && B.remoto ? "Supabase conectado" : "Modo local", 'neutral');
    definirTrend('metrica-alertas-trend', alertas.length ? "Reposição necessária" : "Tudo dentro do mínimo", alertas.length ? 'negative' : 'positive');
    definirTrend('metrica-pedidos-trend', "Últimos 7 dias", 'neutral');
  }

  function renderizarGrafico() {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      canvas.classList.add('hidden');
      const fallback = document.getElementById('grafico-fallback');
      if (fallback) fallback.classList.remove('hidden');
      return;
    }

    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      dias.push({
        chave: chaveDia(d),
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      });
    }

    const valores = dias.map(function (dia) {
      return dados.movimentacoes
        .filter(function (m) {
          return m.tipo === 'venda' && chaveDia(new Date(m.criado_em)) === dia.chave;
        })
        .reduce(function (soma, m) { return soma + numero(m.valor); }, 0);
    });

    const cor = getComputedStyle(document.documentElement).getPropertyValue('--cor-primaria').trim() || '#2563eb';
    if (grafico) grafico.destroy();

    grafico = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: dias.map(function (d) { return d.label; }),
        datasets: [{
          label: "Vendas em 30 dias",
          data: valores,
          borderColor: cor,
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: { label: function (c) { return dinheiro(c.parsed.y); } }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: function (v) { return 'R$ ' + Number(v).toLocaleString('pt-BR'); } },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function atualizarVendasRecentes() {
    const body = document.getElementById('vendas-recentes-body');
    if (!body) return;

    const linhas = dados.movimentacoes
      .filter(function (m) { return m.tipo === 'venda'; })
      .slice(0, 6);

    if (!linhas.length) {
      body.innerHTML = '<tr><td colspan="4" class="tabela-vazia">' + esc("Nenhum registro ainda.") + '</td></tr>';
      return;
    }

    body.innerHTML = linhas.map(function (m) {
      return '<tr>' +
        '<td>' + esc(nomeProduto(m)) + '</td>' +
        '<td>' + numero(m.quantidade) + '</td>' +
        '<td>' + esc(dataCurta(m.criado_em)) + '</td>' +
        '<td><span class="status status-success">' + esc(dinheiro(m.valor)) + '</span></td>' +
        '</tr>';
    }).join('');
  }

  function renderModulos(painel, filtro) {
    if (!podeAcessar('modules')) {
      painel.innerHTML = semPermissaoHTML();
      return;
    }
    const ativos = modulosAtivos();
    const filtrados = filtro === 'todos'
      ? ativos
      : ativos.filter(function (m) { return m.tema === filtro; });

    const temas = ['todos', 'empresarial', 'educacional', 'saude', 'varejo'];
    const rotulos = {
      todos: "Todos",
      empresarial: "Empresarial",
      educacional: "Educacional",
      saude: "Saúde",
      varejo: "Varejo"
    };

    painel.innerHTML =
      '<div class="filter-chips" role="group" aria-label="' + esc("Filtrar módulos") + '">' +
      temas.map(function (tema) {
        return '<button type="button" class="chip' + (tema === filtro ? ' active' : '') +
          '" data-filtro="' + tema + '">' + esc(rotulos[tema]) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="modulos-grid">' +
      (filtrados.length
        ? filtrados.map(function (m) {
          return '<article class="modulo-card">' +
            '<div class="modulo-icon"><i class="' + esc(m.icone) + '"></i></div>' +
            '<h3>' + esc(m.titulo) + '</h3><p>' + esc(m.descricao) + '</p>' +
            '<div class="modulo-tags">' + m.tags.map(function (tag) {
              return '<span class="modulo-tag">' + esc(tag) + '</span>';
            }).join('') + '</div></article>';
        }).join('')
        : '<p class="modulos-vazios">' + esc("Nenhum módulo ativo neste filtro. Ajuste em Configurações.") + '</p>') +
      '</div>';

    painel.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        renderModulos(painel, chip.getAttribute('data-filtro'));
      });
    });
  }

  const tiposProduto = [
    { valor: 'alimentos', rotulo: 'Alimentos' },
    { valor: 'vestuario', rotulo: 'Vestuário' },
    { valor: 'outros', rotulo: 'Outros' }
  ];

  function rotuloTipoProduto(valor) {
    const tipo = tiposProduto.find(function (t) { return t.valor === valor; });
    return tipo ? tipo.rotulo : '—';
  }

  function opcoesTipoProdutoAtual() {
    const opcoes = [
      { valor: '', rotulo: 'Todos os tipos' },
      { valor: 'sem-tipo', rotulo: 'Sem tipo' }
    ].concat(tiposProduto);
    return opcoes.map(function (opcao) {
      return '<option value="' + esc(opcao.valor) + '"' +
        (opcao.valor === filtroTipoProduto ? ' selected' : '') + '>' + esc(opcao.rotulo) + '</option>';
    }).join('');
  }

  function renderEstoque(painel) {
    painel.innerHTML =
      '<section class="card-body estoque-lista">' +
      '<div class="estoque-cabecalho">' +
      '<h3>' + esc("Produtos cadastrados") + '</h3>' +
      (podeGerenciarProdutos()
        ? '<button type="button" class="btn btn-primary btn-sm" id="btn-novo-produto">' +
          '<i class="fa-solid fa-plus" aria-hidden="true"></i> ' + esc("Novo produto") + '</button>'
        : '') +
      '</div>' +
      '<div class="estoque-filtros">' +
      '<div class="estoque-busca">' +
      '<i class="fa-solid fa-magnifying-glass estoque-busca-icone" aria-hidden="true"></i>' +
      '<input id="estoque-busca" type="search" placeholder="' + esc("Buscar por nome ou SKU...") +
      '" value="' + esc(buscaEstoque) + '" aria-label="' + esc("Buscar produto") + '" />' +
      '</div>' +
      '<label>' + esc("Tipo") + ' <select id="filtro-tipo-produto" aria-label="' + esc("Filtrar por tipo de produto") + '">' +
      opcoesTipoProdutoAtual() + '</select></label>' +
      '</div>' +
      '<div id="estoque-alerta">' + alertaEstoqueHTML() + '</div>' +
      '<div id="estoque-tabela">' + tabelaEstoqueHTML() + '</div>' +
      '</section>';

    ligarEventosEstoque();
  }

  function alertaEstoqueHTML() {
    const alertas = produtosEmAlerta();
    if (!alertas.length) return '';

    const nomesAlerta = alertas.map(function (p) {
      return esc(p.nome) + ' (' + numero(p.quantidade) + ')';
    }).join(' · ');

    return '<div class="alerta-estoque" role="status">' +
      '<i class="fa-solid fa-triangle-exclamation"></i>' +
      '<div><strong>' + esc(substituir("Atenção: {n} produto(s) abaixo do nível mínimo.", { n: alertas.length })) + '</strong>' +
      '<p>' + nomesAlerta + '</p></div></div>';
  }

  function produtosFiltrados() {
    const termo = buscaEstoque.trim().toLowerCase();
    return dados.produtos.filter(function (p) {
      if (termo &&
        (p.nome || '').toLowerCase().indexOf(termo) === -1 &&
        (p.sku || '').toLowerCase().indexOf(termo) === -1) {
        return false;
      }
      if (filtroTipoProduto === 'sem-tipo' && p.tipo_produto) return false;
      if (filtroTipoProduto && filtroTipoProduto !== 'sem-tipo' && p.tipo_produto !== filtroTipoProduto) return false;
      return true;
    });
  }

  function tabelaEstoqueHTML() {
    if (!dados.produtos.length) {
      return '<p class="tabela-vazia">' + esc("Nenhum produto cadastrado. Clique em Novo produto para começar.") + '</p>';
    }

    const filtrados = produtosFiltrados();
    if (!filtrados.length) {
      return '<p class="tabela-vazia">' + esc("Nenhum produto encontrado para os filtros aplicados.") + '</p>';
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const linhas = filtrados.map(function (p) {
      const baixo = numero(p.quantidade) <= numero(p.minimo);
      const validade = p.data_validade ? new Date(p.data_validade + 'T00:00:00') : null;
      const vencido = validade && validade < hoje;
      const acoes = '<button type="button" class="btn btn-primary btn-sm btn-repor" data-id="' + esc(p.id) +
        '" data-nome="' + esc(p.nome) + '">' + esc("Repor") + '</button>' +
        (podeGerenciarProdutos()
          ? '<button type="button" class="btn btn-outline btn-sm btn-editar" data-id="' + esc(p.id) +
            '" aria-label="' + esc("Editar produto") + '">' + esc("Editar") + '</button>' +
            '<button type="button" class="btn btn-danger btn-sm btn-excluir" data-id="' + esc(p.id) +
            '" aria-label="' + esc("Excluir produto") + '">' + esc("Excluir") + '</button>'
          : '');
      return '<tr>' +
        '<td><strong>' + esc(p.nome) + '</strong>' +
        (p.nota_fiscal ? '<small class="produto-nota">NF: ' + esc(p.nota_fiscal) + '</small>' : '') +
        (p.codigo_barras ? '<small class="produto-nota">Cód: ' + esc(p.codigo_barras) + '</small>' : '') +
        (p.fornecedor_padrao ? '<small class="produto-nota">Forn: ' + esc(p.fornecedor_padrao) + '</small>' : '') +
        '</td>' +
        '<td>' + esc(p.sku || '—') + '</td>' +
        '<td>' + esc(rotuloTipoProduto(p.tipo_produto)) + '</td>' +
        '<td>' + (p.data_validade
          ? '<span' + (vencido ? ' class="validade-vencida"' : '') + '>' + esc(dataCurta(p.data_validade)) + '</span>' +
            (vencido ? '<small class="produto-nota">Vencido</small>' : '')
          : '—') + '</td>' +
        '<td>' + esc(dinheiro(p.preco)) + '</td>' +
        '<td>' + numero(p.quantidade) + '</td>' +
        '<td><span class="status ' + (baixo ? 'status-error' : 'status-success') + '">' +
        esc(baixo ? "Baixo" : "Normal") + '</span></td>' +
        '<td><div class="venda-inline">' +
        '<input type="number" class="venda-qtd" min="1" max="' + numero(p.quantidade) +
        '" value="1" aria-label="' + esc("Quantidade") + '" />' +
        '<button type="button" class="btn btn-primary btn-sm btn-vender" data-id="' + esc(p.id) +
        '" data-nome="' + esc(p.nome) + '">' + esc("Vender") + '</button>' +
        '</div></td>' +
        '<td><div class="acoes-produto">' + acoes + '</div></td></tr>';
    }).join('');

    return '<div class="table-responsive"><table class="data-table"><thead><tr>' +
      '<th>' + esc("Produto") + '</th>' +
      '<th>' + esc("SKU") + '</th>' +
      '<th>' + esc("Tipo") + '</th>' +
      '<th>' + esc("Validade") + '</th>' +
      '<th>' + esc("Preço") + '</th>' +
      '<th>' + esc("Estoque") + '</th>' +
      '<th>' + esc("Status") + '</th>' +
      '<th>' + esc("Ação") + '</th>' +
      '<th>' + esc("Ações") + '</th>' +
      '</tr></thead><tbody>' + linhas + '</tbody></table></div>';
  }

  function atualizarEstoqueTabela() {
    const alerta = document.getElementById('estoque-alerta');
    const tabela = document.getElementById('estoque-tabela');
    if (alerta) alerta.innerHTML = alertaEstoqueHTML();
    if (tabela) tabela.innerHTML = tabelaEstoqueHTML();
  }

  function skuDuplicado(sku, idIgnorado) {
    const alvo = String(sku || '').trim().toLowerCase();
    if (!alvo) return false;
    return dados.produtos.some(function (p) {
      return p.id !== idIgnorado && String(p.sku || '').trim().toLowerCase() === alvo;
    });
  }

  function abrirModalNovoProduto() {
    const modal = document.getElementById('modal-novo-produto');
    if (!modal) return;
    const form = document.getElementById('novo-produto-form');
    if (form) form.reset();
    modal.hidden = false;
    const nome = document.getElementById('novo-nome');
    if (nome) nome.focus();
  }

  function fecharModalNovoProduto() {
    const modal = document.getElementById('modal-novo-produto');
    if (modal) modal.hidden = true;
  }

  function ligarEventosEstoque() {
    const botaoNovo = document.getElementById('btn-novo-produto');
    if (botaoNovo) botaoNovo.addEventListener('click', abrirModalNovoProduto);

    const filtroTipo = document.getElementById('filtro-tipo-produto');
    if (filtroTipo) {
      filtroTipo.addEventListener('change', function () {
        filtroTipoProduto = filtroTipo.value;
        atualizarEstoqueTabela();
      });
    }

    const busca = document.getElementById('estoque-busca');
    if (busca) {
      busca.addEventListener('input', function () {
        buscaEstoque = busca.value;
        atualizarEstoqueTabela();
      });
    }

    const tabela = document.getElementById('estoque-tabela');
    if (!tabela) return;

    tabela.addEventListener('click', async function (e) {
      const botao = e.target.closest('button');
      if (!botao) return;

      if (botao.classList.contains('btn-vender')) {
        const linha = botao.closest('tr');
        const input = linha && linha.querySelector('.venda-qtd');
        const quantidade = Number(input && input.value);
        const produto = dados.produtos.find(function (p) { return p.id === botao.getAttribute('data-id'); });

        if (!quantidade || quantidade < 1 || (produto && quantidade > numero(produto.quantidade))) {
          toast("Informe uma quantidade entre 1 e o estoque disponível.", 'erro');
          if (input) input.focus();
          return;
        }

        botao.textContent = '...';
        botao.disabled = true;

        try {
          if (!B) throw new Error('Backend indisponível.');
          await B.registrarVenda(botao.getAttribute('data-id'), quantidade, usuarioAtual);
          toast(substituir("Venda registrada: {q} unidade(s) de {n}.", { q: quantidade, n: botao.getAttribute('data-nome') }));
          await recarregarEAtualizar();
        } catch (erro) {
          toast((erro && erro.message) || "Não foi possível concluir a operação.", 'erro');
          botao.textContent = "Vender";
          botao.disabled = false;
        }
        return;
      }

      if (botao.classList.contains('btn-repor')) {
        const produto = dados.produtos.find(function (p) { return p.id === botao.getAttribute('data-id'); });
        if (produto) abrirModalEntrada(produto);
        return;
      }

      if (botao.classList.contains('btn-editar')) {
        const produto = dados.produtos.find(function (p) { return p.id === botao.getAttribute('data-id'); });
        if (produto) abrirModalProduto(produto);
        return;
      }

      if (botao.classList.contains('btn-excluir')) {
        const produto = dados.produtos.find(function (p) { return p.id === botao.getAttribute('data-id'); });
        if (!produto) return;

        const confirmado = window.confirm(
          substituir("Excluir \"{n}\"? Esta ação não pode ser desfeita.", { n: produto.nome })
        );
        if (!confirmado) return;

        botao.textContent = '...';
        botao.disabled = true;

        try {
          if (!B) throw new Error('Backend indisponível.');
          await B.excluirProduto(produto.id);
          toast("Produto excluído.");
          await recarregarEAtualizar();
        } catch (erro) {
          toast((erro && erro.message) || "Não foi possível excluir o produto.", 'erro');
          botao.textContent = "Excluir";
          botao.disabled = false;
        }
      }
    });
  }

  function historicoProdutoHTML(produto) {
    const movs = dados.movimentacoes.filter(function (m) {
      return m.produto_id === produto.id || (!m.produto_id && m.produto_nome === produto.nome);
    }).slice(0, 10);

    if (!movs.length) {
      return '<p class="historico-vazio">Nenhuma movimentação registrada.</p>';
    }

    const rotulos = { venda: "Venda", entrada: "Entrada", saida: "Saída" };
    return '<ul class="historico-lista">' + movs.map(function (m) {
      const detalhes = [];
      if (m.fornecedor) detalhes.push('Forn: ' + m.fornecedor);
      if (m.lote) detalhes.push('Lote: ' + m.lote);
      if (m.data_validade) detalhes.push('Val: ' + dataCurta(m.data_validade));
      return '<li><span>' + esc(dataHora(m.criado_em)) + '</span>' +
        '<strong>' + esc(rotulos[m.tipo] || m.tipo) + '</strong>' +
        '<span>' + numero(m.quantidade) + ' un.</span>' +
        (detalhes.length ? '<small class="historico-detalhes">' + esc(detalhes.join(' · ')) + '</small>' : '') +
        (m.observacao ? '<em>' + esc(m.observacao) + '</em>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function abrirModalProduto(produto) {
    const modal = document.getElementById('modal-produto');
    if (!modal || !produto) return;

    document.getElementById('modal-produto-id').value = produto.id;
    document.getElementById('modal-nome').value = produto.nome || '';
    document.getElementById('modal-sku').value = produto.sku || '';
    document.getElementById('modal-preco').value = numero(produto.preco);
    document.getElementById('modal-qtd').value = numero(produto.quantidade);
    document.getElementById('modal-min').value = numero(produto.minimo);
    document.getElementById('modal-tipo').value = produto.tipo_produto || '';
    document.getElementById('modal-validade').value = produto.data_validade || '';
    document.getElementById('modal-nota').value = produto.nota_fiscal || '';
    document.getElementById('modal-codigo').value = produto.codigo_barras || '';
    document.getElementById('modal-fornecedor').value = produto.fornecedor_padrao || '';

    const historico = document.getElementById('modal-historico');
    if (historico) historico.innerHTML = historicoProdutoHTML(produto);

    modal.hidden = false;
    document.getElementById('modal-nome').focus();
  }

  function fecharModalProduto() {
    const modal = document.getElementById('modal-produto');
    if (modal) modal.hidden = true;
  }

  function registrarEventosModal() {
    const modalNovo = document.getElementById('modal-novo-produto');
    if (modalNovo) {
      const cancelarNovo = document.getElementById('novo-cancelar');
      if (cancelarNovo) cancelarNovo.addEventListener('click', fecharModalNovoProduto);
      modalNovo.addEventListener('click', function (e) {
        if (e.target === modalNovo) fecharModalNovoProduto();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modalNovo.hidden) fecharModalNovoProduto();
      });

      const formNovo = document.getElementById('novo-produto-form');
      if (formNovo) {
        formNovo.addEventListener('submit', async function (e) {
          e.preventDefault();
          const sku = document.getElementById('novo-sku').value.trim();
          if (skuDuplicado(sku, null)) {
            toast('SKU já cadastrado nesta organização.', 'erro');
            return;
          }

          const btn = formNovo.querySelector('button[type="submit"]');
          const textoOriginal = btn.textContent;
          btn.textContent = '...';
          btn.disabled = true;

          try {
            if (!B) throw new Error('Backend indisponível.');
            await B.adicionarProduto({
              nome: document.getElementById('novo-nome').value.trim(),
              sku: sku,
              preco: document.getElementById('novo-preco').value,
              quantidade: document.getElementById('novo-qtd').value,
              minimo: document.getElementById('novo-min').value,
              tipo_produto: document.getElementById('novo-tipo').value,
              data_validade: document.getElementById('novo-validade').value,
              nota_fiscal: document.getElementById('novo-nota').value.trim(),
              codigo_barras: document.getElementById('novo-codigo').value.trim(),
              fornecedor_padrao: document.getElementById('novo-fornecedor').value.trim()
            });
            fecharModalNovoProduto();
            await carregarFornecedores();
            toast('Produto adicionado e persistido.');
            buscaEstoque = '';
            filtroTipoProduto = '';
            await recarregarEAtualizar();
          } catch (erro) {
            toast((erro && erro.message) || 'Não foi possível concluir a operação.', 'erro');
          } finally {
            btn.textContent = textoOriginal;
            btn.disabled = false;
          }
        });
      }
    }

    const modal = document.getElementById('modal-produto');
    if (!modal) return;

    const cancelar = document.getElementById('modal-cancelar');
    if (cancelar) cancelar.addEventListener('click', fecharModalProduto);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) fecharModalProduto();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) fecharModalProduto();
    });

    const form = document.getElementById('modal-produto-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const id = document.getElementById('modal-produto-id').value;
      const sku = document.getElementById('modal-sku').value.trim();

      if (skuDuplicado(sku, id)) {
        toast("SKU já cadastrado nesta organização.", 'erro');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = '...';
      btn.disabled = true;

      try {
        if (!B) throw new Error('Backend indisponível.');
        await B.atualizarProduto(id, {
          nome: document.getElementById('modal-nome').value.trim(),
          sku: sku,
          preco: document.getElementById('modal-preco').value,
          quantidade: document.getElementById('modal-qtd').value,
          minimo: document.getElementById('modal-min').value,
          tipo_produto: document.getElementById('modal-tipo').value,
          data_validade: document.getElementById('modal-validade').value,
          nota_fiscal: document.getElementById('modal-nota').value.trim(),
          codigo_barras: document.getElementById('modal-codigo').value.trim(),
          fornecedor_padrao: document.getElementById('modal-fornecedor').value.trim()
        });
        fecharModalProduto();
        await carregarFornecedores();
        toast("Produto atualizado.");
        btn.textContent = "Salvar alterações";
        btn.disabled = false;
        await recarregarEAtualizar();
      } catch (erro) {
        toast((erro && erro.message) || "Não foi possível salvar o produto.", 'erro');
        btn.textContent = "Salvar alterações";
        btn.disabled = false;
      }
    });
  }

  function abrirModalEntrada(produto) {
    const modal = document.getElementById('modal-entrada');
    if (!modal || !produto) return;

    document.getElementById('entrada-produto-id').value = produto.id;
    document.getElementById('entrada-produto-nome').textContent = produto.nome;
    document.getElementById('entrada-qtd').value = '';
    document.getElementById('entrada-fornecedor').value = produto.fornecedor_padrao || '';
    document.getElementById('entrada-lote').value = '';
    document.getElementById('entrada-validade').value = '';
    document.getElementById('entrada-obs').value = '';
    modal.hidden = false;
    document.getElementById('entrada-qtd').focus();
  }

  function fecharModalEntrada() {
    const modal = document.getElementById('modal-entrada');
    if (modal) modal.hidden = true;
  }

  function registrarEventosEntrada() {
    const modal = document.getElementById('modal-entrada');
    if (!modal) return;

    const cancelar = document.getElementById('entrada-cancelar');
    if (cancelar) cancelar.addEventListener('click', fecharModalEntrada);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) fecharModalEntrada();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) fecharModalEntrada();
    });

    const form = document.getElementById('modal-entrada-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const quantidade = Number(document.getElementById('entrada-qtd').value);
      if (!quantidade || quantidade <= 0) {
        toast("Informe uma quantidade maior que zero.", 'erro');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = '...';
      btn.disabled = true;

      try {
        if (!B) throw new Error('Backend indisponível.');
        await B.registrarEntrada(
          document.getElementById('entrada-produto-id').value,
          quantidade,
          document.getElementById('entrada-obs').value.trim(),
          {
            fornecedor: document.getElementById('entrada-fornecedor').value.trim(),
            lote: document.getElementById('entrada-lote').value.trim(),
            data_validade: document.getElementById('entrada-validade').value
          }
        );
        fecharModalEntrada();
        await carregarFornecedores();
        toast(substituir("Entrada registrada: {q} unidade(s) de {n}.", {
          q: quantidade,
          n: document.getElementById('entrada-produto-nome').textContent
        }));
        await recarregarEAtualizar();
      } catch (erro) {
        toast((erro && erro.message) || "Não foi possível registrar a entrada.", 'erro');
      }
      btn.textContent = "Registrar entrada";
      btn.disabled = false;
    });
  }

  function nomeVendedor(m) {
    if (m && m.vendedor_nome) return String(m.vendedor_nome);
    return 'Sem vendedor';
  }

  function origemMovimentacao(m) {
    const partes = [];
    if (m && m.fornecedor) partes.push(String(m.fornecedor));
    if (m && m.lote) partes.push('Lote ' + m.lote);
    if (m && m.data_validade) partes.push('Val ' + dataCurta(m.data_validade));
    return partes.join(' · ');
  }

  function vendedoresDisponiveis() {
    const nomes = [];
    dados.movimentacoes.forEach(function (m) {
      const nome = nomeVendedor(m);
      if (nomes.indexOf(nome) === -1) nomes.push(nome);
    });
    return nomes.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }

  function movimentacoesFiltradas() {
    const ini = filtroInicio ? new Date(filtroInicio).getTime() : -Infinity;
    const fim = filtroFim ? new Date(filtroFim).getTime() : Infinity;
    return dados.movimentacoes.filter(function (m) {
      const t = new Date(m.criado_em).getTime();
      if (t < ini || t > fim) return false;
      if (filtroVendedor && nomeVendedor(m) !== filtroVendedor) return false;
      if (filtroTipoMov === 'qualquer_saida') return m.tipo === 'venda' || m.tipo === 'saida';
      if (filtroTipoMov && m.tipo !== filtroTipoMov) return false;
      return true;
    });
  }

  function vendasPorPessoaHTML() {
    const vendas = movimentacoesFiltradas().filter(function (m) { return m.tipo === 'venda'; });
    const grupos = {};
    vendas.forEach(function (m) {
      const nome = nomeVendedor(m);
      if (!grupos[nome]) grupos[nome] = { quantidade: 0, total: 0, vendas: 0 };
      grupos[nome].quantidade += numero(m.quantidade);
      grupos[nome].total += numero(m.valor);
      grupos[nome].vendas += 1;
    });

    const nomes = Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    if (!nomes.length) {
      return '<tr><td colspan="3" class="tabela-vazia">' + esc('Nenhuma venda no período.') + '</td></tr>';
    }
    return nomes.map(function (nome) {
      const g = grupos[nome];
      return '<tr>' +
        '<td>' + esc(nome) + '</td>' +
        '<td>' + g.vendas + '</td>' +
        '<td>' + esc(dinheiro(g.total)) + '</td>' +
        '</tr>';
    }).join('');
  }

  function exportarCSV() {
    const linhas = [["Data e hora", "Produto", "Tipo", "Qtd", "Valor", "Vendedor", "Origem", "Observação"]];

    movimentacoesFiltradas().forEach(function (m) {
      linhas.push([
        dataHora(m.criado_em),
        nomeProduto(m),
        m.tipo,
        numero(m.quantidade),
        numero(m.valor).toFixed(2),
        nomeVendedor(m),
        origemMovimentacao(m),
        m.observacao || ''
      ]);
    });

    const csv = '\ufeff' + linhas.map(function (linha) {
      return linha.map(function (valor) {
        return '"' + String(valor).replace(/"/g, '""') + '"';
      }).join(';');
    }).join('\r\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gestlux-movimentacoes.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Arquivo CSV exportado com os filtros aplicados.");
  }

  function relatorioResumoHTML() {
    const vendas = movimentacoesFiltradas().filter(function (m) { return m.tipo === 'venda'; });
    const total = vendas.reduce(function (soma, m) { return soma + numero(m.valor); }, 0);
    const ticket = vendas.length ? total / vendas.length : 0;

    return '<div class="resumo-card"><span>' + esc("Total vendido no período") + '</span><strong>' + esc(dinheiro(total)) + '</strong></div>' +
      '<div class="resumo-card"><span>' + esc("Ticket médio") + '</span><strong>' + esc(dinheiro(ticket)) + '</strong></div>' +
      '<div class="resumo-card"><span>' + esc("Vendas no período") + '</span><strong>' + vendas.length + '</strong></div>';
  }

  function relatorioCorpoHTML() {
    const movs = movimentacoesFiltradas().slice(0, 50);
    if (!movs.length) {
      return '<tr><td colspan="8" class="tabela-vazia">' + esc("Nenhum registro no período.") + '</td></tr>';
    }

    const rotulos = { venda: "Venda", entrada: "Entrada", saida: "Saída" };
    return movs.map(function (m) {
      return '<tr>' +
        '<td>' + esc(dataHora(m.criado_em)) + '</td>' +
        '<td>' + esc(nomeProduto(m)) + '</td>' +
        '<td>' + esc(rotulos[m.tipo] || m.tipo) + '</td>' +
        '<td>' + numero(m.quantidade) + '</td>' +
        '<td>' + esc(dinheiro(m.valor)) + '</td>' +
        '<td>' + esc(nomeVendedor(m)) + '</td>' +
        '<td>' + esc(origemMovimentacao(m) || '—') + '</td>' +
        '<td>' + esc(m.observacao || '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function atualizarRelatorio() {
    const resumo = document.getElementById('relatorio-resumo');
    const corpo = document.getElementById('relatorio-corpo');
    const pessoas = document.getElementById('vendas-por-pessoa-corpo');
    if (resumo) resumo.innerHTML = relatorioResumoHTML();
    if (corpo) corpo.innerHTML = relatorioCorpoHTML();
    if (pessoas) pessoas.innerHTML = vendasPorPessoaHTML();
  }

  function renderRelatorios(painel) {
    const vendedores = vendedoresDisponiveis();
    painel.innerHTML =
      '<div class="relatorio-filtros">' +
      '<label>' + esc("De") + ' <input type="datetime-local" id="filtro-inicio" value="' + esc(filtroInicio) + '" aria-label="' + esc("Início do período") + '" /></label>' +
      '<label>' + esc("Até") + ' <input type="datetime-local" id="filtro-fim" value="' + esc(filtroFim) + '" aria-label="' + esc("Fim do período") + '" /></label>' +
      '<label>' + esc("Vendedor") + ' <select id="filtro-vendedor" aria-label="' + esc("Filtrar por vendedor") + '">' +
      '<option value="">' + esc('Todos') + '</option>' +
      vendedores.map(function (nome) {
        return '<option value="' + esc(nome) + '"' + (nome === filtroVendedor ? ' selected' : '') + '>' + esc(nome) + '</option>';
      }).join('') +
      '</select></label>' +
      '<label>' + esc("Tipo") + ' <select id="filtro-tipo-mov" aria-label="' + esc("Filtrar entrada e saída") + '">' +
      '<option value="">' + esc('Todas') + '</option>' +
      '<option value="entrada"' + (filtroTipoMov === 'entrada' ? ' selected' : '') + '>' + esc('Entrada de estoque') + '</option>' +
      '<option value="venda"' + (filtroTipoMov === 'venda' ? ' selected' : '') + '>' + esc('Venda') + '</option>' +
      '<option value="saida"' + (filtroTipoMov === 'saida' ? ' selected' : '') + '>' + esc('Saída manual') + '</option>' +
      '<option value="qualquer_saida"' + (filtroTipoMov === 'qualquer_saida' ? ' selected' : '') + '>' + esc('Todas as saídas') + '</option>' +
      '</select></label>' +
      '<button type="button" class="btn btn-outline btn-sm" id="filtro-limpar">' + esc("Limpar") + '</button>' +
      '</div>' +
      '<div class="resumo-cards" id="relatorio-resumo">' + relatorioResumoHTML() + '</div>' +
      '<section class="card vendas-pessoa-card">' +
      '<div class="card-header"><h3>' + esc('Vendas por pessoa') + '</h3></div>' +
      '<div class="card-body table-responsive">' +
      '<table class="data-table"><thead><tr>' +
      '<th>' + esc('Vendedor') + '</th>' +
      '<th>' + esc('Vendas') + '</th>' +
      '<th>' + esc('Total') + '</th>' +
      '</tr></thead><tbody id="vendas-por-pessoa-corpo">' + vendasPorPessoaHTML() + '</tbody></table>' +
      '</div></section>' +
      '<div class="card-header relatorio-header">' +
      '<h3>' + esc("Movimentações no período") + '</h3>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-exportar">' + esc("Exportar CSV") + '</button>' +
      '</div>' +
      '<div class="card-body table-responsive">' +
      '<table class="data-table"><thead><tr>' +
      '<th>' + esc("Data e hora") + '</th>' +
      '<th>' + esc("Produto") + '</th>' +
      '<th>' + esc("Tipo") + '</th>' +
      '<th>' + esc("Qtd") + '</th>' +
      '<th>' + esc("Valor") + '</th>' +
      '<th>' + esc("Vendedor") + '</th>' +
      '<th>' + esc("Origem") + '</th>' +
      '<th>' + esc("Observação") + '</th>' +
      '</tr></thead><tbody id="relatorio-corpo">' + relatorioCorpoHTML() + '</tbody></table></div>';

    ['filtro-inicio', 'filtro-fim', 'filtro-vendedor', 'filtro-tipo-mov'].forEach(function (id) {
      const campo = document.getElementById(id);
      if (campo) {
        campo.addEventListener('change', function () {
          filtroInicio = document.getElementById('filtro-inicio').value;
          filtroFim = document.getElementById('filtro-fim').value;
          filtroVendedor = document.getElementById('filtro-vendedor').value;
          filtroTipoMov = document.getElementById('filtro-tipo-mov').value;
          atualizarRelatorio();
        });
      }
    });

    const limpar = document.getElementById('filtro-limpar');
    if (limpar) {
      limpar.addEventListener('click', function () {
        filtroInicio = '';
        filtroFim = '';
        filtroVendedor = '';
        filtroTipoMov = '';
        document.getElementById('filtro-inicio').value = '';
        document.getElementById('filtro-fim').value = '';
        document.getElementById('filtro-vendedor').value = '';
        document.getElementById('filtro-tipo-mov').value = '';
        atualizarRelatorio();
      });
    }

    const botao = document.getElementById('btn-exportar');
    if (botao) botao.addEventListener('click', exportarCSV);
  }

  const rotuloPapel = {
    admin: 'Administrador',
    gerente: 'Gerente',
    operador: 'Operador'
  };

  function nomePapel(papel) {
    return rotuloPapel[papel] || 'Operador';
  }

  function linkConvite(token) {
    const url = new URL('cadastro.html', window.location.href);
    url.searchParams.set('convite', token);
    return url.toString();
  }

  async function copiarTexto(texto) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch (e) {
      // fallback abaixo
    }
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    let copiado = false;
    try {
      copiado = document.execCommand('copy');
    } catch (e) {
      copiado = false;
    }
    document.body.removeChild(campo);
    return copiado;
  }

  async function renderUsuarios(painel) {
    if (!podeAcessar('users')) {
      painel.innerHTML = semPermissaoHTML();
      return;
    }
    let pessoas = [];
    let convites = [];
    try {
      if (B) pessoas = await B.listarUsuarios();
    } catch (e) {
      pessoas = [];
    }
    try {
      if (B) convites = await B.listarConvites();
    } catch (e) {
      convites = [];
    }

    const souAdmin = !!(usuarioAtual && usuarioAtual.papel === 'admin');
    const meuId = usuarioAtual && usuarioAtual.id;
    const papeisConvite = souAdmin ? Object.keys(rotuloPapel) : ['operador'];

    const corpo = pessoas.length
      ? pessoas.map(function (p) {
        const podeEditar = souAdmin && p.id && p.id !== meuId;
        const seletor = podeEditar
          ? '<select class="paper-select" data-papel-usuario="' + esc(p.id) + '" aria-label="Papel de ' + esc(p.nome) + '">' +
            Object.keys(rotuloPapel).map(function (chave) {
              return '<option value="' + chave + '"' + (chave === (p.papel || 'operador') ? ' selected' : '') + '>' +
                esc(rotuloPapel[chave]) + '</option>';
            }).join('') +
            '</select>'
          : '<span class="papel-fixo">' + esc(nomePapel(p.papel)) + '</span>';
        return '<tr>' +
          '<td>' + esc(p.nome || '—') + (p.id === meuId ? ' <span class="status status-info">você</span>' : '') + '</td>' +
          '<td>' + esc(p.email || '—') + '</td>' +
          '<td>' + seletor + '</td>' +
          '<td><span class="status status-success">' + esc('Ativo') + '</span></td>' +
          '</tr>';
      }).join('')
      : '<tr><td colspan="4" class="tabela-vazia">' + esc('Nenhuma pessoa cadastrada ainda.') + '</td></tr>';

    const pendentes = convites.filter(function (c) { return c.status === 'pendente'; });
    const corpoConvites = pendentes.length
      ? pendentes.map(function (c) {
        const link = linkConvite(c.token);
        return '<tr>' +
          '<td>' + esc(c.nome || '—') + '</td>' +
          '<td>' + esc(c.email) + '</td>' +
          '<td>' + esc(nomePapel(c.papel)) + '</td>' +
          '<td><div class="convite-link">' +
          '<input type="text" readonly value="' + esc(link) + '" aria-label="Link do convite" />' +
          '<button type="button" class="btn btn-outline btn-sm" data-copiar="' + esc(link) + '">' + esc('Copiar') + '</button>' +
          '</div></td>' +
          '<td><button type="button" class="btn btn-ghost btn-sm" data-cancelar="' + esc(c.token) + '">' + esc('Cancelar') + '</button></td>' +
          '</tr>';
      }).join('')
      : '<tr><td colspan="5" class="tabela-vazia">' + esc('Nenhum convite pendente.') + '</td></tr>';

    painel.innerHTML =
      '<div class="pessoas-grid">' +
      '<section class="card">' +
      '<div class="card-header"><h3>' + esc('Pessoas com acesso') + '</h3></div>' +
      '<div class="card-body table-responsive">' +
      '<table class="data-table"><thead><tr>' +
      '<th>' + esc('Usuário') + '</th>' +
      '<th>' + esc('E-mail') + '</th>' +
      '<th>' + esc('Papel') + '</th>' +
      '<th>' + esc('Status') + '</th>' +
      '</tr></thead><tbody>' + corpo + '</tbody></table>' +
      '</div></section>' +
      '<section class="card">' +
      '<div class="card-header"><h3>' + esc('Convidar por link') + '</h3></div>' +
      '<div class="card-body">' +
      '<p class="texto-suave">' + esc('Gere um link, copie e envie para a pessoa. Nenhum e-mail é enviado automaticamente pelo Gestlux.') + '</p>' +
      '<form id="form-convite" class="form-convite">' +
      '<label>' + esc('Nome') + ' <input type="text" id="convite-nome" placeholder="Nome da pessoa" autocomplete="off" /></label>' +
      '<label>' + esc('E-mail') + ' <input type="email" id="convite-email" placeholder="pessoa@empresa.com.br" required /></label>' +
      '<label>' + esc('Papel') + ' <select id="convite-papel">' +
      papeisConvite.map(function (chave) {
        return '<option value="' + chave + '"' + (chave === 'operador' ? ' selected' : '') + '>' + esc(rotuloPapel[chave]) + '</option>';
      }).join('') +
      '</select></label>' +
      '<button type="submit" class="btn btn-primary btn-sm">' + esc('Gerar link') + '</button>' +
      '</form>' +
      '</div></section>' +
      '</div>' +
      '<section class="card convites-card">' +
      '<div class="card-header"><h3>' + esc('Convites pendentes') + '</h3></div>' +
      '<div class="card-body table-responsive">' +
      '<table class="data-table"><thead><tr>' +
      '<th>' + esc('Nome') + '</th>' +
      '<th>' + esc('E-mail') + '</th>' +
      '<th>' + esc('Papel') + '</th>' +
      '<th>' + esc('Link') + '</th>' +
      '<th>' + esc('Ação') + '</th>' +
      '</tr></thead><tbody>' + corpoConvites + '</tbody></table>' +
      '</div></section>' +
      '<section class="card em-breve-card">' +
      '<div class="card-header"><h3>' + esc('Turnos e ponto') + ' <span class="etapa-em-breve">' + esc('em breve') + '</span></h3></div>' +
      '<div class="card-body"><p class="texto-suave">' + esc('Escala, registro de ponto e banco de horas ainda não estão disponíveis nesta versão.') + '</p></div>' +
      '</section>';

    const form = document.getElementById('form-convite');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        const btn = form.querySelector('button[type="submit"]');
        const texto = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Gerando...';
        try {
          const token = await B.criarConvite(
            document.getElementById('convite-email').value,
            document.getElementById('convite-nome').value,
            document.getElementById('convite-papel').value
          );
          toast('Link gerado. Copie e envie manualmente.', 'sucesso');
          await renderUsuarios(painel);
          const copiado = await copiarTexto(linkConvite(token));
          if (copiado) toast('Link copiado.', 'sucesso');
        } catch (erro) {
          toast((erro && erro.message) || 'Não foi possível gerar o convite.', 'erro');
          btn.disabled = false;
          btn.textContent = texto;
        }
      });
    }

    painel.querySelectorAll('[data-copiar]').forEach(function (botao) {
      botao.addEventListener('click', async function () {
        const copiado = await copiarTexto(botao.getAttribute('data-copiar'));
        toast(copiado ? 'Link copiado.' : 'Copie o link manualmente.', copiado ? 'sucesso' : 'erro');
      });
    });

    painel.querySelectorAll('[data-cancelar]').forEach(function (botao) {
      botao.addEventListener('click', async function () {
        botao.disabled = true;
        try {
          await B.cancelarConvite(botao.getAttribute('data-cancelar'));
          toast('Convite cancelado.', 'sucesso');
          await renderUsuarios(painel);
        } catch (erro) {
          toast((erro && erro.message) || 'Não foi possível cancelar.', 'erro');
          botao.disabled = false;
        }
      });
    });

    painel.querySelectorAll('[data-papel-usuario]').forEach(function (select) {
      select.addEventListener('change', async function () {
        const papel = select.value;
        select.disabled = true;
        try {
          await B.atualizarPapel(select.getAttribute('data-papel-usuario'), papel);
          toast('Papel atualizado.', 'sucesso');
          await renderUsuarios(painel);
        } catch (erro) {
          toast((erro && erro.message) || 'Não foi possível alterar o papel.', 'erro');
          await renderUsuarios(painel);
        }
      });
    });
  }

  async function renderConfiguracoes(painel) {
    if (!podeAcessar('settings')) {
      painel.innerHTML = semPermissaoHTML();
      return;
    }
    let config = {};

    if (usuarioAtual && usuarioAtual.organizacao) {
      config = {
        organizacao: usuarioAtual.organizacao.nome || '',
        segmento: usuarioAtual.organizacao.segmento || 'varejo',
        notificacoes: !!usuarioAtual.organizacao.notificacoes,
        modulos: (usuarioAtual.organizacao.modulos || []).map(String)
      };
    }

    if (!config.organizacao) {
      try {
        config = JSON.parse(localStorage.getItem('gestlux_config') || '{}') || {};
      } catch (e) {
        config = {};
      }
    }

    const modulosSelecionados = Array.isArray(config.modulos) ? config.modulos.map(String) : [];

    painel.innerHTML =
      '<div class="card-body config-card">' +
      '<form id="config-form" class="config-form">' +
      '<div class="form-group"><label for="cfg-nome">' + esc("Nome da organização") + '</label>' +
      '<input type="text" id="cfg-nome" class="demo-answer" value="' + esc(config.organizacao) +
      '" placeholder="Minha Organização" /></div>' +
      '<div class="form-group"><label for="cfg-segmento">' + esc("Segmento de atuação") + '</label>' +
      '<select id="cfg-segmento" class="demo-answer">' +
      ['empresarial', 'educacional', 'saude', 'varejo'].map(function (valor) {
        const chave = {
          empresarial: 'business', educacional: 'education', saude: 'health', varejo: 'retail'
        }[valor];
        return '<option value="' + valor + '"' + (config.segmento === valor ? ' selected' : '') + '>' +
          esc(({ business: "Empresarial", education: "Educacional", health: "Saúde", retail: "Varejo" }[chave] || chave)) + '</option>';
      }).join('') +
      '</select></div>' +
      '<fieldset class="config-modulos"><legend>' + esc("Módulos ativos") + '</legend>' +
      '<p class="config-aviso">' + esc("Nesta versão apenas o varejo é operacional; os demais aparecem como vitrine ou em breve.") + '</p>' +
      modulos.map(function (m) {
        const emBreve = (m.tags || []).some(function (tag) { return /em breve/i.test(tag); }) ||
          /em desenvolvimento/i.test(m.descricao || '');
        const selo = emBreve ? 'em breve' : (m.tema !== 'varejo' ? 'vitrine' : 'operacional');
        return '<label class="config-modulo-opcao">' +
          '<input type="checkbox" class="cfg-modulo" value="' + esc(m.id) + '"' +
          (modulosSelecionados.indexOf(String(m.id)) !== -1 ? ' checked' : '') + ' />' +
          '<span>' + esc(m.titulo) + '</span>' +
          '<em class="modulo-selo modulo-selo-' + selo.replace(/\s+/g, '-') + '">' + esc(selo) + '</em></label>';
      }).join('') +
      '</fieldset>' +
      '<div class="form-group form-check"><input type="checkbox" id="cfg-notificacoes"' +
      (config.notificacoes ? ' checked' : '') + ' />' +
      '<label for="cfg-notificacoes">' + esc("Receber notificações por e-mail") + '</label></div>' +
      '<button type="submit" class="btn btn-primary">' + esc("Salvar alterações") + '</button>' +
      '</form></div>';

    const form = document.getElementById('config-form');
    if (!form || !B) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const textoOriginal = btn.textContent;
      btn.textContent = '...';
      btn.disabled = true;

      const modulosEscolhidos = [];
      form.querySelectorAll('.cfg-modulo:checked').forEach(function (input) {
        modulosEscolhidos.push(input.value);
      });
      if (!modulosEscolhidos.length) {
        toast("Selecione ao menos um módulo para continuar.", 'erro');
        btn.textContent = textoOriginal;
        btn.disabled = false;
        return;
      }

      const respostasAtuais =
        (usuarioAtual && usuarioAtual.organizacao && usuarioAtual.organizacao.respostas) || {};

      const dadosConfig = {
        organizacao: document.getElementById('cfg-nome').value.trim(),
        segmento: document.getElementById('cfg-segmento').value,
        notificacoes: document.getElementById('cfg-notificacoes').checked
      };

      try {
        await B.salvarConfig(dadosConfig);
        await B.salvarOnboarding(respostasAtuais, modulosEscolhidos);

        if (usuarioAtual && usuarioAtual.organizacao) {
          usuarioAtual.organizacao.nome = dadosConfig.organizacao;
          usuarioAtual.organizacao.segmento = dadosConfig.segmento;
          usuarioAtual.organizacao.notificacoes = dadosConfig.notificacoes;
          usuarioAtual.organizacao.respostas = respostasAtuais;
          usuarioAtual.organizacao.modulos = modulosEscolhidos;
        }
        aplicarPreferenciasNav();
        atualizarCabecalho();
        toast((B.remoto ? "Configurações salvas no Supabase." : "Configurações salvas neste navegador."));
      } catch (erro) {
        toast((erro && erro.message) || "Não foi possível concluir a operação.", 'erro');
      } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
      }
    });
  }

  const views = {
    home: { title: "Visão Geral", subtitle: "Indicadores reais da sua operação." },
    inventory: { title: "Estoque", subtitle: "Produtos, níveis mínimos e vendas persistidas.", render: renderEstoque },
    modules: { title: "Módulos disponíveis", subtitle: "Ative apenas o que faz sentido para a sua operação.", render: renderModulos },
    reports: { title: "Relatórios", subtitle: "Movimentações reais do banco, com exportação em CSV.", render: renderRelatorios },
    users: { title: "Pessoas", subtitle: "Convites, papéis e acesso à sua organização.", render: renderUsuarios },
    settings: { title: "Configurações", subtitle: "Preferências persistidas da sua organização.", render: renderConfiguracoes }
  };

  async function renderizarViewAtual() {
    if (viewAtual === 'home') {
      atualizarMetricas();
      renderizarGrafico();
      atualizarVendasRecentes();
      return;
    }

    const cfg = views[viewAtual] || views.home;
    if (cfg.render) {
      const painel = document.getElementById(viewAtual + '-panel');
      if (painel) await cfg.render(painel, 'todos');
    }
  }

  async function irPara(nome) {
    if (!views[nome]) nome = 'home';
    if (!podeAcessar(nome)) {
      if (nome !== 'home') toast('Seu papel não tem acesso a esta área.', 'erro');
      nome = 'home';
      if (history.replaceState) history.replaceState(null, '', '#home');
    }
    viewAtual = nome;

    document.querySelectorAll('.view').forEach(function (view) {
      view.classList.toggle('hidden', view.id !== 'view-' + nome);
    });

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (item) {
      const ativo = item.getAttribute('data-view') === nome;
      item.classList.toggle('active', ativo);
      if (ativo) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });

    atualizarCabecalho();
    await renderizarViewAtual();

    if (nome === 'home' && grafico) {
      setTimeout(function () { grafico.resize(); }, 50);
    }
  }

  function registrarEventos() {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        const destino = item.getAttribute('data-view');
        irPara(destino);
        if (history.replaceState) history.replaceState(null, '', '#' + destino);
      });
    });

    const verTodas = document.getElementById('btn-ver-todas');
    if (verTodas) {
      verTodas.addEventListener('click', function (e) {
        e.preventDefault();
        irPara('reports');
      });
    }

    window.addEventListener('hashchange', function () {
      irPara((location.hash || '#home').replace('#', ''));
    });

    registrarEventosModal();
    registrarEventosEntrada();
  }

  async function init() {
    if (B) {
      try { await B.iniciar(); } catch (e) { /* mantém modo local */ }
    }

    registrarEventos();
    await carregar();
    await carregarFornecedores();
    aplicarPreferenciasNav();
    await irPara((location.hash || '#home').replace('#', ''));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
