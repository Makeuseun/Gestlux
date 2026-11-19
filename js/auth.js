/* ===========================
   GESTLUX - AUTENTICAÇÃO
   Supabase (remoto) com fallback local
   =========================== */
(function () {
  'use strict';

  const B = window.GESTLUX_BACKEND || null;
  let conviteToken = '';
  let conviteDados = null;
  let conviteInvalido = false;

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
      el.textContent = conviteToken
        ? (B.remoto
          ? 'Supabase conectado: seu perfil será vinculado à organização do convite.'
          : 'Modo local: seu perfil será vinculado ao convite neste navegador.')
        : (B.remoto
          ? 'Supabase conectado: organização e perfil serão criados no banco.'
          : 'Modo local: os dados ficam salvos apenas neste navegador.');
    }
  }

  async function aplicarConvite() {
    if (!document.getElementById('cadastro-form') || !B) return;
    const params = new URLSearchParams(window.location.search);
    conviteToken = params.get('convite') || '';
    if (!conviteToken) return;

    const aviso = document.getElementById('convite-aviso');
    try {
      conviteDados = await B.detalhesConvite(conviteToken);
    } catch (e) {
      conviteDados = null;
    }

    if (aviso) aviso.classList.remove('hidden');
    if (!conviteDados) {
      conviteInvalido = true;
      if (aviso) aviso.textContent = 'Este link de convite é inválido ou já foi usado. Peça um novo link ao administrador.';
      toast('Convite inválido ou já utilizado.', 'erro');
      return;
    }

    if (aviso) {
      aviso.textContent = 'Você foi convidado para ' + (conviteDados.organizacao || 'uma organização') +
        ' com o papel de ' + (conviteDados.papel === 'admin' ? 'administrador' : conviteDados.papel === 'gerente' ? 'gerente' : 'operador') +
        '. Use o e-mail do convite.';
    }

    const email = document.getElementById('email');
    if (email) {
      email.value = conviteDados.email || '';
      email.readOnly = true;
    }
    const nome = document.getElementById('nome');
    if (nome && conviteDados.nome) nome.value = conviteDados.nome;

    const grupo = document.getElementById('grupo-segmento');
    if (grupo) grupo.classList.add('hidden');
    const segmento = document.getElementById('segmento');
    if (segmento) segmento.required = false;

    const btn = document.querySelector('#cadastro-form button[type="submit"]');
    if (btn) btn.textContent = 'Entrar na organização';
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
      if (conviteInvalido) {
        toast('Convite inválido. Peça um novo link ao administrador.', 'erro');
        return;
      }
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
        await B.cadastro(
          dados.nome,
          dados.email,
          dados.senha,
          conviteDados ? conviteDados.segmento : dados.segmento,
          conviteToken || null
        );
        window.location.href = conviteDados ? 'dashboard.html' : 'onboarding.html';
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
    await aplicarConvite();
    atualizarAviso();
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
