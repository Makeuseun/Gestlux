/* ===========================
   GESTLUX - TEMA E FEEDBACK
   =========================== */
(function () {
  'use strict';

  const CHAVE_TEMA = 'gestlux_tema';
  let timerToast = null;

  function aplicarTema(tema) {
    const escuro = tema === 'escuro';
    if (escuro) {
      document.documentElement.setAttribute('data-tema', 'escuro');
    } else {
      document.documentElement.removeAttribute('data-tema');
    }

    document.querySelectorAll('#theme-toggle').forEach(function (btn) {
      const icone = btn.querySelector('i');
      if (icone) {
        icone.classList.toggle('fa-moon', !escuro);
        icone.classList.toggle('fa-sun', escuro);
      }
      btn.setAttribute('aria-label', escuro ? 'Ativar tema claro' : 'Ativar tema escuro');
      btn.setAttribute('aria-pressed', String(escuro));
    });
  }

  function alternarTema() {
    const atual = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro';
    const proximo = atual === 'escuro' ? 'claro' : 'escuro';
    localStorage.setItem(CHAVE_TEMA, proximo);
    aplicarTema(proximo);
  }

  function mostrarToast(mensagem, tipo) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }

    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = mensagem;
    toast.classList.toggle('erro', tipo === 'erro');
    toast.classList.add('mostrar');

    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(function () {
      toast.classList.remove('mostrar');
    }, 4000);
  }

  function init() {
    aplicarTema(localStorage.getItem(CHAVE_TEMA) || 'claro');
    document.querySelectorAll('#theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', alternarTema);
    });
  }

  window.gestluxAplicarTema = aplicarTema;
  window.mostrarToast = mostrarToast;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
