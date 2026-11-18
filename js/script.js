/* ===========================
   GESTLUX - PÁGINA INICIAL
   =========================== */
(function () {
  'use strict';

  const modulos = (window.GESTLUX && window.GESTLUX.modulos) || [];

  function renderizarModulos(filtro) {
    const grid = document.getElementById('modulos-grid');
    if (!grid) return;

    const filtrados = filtro === 'todos' ? modulos : modulos.filter(function (m) {
      return m.tema === filtro;
    });

    grid.innerHTML = filtrados.map(function (m) {
      return [
        '<article class="modulo-card" data-tema="', m.tema, '">',
        '<div class="modulo-icon"><i class="', m.icone, '"></i></div>',
        '<h3>', m.titulo, '</h3>',
        '<p>', m.descricao, '</p>',
        '<div class="modulo-tags">',
        m.tags.map(function (tag) { return '<span class="modulo-tag">' + tag + '</span>'; }).join(''),
        '</div></article>'
      ].join('');
    }).join('');
  }

  function inicializarFiltroModulos() {
    const chips = document.querySelectorAll('.chip');
    if (!chips.length) return;

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        renderizarModulos(chip.getAttribute('data-filter'));
      });
    });

    renderizarModulos('todos');
  }

  function inicializarMenuMobile() {
    const toggle = document.getElementById('nav-toggle');
    const navList = document.querySelector('.nav-list');
    if (!toggle || !navList) return;

    function fechar() {
      navList.classList.remove('active');
      const icone = toggle.querySelector('i');
      if (icone) {
        icone.classList.add('fa-bars');
        icone.classList.remove('fa-xmark');
      }
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      const aberto = navList.classList.toggle('active');
      const icone = toggle.querySelector('i');
      if (icone) {
        icone.classList.toggle('fa-bars', !aberto);
        icone.classList.toggle('fa-xmark', aberto);
      }
      toggle.setAttribute('aria-expanded', String(aberto));
    });

    document.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', fechar);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fechar();
    });
  }

  function inicializarFormularioContato() {
    const form = document.getElementById('contato-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      const textoOriginal = btn.textContent;
      btn.textContent = 'Enviando...';
      btn.disabled = true;

      setTimeout(function () {
        btn.textContent = textoOriginal;
        btn.disabled = false;
        form.reset();
        if (window.mostrarToast) window.mostrarToast('Solicitação registrada nesta demonstração. Nenhum e-mail foi enviado.');
      }, 900);
    });
  }

  function inicializarHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    function atualizar() {
      header.classList.toggle('rolado', window.pageYOffset > 100);
    }

    window.addEventListener('scroll', atualizar, { passive: true });
    atualizar();
  }

  function inicializarNavAtiva() {
    const links = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    const observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        links.forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('href') === '#' + entrada.target.id);
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    links.forEach(function (link) {
      const alvo = document.querySelector(link.getAttribute('href'));
      if (alvo) observador.observe(alvo);
    });
  }

  function init() {
    inicializarMenuMobile();
    inicializarFiltroModulos();
    inicializarFormularioContato();
    inicializarHeaderScroll();
    inicializarNavAtiva();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
