/* ===========================
   GESTLUX - ONBOARDING
   Perguntas + escolha de módulos
   =========================== */
(function () {
  'use strict';

  const B = window.GESTLUX_BACKEND || null;
  const G = window.GESTLUX || {};
  const perguntasPorSetor = G.perguntasPorSetor || {};
  const modulos = G.modulos || [];

  const perguntasGenericas = [
    { key: 'nome', label: 'Nome da organização', type: 'text', placeholder: 'Ex: Minha Empresa' },
    { key: 'detalhe', label: 'Tipo de negócio', type: 'select', options: ['Serviços', 'Comércio', 'Indústria', 'Outro'] },
    { key: 'tamanho', label: 'Quantidade de pessoas na operação', type: 'number', placeholder: 'Ex: 10' }
  ];

  const rotulosSetor = {
    empresarial: 'Empresarial',
    educacional: 'Educacional',
    saude: 'Saúde',
    varejo: 'Varejo',
    outro: 'Outro'
  };

  function esc(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(mensagem, tipo) {
    if (window.mostrarToast) window.mostrarToast(mensagem, tipo);
  }

  function campoHTML(pergunta, respostas) {
    const valor = respostas[pergunta.key] || '';
    let campo;

    if (pergunta.type === 'select') {
      campo = '<select data-pergunta="' + esc(pergunta.key) + '">' +
        '<option value="">Selecione...</option>' +
        (pergunta.options || []).map(function (opcao) {
          return '<option value="' + esc(opcao) + '"' + (valor === opcao ? ' selected' : '') + '>' +
            esc(opcao) + '</option>';
        }).join('') +
        '</select>';
    } else {
      const tipo = pergunta.type === 'number' ? 'number' : 'text';
      campo = '<input type="' + tipo + '" data-pergunta="' + esc(pergunta.key) +
        '" value="' + esc(valor) + '" placeholder="' + esc(pergunta.placeholder || '') + '" />';
    }

    return '<div class="form-group"><label>' + esc(pergunta.label) + '</label>' + campo + '</div>';
  }

  function moduloHTML(modulo, selecionados) {
    const emBreve = (modulo.tags || []).some(function (tag) { return /em breve/i.test(tag); }) ||
      /em desenvolvimento/i.test(modulo.descricao || '');
    const vitrine = modulo.tema !== 'varejo';
    const selo = emBreve ? 'em breve' : (vitrine ? 'vitrine' : 'operacional');

    return '<label class="modulo-opcao">' +
      '<input type="checkbox" value="' + esc(modulo.id) + '"' +
      (selecionados.indexOf(String(modulo.id)) !== -1 ? ' checked' : '') + ' />' +
      '<span class="modulo-conteudo">' +
      '<strong>' + esc(modulo.titulo) + '</strong>' +
      '<small>' + esc(modulo.descricao) + '</small>' +
      '<em class="modulo-selo modulo-selo-' + esc(selo.replace(/\s+/g, '-')) + '">' + esc(selo) + '</em>' +
      '</span></label>';
  }

  async function init() {
    if (B) {
      try { await B.iniciar(); } catch (e) { /* mantém modo local */ }
    }

    let usuario = null;
    try { usuario = B ? await B.usuario() : null; } catch (e) { usuario = null; }
    if (!usuario) {
      window.location.href = 'login.html';
      return;
    }

    const aviso = document.getElementById('modo-aviso');
    if (aviso && B) aviso.textContent = B.remoto ? 'Supabase conectado.' : 'Modo local: preferências salvas neste navegador.';

    const org = usuario.organizacao || {};
    const segmento = org.segmento || 'outro';
    const perguntas = perguntasPorSetor[segmento] || perguntasGenericas;
    const respostas = org.respostas || {};
    const selecionados = (org.modulos || []).map(String);

    document.getElementById('onboarding-segmento').textContent = rotulosSetor[segmento] || segmento;
    document.getElementById('onboarding-perguntas').innerHTML = perguntas.map(function (p) {
      return campoHTML(p, respostas);
    }).join('');
    document.getElementById('onboarding-modulos').innerHTML = modulos.map(function (m) {
      return moduloHTML(m, selecionados);
    }).join('');

    const form = document.getElementById('onboarding-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const novasRespostas = {};
      form.querySelectorAll('[data-pergunta]').forEach(function (campo) {
        novasRespostas[campo.getAttribute('data-pergunta')] = campo.value.trim();
      });

      const novosModulos = [];
      document.querySelectorAll('#onboarding-modulos input:checked').forEach(function (input) {
        novosModulos.push(input.value);
      });
      if (!novosModulos.length) {
        toast('Selecione ao menos um módulo para continuar.', 'erro');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = 'Salvando...';
      btn.disabled = true;

      try {
        if (!B) throw new Error('Backend indisponível.');
        await B.salvarOnboarding(novasRespostas, novosModulos);
        window.location.href = 'dashboard.html';
      } catch (erro) {
        toast((erro && erro.message) || 'Não foi possível salvar suas preferências.', 'erro');
        btn.textContent = 'Salvar e entrar';
        btn.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
