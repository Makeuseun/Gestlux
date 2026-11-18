/* ===========================
   GESTLUX - DEMO RÁPIDA
   =========================== */
(function () {
  'use strict';

  const G = window.GESTLUX || {};
  const configPorSetor = G.configPorSetor || {};
  const perguntasPorSetor = G.perguntasPorSetor || {};

  let currentTema = 'empresarial';
  let currentStep = 0;
  let answers = {};
  let els = {};

  const BASE_TAMANHO = {
    empresarial: 50,
    educacional: 1240,
    saude: 412,
    varejo: 340
  };

  const PERFIL = {
    empresarial: {
      'Tecnologia': { fator: 1.08, conclusao: 91, projeto: 'Projeto Aurora' },
      'Comércio': { fator: 0.94, conclusao: 86, projeto: 'Projeto Vitrine' },
      'Serviços': { fator: 1, conclusao: 89, projeto: 'Projeto Atendimento' },
      'Indústria': { fator: 1.12, conclusao: 87, projeto: 'Projeto Produção' }
    },
    educacional: {
      'Educação Infantil': { alunosPorTurma: 20, frequencia: 96, turma: 'Turma Infantil' },
      'Ensino Fundamental': { alunosPorTurma: 30, frequencia: 94, turma: 'Turma 3ºA' },
      'Ensino Médio': { alunosPorTurma: 35, frequencia: 93, turma: 'Turma 3ºA' },
      'Ensino Superior': { alunosPorTurma: 45, frequencia: 92, turma: 'Turma de Graduação' }
    },
    saude: {
      'Clínica Médica': { consultasPor: 23, examesPor: 35, area: 'Clínica geral' },
      'Odontologia': { consultasPor: 18, examesPor: 60, area: 'Odontologia' },
      'Fisioterapia': { consultasPor: 20, examesPor: 80, area: 'Fisioterapia' },
      'Psicologia': { consultasPor: 25, examesPor: 90, area: 'Psicologia' }
    },
    varejo: {
      'Vestuário': { fator: 1, ticket: 79.9, produtos: ['Camiseta Básica', 'Calça Jeans', 'Tênis Esportivo'] },
      'Eletrônicos': { fator: 1.9, ticket: 249.9, produtos: ['Fone Bluetooth', 'Caixa de Som', 'Smartphone'] },
      'Alimentos': { fator: 0.35, ticket: 12.9, produtos: ['Café em Grãos', 'Arroz Integral', 'Azeite de Oliva'] },
      'Móveis': { fator: 1.5, ticket: 399.9, produtos: ['Cadeira Escritório', 'Mesa de Jantar', 'Estante'] }
    }
  };

  const PADRAO_PERFIL = {
    empresarial: { fator: 1, conclusao: 88, projeto: 'Projeto Aurora' },
    educacional: { alunosPorTurma: 37, frequencia: 94, turma: 'Turma 3ºA' },
    saude: { consultasPor: 23, examesPor: 35, area: 'Clínica geral' },
    varejo: { fator: 1, ticket: 79.9, produtos: ['Camiseta Básica', 'Calça Jeans', 'Tênis Esportivo'] }
  };

  const inteiro = new Intl.NumberFormat('pt-BR');
  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const moedaCurta = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0
  });

  function esc(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function perguntas() {
    return perguntasPorSetor[currentTema] || [];
  }

  function mostrarCampo(q) {
    const valor = answers[q.key] || '';
    if (q.type === 'select') {
      const opcoes = (q.options || []).map(function (opcao) {
        return '<option value="' + esc(opcao) + '"' + (valor === opcao ? ' selected' : '') + '>' + esc(opcao) + '</option>';
      }).join('');
      return '<select id="demo-answer" class="demo-answer" required>' +
        '<option value="" disabled' + (valor ? '' : ' selected') + '>Selecione uma opção</option>' +
        opcoes + '</select>';
    }
    return '<input id="demo-answer" class="demo-answer" type="' + esc(q.type) + '"' +
      ' placeholder="' + esc(q.placeholder || '') + '" value="' + esc(valor) + '"' +
      (q.type === 'number' ? ' min="0"' : '') + ' required />';
  }

  function limparErro() {
    const campo = document.getElementById('demo-answer');
    const erro = document.getElementById('demo-erro');
    if (campo) campo.classList.remove('erro');
    if (erro) {
      erro.textContent = '';
      erro.classList.add('hidden');
    }
  }

  function renderStep() {
    const lista = perguntas();
    if (!lista.length || !els.steps) return;

    const q = lista[currentStep];

    els.steps.innerHTML =
      '<div class="form-step">' +
      '<label class="demo-question" for="demo-answer">' + esc(q.label) + '</label>' +
      mostrarCampo(q) +
      '<p class="campo-erro hidden" id="demo-erro" role="alert"></p>' +
      '</div>';

    const campo = document.getElementById('demo-answer');
    if (campo) {
      campo.addEventListener('input', function () {
        answers[q.key] = campo.value;
        limparErro();
      });
      campo.addEventListener('change', function () {
        answers[q.key] = campo.value;
        limparErro();
      });
    }

    if (els.counter) els.counter.textContent = 'Etapa ' + (currentStep + 1) + ' de ' + lista.length;
    if (els.prev) els.prev.classList.toggle('hidden', currentStep === 0);
    if (els.next) els.next.classList.toggle('hidden', currentStep === lista.length - 1);
    if (els.submit) els.submit.classList.toggle('hidden', currentStep !== lista.length - 1);
  }

  function validarStep() {
    const campo = document.getElementById('demo-answer');
    if (!campo) return false;
    const valor = String(campo.value || '').trim();

    if (!valor) {
      const erro = document.getElementById('demo-erro');
      campo.classList.add('erro');
      if (erro) {
        erro.textContent = 'Preencha este campo para continuar.';
        erro.classList.remove('hidden');
      }
      campo.focus();
      return false;
    }

    answers[perguntas()[currentStep].key] = valor;
    return true;
  }

  function numeroInteiro(valor, padrao) {
    const numero = Number(String(valor == null ? '' : valor).replace(/[^0-9]/g, ''));
    return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : padrao;
  }

  function calcularPreview(tema, cfg, dados) {
    const base = BASE_TAMANHO[tema] || 50;
    const tamanho = numeroInteiro(dados.tamanho, base);
    const detalhe = dados.detalhe || '';
    const perfil = (PERFIL[tema] && PERFIL[tema][detalhe]) || PADRAO_PERFIL[tema] || {};
    const escala = Math.min(6, Math.max(0.2, tamanho / base));
    const fator = perfil.fator || 1;

    let metricas;
    let recentes;
    let chartLabel = cfg.chartLabel || 'Evolução no período';

    if (tema === 'empresarial') {
      const receita = Math.round(84200 * escala * fator / 100) * 100;
      const projetos = Math.max(1, Math.round(23 * escala * fator));
      const conclusao = perfil.conclusao || 88;
      const tarefas = Math.max(1, Math.round(12 * escala));
      metricas = [
        { valor: moedaCurta.format(receita), label: cfg.metrica1Label, icone: 'fa-chart-line' },
        { valor: inteiro.format(projetos), label: cfg.metrica2Label, icone: 'fa-layer-group' },
        { valor: conclusao + '%', label: cfg.metrica3Label, icone: 'fa-circle-check' },
        { valor: inteiro.format(tarefas), label: cfg.metrica4Label, icone: 'fa-list-check' }
      ];
      recentes = [
        { item: perfil.projeto, detalhe: projetos + ' projetos ativos', valor: conclusao + '%' },
        { item: 'Fluxo de caixa', detalhe: '3 lançamentos', valor: moeda.format(Math.round(receita * 0.22)) },
        { item: 'Relatório mensal', detalhe: '1 documento', valor: 'Pronto' }
      ];
      chartLabel = detalhe ? cfg.chartLabel + ' • ' + detalhe : cfg.chartLabel;
    } else if (tema === 'educacional') {
      const porTurma = perfil.alunosPorTurma || 37;
      const turmas = Math.max(1, Math.ceil(tamanho / porTurma));
      const frequencia = perfil.frequencia || 94;
      const aulas = Math.max(1, Math.round(6 * escala));
      metricas = [
        { valor: inteiro.format(tamanho), label: cfg.metrica1Label, icone: 'fa-users' },
        { valor: inteiro.format(turmas), label: cfg.metrica2Label, icone: 'fa-school' },
        { valor: frequencia + '%', label: cfg.metrica3Label, icone: 'fa-calendar-check' },
        { valor: inteiro.format(aulas), label: cfg.metrica4Label, icone: 'fa-book-open' }
      ];
      recentes = [
        { item: perfil.turma, detalhe: porTurma + ' alunos', valor: frequencia + '%' },
        { item: 'Diário de classe', detalhe: aulas + ' aulas', valor: 'Registrado' },
        { item: 'Boletim', detalhe: turmas + ' turmas', valor: 'Publicado' }
      ];
      chartLabel = detalhe ? cfg.chartLabel + ' • ' + detalhe : cfg.chartLabel;
    } else if (tema === 'saude') {
      const consultas = Math.max(1, Math.ceil(tamanho / (perfil.consultasPor || 23)));
      const pendentes = Math.max(1, Math.ceil(tamanho / (perfil.examesPor || 35)));
      const examesHoje = Math.max(1, Math.ceil(tamanho / 46));
      metricas = [
        { valor: inteiro.format(tamanho), label: cfg.metrica1Label, icone: 'fa-heart-pulse' },
        { valor: inteiro.format(consultas), label: cfg.metrica2Label, icone: 'fa-calendar-check' },
        { valor: inteiro.format(pendentes), label: cfg.metrica3Label, icone: 'fa-flask' },
        { valor: inteiro.format(examesHoje), label: cfg.metrica4Label, icone: 'fa-file-medical' }
      ];
      recentes = [
        { item: perfil.area, detalhe: consultas + ' agendamentos', valor: 'Confirmado' },
        { item: 'Laboratório', detalhe: examesHoje + ' resultados', valor: 'Disponível' },
        { item: 'Prontuário', detalhe: '1 atualização', valor: 'Salvo' }
      ];
      chartLabel = detalhe ? cfg.chartLabel + ' • ' + detalhe : cfg.chartLabel;
    } else {
      const produtos = perfil.produtos || PADRAO_PERFIL.varejo.produtos;
      const ticket = perfil.ticket || 79.9;
      const vendasDia = Math.round(67890 * escala * fator);
      const baixoEstoque = Math.max(1, Math.ceil(tamanho * 0.035));
      const vendas = Math.max(1, Math.round(9 * escala * fator));
      metricas = [
        { valor: moedaCurta.format(vendasDia), label: cfg.metrica1Label, icone: 'fa-chart-line' },
        { valor: inteiro.format(tamanho), label: cfg.metrica2Label, icone: 'fa-boxes-stacked' },
        { valor: inteiro.format(baixoEstoque), label: cfg.metrica3Label, icone: 'fa-triangle-exclamation' },
        { valor: inteiro.format(vendas), label: cfg.metrica4Label, icone: 'fa-receipt' }
      ];
      recentes = [
        { item: produtos[0], detalhe: '3 unidades', valor: moeda.format(3 * ticket) },
        { item: produtos[1], detalhe: '2 unidades', valor: moeda.format(2 * ticket) },
        { item: produtos[2], detalhe: '1 unidade', valor: moeda.format(ticket) }
      ];
      chartLabel = detalhe ? cfg.chartLabel + ' • ' + detalhe : cfg.chartLabel;
    }

    const baseSerie = [58, 45, 50, 28, 34, 16, 24, 8];
    const xSerie = [0, 32, 65, 98, 130, 162, 195, 230];
    const serie = baseSerie.map(function (y, i) {
      const ajuste = (i + 1) * (escala - 1) * 2.2;
      return Math.max(6, Math.min(66, Math.round(y - ajuste)));
    });
    const pontos = xSerie.map(function (x, i) { return x + ',' + serie[i]; }).join(' ');
    const area = 'M' + xSerie.map(function (x, i) { return x + ' ' + serie[i]; }).join(' L') + ' L230 70 L0 70 Z';

    return { metricas: metricas, recentes: recentes, chartLabel: chartLabel, pontos: pontos, area: area };
  }

  function mostrarPreview(tema, dados) {
    const cfg = configPorSetor[tema] || configPorSetor.empresarial;
    if (!cfg || !els.preview) return;

    const dadosPreview = dados || {};
    const nome = dadosPreview.nome || cfg.nomePadrao || '';
    const subtitulo = String(cfg.subtitulo || '').replace('{nome}', esc(nome));
    const detalhe = dadosPreview.detalhe ? esc(dadosPreview.detalhe) : '';
    const tamanhoOriginal = dadosPreview.tamanho ? String(dadosPreview.tamanho) : '';
    const calculado = calcularPreview(tema, cfg, dadosPreview);
    const cor = esc(cfg.cor);

    function metrica(valor, label, icone) {
      return '<div class="demo-metric">' +
        '<div class="demo-metric-top"><i class="fa-solid ' + icone + '" style="color:' + cor + '"></i></div>' +
        '<div class="demo-metric-value">' + esc(valor) + '</div>' +
        '<div class="demo-metric-label">' + esc(label) + '</div>' +
        '</div>';
    }

    const recentes = calculado.recentes.map(function (r) {
      return '<li>' +
        '<span class="demo-recente-item">' + esc(r.item) + '</span>' +
        '<span class="demo-recente-detalhe">' + esc(r.detalhe) + '</span>' +
        '<strong class="demo-recente-valor">' + esc(r.valor) + '</strong>' +
        '</li>';
    }).join('');

    const perguntaTamanho = (perguntasPorSetor[tema] || []).filter(function (q) { return q.key === 'tamanho'; })[0];
    const rotuloTamanho = perguntaTamanho
      ? esc(String(perguntaTamanho.label).replace(/^Quantidade de\s*/i, ''))
      : 'registros';
    const tamanhoBadge = tamanhoOriginal
      ? inteiro.format(numeroInteiro(tamanhoOriginal, BASE_TAMANHO[tema])) + ' ' + rotuloTamanho
      : '';

    els.preview.innerHTML =
      '<div class="demo-dashboard-preview">' +
      '<div class="demo-preview-topbar">' +
      '<img class="demo-preview-logo" src="favicon.svg" alt="" aria-hidden="true" />' +
      '<span class="demo-preview-org">' + esc(nome) + '</span>' +
      '<span class="demo-preview-mode"><i class="fa-solid fa-circle"></i> Visão geral</span>' +
      '</div>' +
      '<div class="demo-preview-shell">' +
      '<aside class="demo-mini-sidebar" aria-hidden="true">' +
      '<i class="fa-solid fa-chart-pie active"></i>' +
      '<i class="fa-solid fa-boxes-stacked"></i>' +
      '<i class="fa-solid fa-receipt"></i>' +
      '<i class="fa-solid fa-file-lines"></i>' +
      '<i class="fa-solid fa-gear"></i>' +
      '</aside>' +
      '<div class="demo-preview-main">' +
      '<div class="demo-preview-heading">' +
      '<div><h3>' + esc(cfg.titulo) + '</h3><p>' + subtitulo + '</p></div>' +
      '<span class="demo-preview-tag" style="background:' + cor + '20;color:' + cor + '">Projeção ilustrativa</span>' +
      '</div>' +
      '<div class="demo-metric-grid">' +
      calculado.metricas.map(function (m) { return metrica(m.valor, m.label, m.icone); }).join('') +
      '</div>' +
      '<div class="demo-preview-panels">' +
      '<section class="demo-chart-card">' +
      '<div class="demo-panel-title"><span>' + esc(calculado.chartLabel) + '</span><span>Últimos 7 dias</span></div>' +
      '<svg class="demo-sparkline" viewBox="0 0 230 70" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + calculado.area + '" fill="' + cor + '1a" />' +
      '<polyline points="' + calculado.pontos + '" fill="none" stroke="' + cor + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />' +
      '</svg>' +
      '<div class="demo-chart-legend"><i style="background:' + cor + '"></i> Evolução no período</div>' +
      '</section>' +
      '<section class="demo-recent-card">' +
      '<div class="demo-panel-title"><span>Atividades recentes</span><span>Hoje</span></div>' +
      '<ul class="demo-recentes">' + recentes + '</ul>' +
      '</section>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="demo-preview-footer">' +
      (detalhe ? '<span class="badge">' + detalhe + '</span>' : '') +
      (tamanhoBadge ? '<span class="badge badge-outline">' + tamanhoBadge + '</span>' : '') +
      '<span class="badge demo-badge" style="background:' + cor + '20;color:' + cor + '">' + esc(tema) + '</span>' +
      '<span class="demo-preview-note">Ilustrativo • ' +
      (tamanhoOriginal ? 'calculado a partir das suas respostas' : 'mesma visão geral do dashboard') + '</span>' +
      '</div>' +
      '</div>';
  }

  function resetPreview() {
    if (!els.preview) return;
    els.preview.innerHTML =
      '<div class="demo-placeholder">' +
      '<i class="fa-solid fa-chart-pie"></i>' +
      '<p>Preencha o formulário para gerar a visão geral do seu dashboard</p>' +
      '</div>';
  }

  function gerarPreview() {
    mostrarPreview(currentTema, answers);
    if (window.mostrarToast) window.mostrarToast('Visão geral do dashboard gerada para ' + (answers.nome || configPorSetor[currentTema].nomePadrao) + '.');
  }

  function selecionarTema(tema) {
    if (!configPorSetor[tema]) return;
    currentTema = tema;
    currentStep = 0;
    answers = {};

    document.querySelectorAll('.demo-btn').forEach(function (btn) {
      const ativo = btn.getAttribute('data-tema') === tema;
      btn.classList.toggle('active', ativo);
      btn.setAttribute('aria-pressed', String(ativo));
    });

    renderStep();
    mostrarPreview(tema, {});
  }

  function init() {
    els = {
      form: document.getElementById('demo-form'),
      steps: document.getElementById('demo-steps'),
      counter: document.getElementById('demo-step-counter'),
      prev: document.getElementById('demo-prev'),
      next: document.getElementById('demo-next'),
      submit: document.getElementById('demo-submit'),
      preview: document.getElementById('demo-preview')
    };

    if (!els.form || !els.steps) return;

    document.querySelectorAll('.demo-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selecionarTema(btn.getAttribute('data-tema'));
      });
    });

    if (els.prev) {
      els.prev.addEventListener('click', function () {
        if (currentStep > 0) {
          currentStep--;
          renderStep();
        }
      });
    }

    if (els.next) {
      els.next.addEventListener('click', function () {
        if (!validarStep()) return;
        if (currentStep < perguntas().length - 1) {
          currentStep++;
          renderStep();
        } else {
          gerarPreview();
        }
      });
    }

    if (els.form) {
      els.form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (validarStep()) gerarPreview();
      });
    }

    selecionarTema('empresarial');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
