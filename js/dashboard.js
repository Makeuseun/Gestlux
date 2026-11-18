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

  function dataCurta(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
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
    const titulo = document.getElementById('view-title');
    const subtitulo = document.getElementById('view-subtitle');
    if (titulo) titulo.textContent = cfg.title;
    if (subtitulo) subtitulo.textContent = cfg.subtitle;
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
    const filtrados = filtro === 'todos'
      ? modulos
      : modulos.filter(function (m) { return m.tema === filtro; });

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
      filtrados.map(function (m) {
        return '<article class="modulo-card">' +
          '<div class="modulo-icon"><i class="' + esc(m.icone) + '"></i></div>' +
          '<h3>' + esc(m.titulo) + '</h3><p>' + esc(m.descricao) + '</p>' +
          '<div class="modulo-tags">' + m.tags.map(function (tag) {
            return '<span class="modulo-tag">' + esc(tag) + '</span>';
          }).join('') + '</div></article>';
      }).join('') +
      '</div>';

    painel.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        renderModulos(painel, chip.getAttribute('data-filtro'));
      });
    });
  }

  function renderEstoque(painel) {
    painel.innerHTML =
      '<div class="estoque-layout">' +
      '<section class="card-body estoque-cadastro">' +
      '<h3>' + esc("Novo produto") + '</h3>' +
      '<form id="produto-form" class="config-form">' +
      '<div class="form-group"><label for="prod-nome">' + esc("Nome do produto") + '</label>' +
      '<input id="prod-nome" class="demo-answer" required placeholder="Ex: Camiseta Básica" /></div>' +
      '<div class="form-group"><label for="prod-sku">' + esc("SKU") + '</label>' +
      '<input id="prod-sku" class="demo-answer" placeholder="Ex: CAM-001" /></div>' +
      '<div class="form-group"><label for="prod-preco">' + esc("Preço (R$)") + '</label>' +
      '<input id="prod-preco" class="demo-answer" type="number" min="0" step="0.01" required value="0" /></div>' +
      '<div class="form-group"><label for="prod-qtd">' + esc("Quantidade") + '</label>' +
      '<input id="prod-qtd" class="demo-answer" type="number" min="0" step="1" required value="0" /></div>' +
      '<div class="form-group"><label for="prod-min">' + esc("Estoque mínimo") + '</label>' +
      '<input id="prod-min" class="demo-answer" type="number" min="0" step="1" value="0" /></div>' +
      '<button type="submit" class="btn btn-primary">' + esc("Adicionar produto") + '</button>' +
      '</form></section>' +
      '<section class="card-body estoque-lista">' +
      '<h3>' + esc("Produtos cadastrados") + '</h3>' +
      '<div class="estoque-busca">' +
      '<input id="estoque-busca" type="search" placeholder="' + esc("Buscar por nome ou SKU...") +
      '" value="' + esc(buscaEstoque) + '" aria-label="' + esc("Buscar produto") + '" />' +
      '</div>' +
      '<div id="estoque-alerta">' + alertaEstoqueHTML() + '</div>' +
      '<div id="estoque-tabela">' + tabelaEstoqueHTML() + '</div>' +
      '</section></div>';

    ligarFormularioProduto();
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
    if (!termo) return dados.produtos;
    return dados.produtos.filter(function (p) {
      return (p.nome || '').toLowerCase().indexOf(termo) !== -1 ||
        (p.sku || '').toLowerCase().indexOf(termo) !== -1;
    });
  }

  function tabelaEstoqueHTML() {
    if (!dados.produtos.length) {
      return '<p class="tabela-vazia">' + esc("Nenhum produto cadastrado. Comece pelo formulário ao lado.") + '</p>';
    }

    const filtrados = produtosFiltrados();
    if (!filtrados.length) {
      return '<p class="tabela-vazia">' + esc("Nenhum produto encontrado para a busca.") + '</p>';
    }

    const linhas = filtrados.map(function (p) {
      const baixo = numero(p.quantidade) <= numero(p.minimo);
      return '<tr>' +
        '<td><strong>' + esc(p.nome) + '</strong></td>' +
        '<td>' + esc(p.sku || '—') + '</td>' +
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
        '<td><div class="acoes-produto">' +
        '<button type="button" class="btn btn-outline btn-sm btn-editar" data-id="' + esc(p.id) +
        '" aria-label="' + esc("Editar produto") + '">' + esc("Editar") + '</button>' +
        '<button type="button" class="btn btn-danger btn-sm btn-excluir" data-id="' + esc(p.id) +
        '" aria-label="' + esc("Excluir produto") + '">' + esc("Excluir") + '</button>' +
        '</div></td></tr>';
    }).join('');

    return '<div class="table-responsive"><table class="data-table"><thead><tr>' +
      '<th>' + esc("Produto") + '</th>' +
      '<th>' + esc("SKU") + '</th>' +
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

  function ligarFormularioProduto() {
    const form = document.getElementById('produto-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const sku = document.getElementById('prod-sku').value.trim();
      if (skuDuplicado(sku, null)) {
        toast("SKU já cadastrado nesta organização.", 'erro');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      const textoOriginal = btn.textContent;
      btn.textContent = '...';
      btn.disabled = true;

      try {
        if (!B) throw new Error('Backend indisponível.');
        await B.adicionarProduto({
          nome: document.getElementById('prod-nome').value.trim(),
          sku: sku,
          preco: document.getElementById('prod-preco').value,
          quantidade: document.getElementById('prod-qtd').value,
          minimo: document.getElementById('prod-min').value
        });
        toast("Produto adicionado e persistido.");
        buscaEstoque = '';
        await recarregarEAtualizar();
      } catch (erro) {
        toast((erro && erro.message) || "Não foi possível concluir a operação.", 'erro');
        btn.textContent = textoOriginal;
        btn.disabled = false;
      }
    });
  }

  function ligarEventosEstoque() {
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
          await B.registrarVenda(botao.getAttribute('data-id'), quantidade);
          toast(substituir("Venda registrada: {q} unidade(s) de {n}.", { q: quantidade, n: botao.getAttribute('data-nome') }));
          await recarregarEAtualizar();
        } catch (erro) {
          toast((erro && erro.message) || "Não foi possível concluir a operação.", 'erro');
          botao.textContent = "Vender";
          botao.disabled = false;
        }
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

  function abrirModalProduto(produto) {
    const modal = document.getElementById('modal-produto');
    if (!modal || !produto) return;

    document.getElementById('modal-produto-id').value = produto.id;
    document.getElementById('modal-nome').value = produto.nome || '';
    document.getElementById('modal-sku').value = produto.sku || '';
    document.getElementById('modal-preco').value = numero(produto.preco);
    document.getElementById('modal-qtd').value = numero(produto.quantidade);
    document.getElementById('modal-min').value = numero(produto.minimo);

    modal.hidden = false;
    document.getElementById('modal-nome').focus();
  }

  function fecharModalProduto() {
    const modal = document.getElementById('modal-produto');
    if (modal) modal.hidden = true;
  }

  function registrarEventosModal() {
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
          minimo: document.getElementById('modal-min').value
        });
        fecharModalProduto();
        toast("Produto atualizado.");
        await recarregarEAtualizar();
      } catch (erro) {
        toast((erro && erro.message) || "Não foi possível salvar o produto.", 'erro');
        btn.textContent = "Salvar alterações";
        btn.disabled = false;
      }
    });
  }

  function exportarCSV() {
    const linhas = [["Data", "Produto", "Tipo", "Qtd", "Valor"]];

    dados.movimentacoes.forEach(function (m) {
      linhas.push([
        new Date(m.criado_em).toLocaleString('pt-BR'),
        nomeProduto(m),
        m.tipo,
        numero(m.quantidade),
        numero(m.valor).toFixed(2)
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
    toast("Arquivo CSV exportado.");
  }

  function renderRelatorios(painel) {
    const vendas = vendas30();
    const total = vendas.reduce(function (soma, m) { return soma + numero(m.valor); }, 0);
    const ticket = vendas.length ? total / vendas.length : 0;

    const movimentacoes = dados.movimentacoes.slice(0, 50);
    const corpo = movimentacoes.length
      ? movimentacoes.map(function (m) {
        return '<tr>' +
          '<td>' + esc(dataCurta(m.criado_em)) + '</td>' +
          '<td>' + esc(nomeProduto(m)) + '</td>' +
          '<td>' + esc(({ venda: "Venda", entrada: "Entrada", saida: "Saída" }[m.tipo] || m.tipo)) + '</td>' +
          '<td>' + numero(m.quantidade) + '</td>' +
          '<td>' + esc(dinheiro(m.valor)) + '</td>' +
          '</tr>';
      }).join('')
      : '<tr><td colspan="5" class="tabela-vazia">' + esc("Nenhum registro ainda.") + '</td></tr>';

    painel.innerHTML =
      '<div class="resumo-cards">' +
      '<div class="resumo-card"><span>' + esc("Total vendido (30 dias)") + '</span><strong>' + esc(dinheiro(total)) + '</strong></div>' +
      '<div class="resumo-card"><span>' + esc("Ticket médio") + '</span><strong>' + esc(dinheiro(ticket)) + '</strong></div>' +
      '<div class="resumo-card"><span>' + esc("Vendas registradas") + '</span><strong>' + vendas.length + '</strong></div>' +
      '</div>' +
      '<div class="card-header relatorio-header">' +
      '<h3>' + esc("Movimentações recentes") + '</h3>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-exportar">' + esc("Exportar CSV") + '</button>' +
      '</div>' +
      '<div class="card-body table-responsive">' +
      '<table class="data-table"><thead><tr>' +
      '<th>' + esc("Data") + '</th>' +
      '<th>' + esc("Produto") + '</th>' +
      '<th>' + esc("Tipo") + '</th>' +
      '<th>' + esc("Qtd") + '</th>' +
      '<th>' + esc("Valor") + '</th>' +
      '</tr></thead><tbody>' + corpo + '</tbody></table></div>';

    const botao = document.getElementById('btn-exportar');
    if (botao) botao.addEventListener('click', exportarCSV);
  }

  async function renderUsuarios(painel) {
    let pessoas = [];
    try {
      pessoas = B ? await B.listarUsuarios() : [];
    } catch (e) {
      pessoas = [];
    }

    const corpo = pessoas.length
      ? pessoas.map(function (p) {
        return '<tr>' +
          '<td>' + esc(p.nome) + '</td>' +
          '<td>' + esc(p.email) + '</td>' +
          '<td>' + esc(({ admin: "Administrador", gerente: "Gerente", operador: "Operador" }[p.papel || 'operador'] || 'Operador')) + '</td>' +
          '<td><span class="status status-success">' + esc("Ativo") + '</span></td>' +
          '</tr>';
      }).join('')
      : '<tr><td colspan="4" class="tabela-vazia">' + esc("Nenhum registro ainda.") + '</td></tr>';

    painel.innerHTML =
      '<div class="card-body table-responsive">' +
      '<table class="data-table"><thead><tr>' +
      '<th>' + esc("Usuário") + '</th>' +
      '<th>' + esc("E-mail") + '</th>' +
      '<th>' + esc("Segmento de atuação") + '</th>' +
      '<th>' + esc("Status") + '</th>' +
      '</tr></thead><tbody>' + corpo + '</tbody></table></div>';
  }

  async function renderConfiguracoes(painel) {
    let config = {};

    if (usuarioAtual && usuarioAtual.organizacao) {
      config = {
        organizacao: usuarioAtual.organizacao.nome || '',
        segmento: usuarioAtual.organizacao.segmento || 'varejo',
        notificacoes: !!usuarioAtual.organizacao.notificacoes
      };
    }

    if (!config.organizacao) {
      try {
        config = JSON.parse(localStorage.getItem('gestlux_config') || '{}') || {};
      } catch (e) {
        config = {};
      }
    }

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

      const dadosConfig = {
        organizacao: document.getElementById('cfg-nome').value.trim(),
        segmento: document.getElementById('cfg-segmento').value,
        notificacoes: document.getElementById('cfg-notificacoes').checked
      };

      try {
        await B.salvarConfig(dadosConfig);
        if (usuarioAtual && usuarioAtual.organizacao) {
          usuarioAtual.organizacao.nome = dadosConfig.organizacao;
          usuarioAtual.organizacao.segmento = dadosConfig.segmento;
          usuarioAtual.organizacao.notificacoes = dadosConfig.notificacoes;
        }
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
    users: { title: "Usuários", subtitle: "Pessoas com acesso à sua organização.", render: renderUsuarios },
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
  }

  async function init() {
    if (B) {
      try { await B.iniciar(); } catch (e) { /* mantém modo local */ }
    }

    registrarEventos();
    await carregar();
    await irPara((location.hash || '#home').replace('#', ''));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
