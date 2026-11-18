/* ===========================
   GESTLUX - AUTENTICAÇÃO
   Supabase (remoto) com fallback local
   =========================== */
(function () {
  'use strict';

  const B = window.GESTLUX_BACKEND || null;

  function toast(mensagem, tipo) {
    if (window.mostrarToast) window.mostrarToast(mensagem, tipo);
  }


  async function preparar() {
    if (B) {
      try { await B.iniciar(); } catch (e) { /* fallback local já é o padrão */ }
    }
    atualizarAviso();
  }

  function atualizarAviso() {
    const el = document.getElementById('modo-aviso');
    if (!el || !B) return;

    if (document.getElementById('login-form')) {
      el.textContent = B.remoto
        ? 'Supabase conectado. Demo: demo@gestlux.com.br / Demo@12345'
        : 'Modo local: qualquer e-mail e senha são aceitos. Dados neste navegador.';
    } else {
      el.textContent = B.remoto
        ? 'Supabase conectado: organização e perfil serão criados no banco.'
        : 'Modo local: os dados ficam salvos apenas neste navegador.';
    }
  }

  async function preencherPerfil() {
    const nomeEl = document.getElementById('user-name');
    if (!nomeEl || !B) return;

    let usuario = null;
    try { usuario = await B.usuario(); } catch (e) { usuario = null; }

    const nome = (usuario && usuario.nome) || 'Usuário Demo';
    nomeEl.textContent = nome;

    const avatar = document.getElementById('user-avatar');
    if (avatar) {
      const primeiroNome = encodeURIComponent(nome.trim().split(/\s+/)[0] || 'Usuario');
      avatar.src = 'https://ui-avatars.com/api/?name=' + primeiroNome + '&background=2563eb&color=fff';
      avatar.alt = 'Avatar de ' + nome;
    }

    const badge = document.getElementById('modo-badge');
    if (badge) {
      badge.textContent = B.remoto ? 'Supabase conectado' : 'Modo local';
      badge.classList.toggle('modo-remoto', B.remoto);
    }
  }

  function iniciarLogin() {
    const form = document.getElementById('login-form');
    if (!form || !B) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      const textoOriginal = btn.textContent;
      btn.textContent = 'Autenticando...';
      btn.disabled = true;

      try {
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('password').value;
        await B.login(email, senha);
        window.location.href = 'dashboard.html';
      } catch (erro) {
        toast((erro && erro.message) || 'Não foi possível entrar. Verifique e-mail e senha.', 'erro');
        btn.textContent = textoOriginal;
        btn.disabled = false;
      }
    });
  }

  function iniciarCadastro() {
    const form = document.getElementById('cadastro-form');
    if (!form || !B) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      const textoOriginal = btn.textContent;
      btn.textContent = 'Criando conta...';
      btn.disabled = true;

      try {
        const dados = {
          nome: document.getElementById('nome').value.trim(),
          email: document.getElementById('email').value.trim(),
          senha: document.getElementById('senha').value,
          segmento: document.getElementById('segmento').value
        };
        await B.cadastro(dados.nome, dados.email, dados.senha, dados.segmento);
        window.location.href = 'dashboard.html';
      } catch (erro) {
        toast((erro && erro.message) || 'Não foi possível criar a conta.', 'erro');
        btn.textContent = textoOriginal;
        btn.disabled = false;
      }
    });

    ['link-termos', 'link-privacidade'].forEach(function (id) {
      const link = document.getElementById(id);
      if (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          toast('Documentos jurídicos em preparação: validação prevista no roadmap.', 'erro');
        });
      }
    });
  }

  function iniciarLogout() {
    const btn = document.getElementById('logout-btn');
    if (!btn || !B) return;

    btn.addEventListener('click', async function () {
      try { await B.logout(); } catch (e) { /* segue para o login de qualquer forma */ }
      window.location.href = 'login.html';
    });
  }

  async function init() {
    await preparar();
    iniciarLogin();
    iniciarCadastro();
    iniciarLogout();
    await preencherPerfil();

    if (document.querySelector('.dashboard-layout') && B && B.remoto) {
      let usuario = null;
      try { usuario = await B.usuario(); } catch (e) { usuario = null; }
      if (!usuario) window.location.href = 'login.html';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
