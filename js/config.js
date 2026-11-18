/* ===========================
   GESTLUX - CONFIGURAÇÃO
   =========================== */
(function () {
  'use strict';

  // Para ativar o backend real, crie um projeto no Supabase e preencha:
  //   supabaseUrl: 'https://SEU-PROJETO.supabase.co'
  //   supabaseAnonKey: 'SUA-CHAVE-PUBLICA-ANON'
  // Depois execute supabase/schema.sql e supabase/seed.sql no SQL Editor.
  // Enquanto estiver vazio, o sistema funciona em modo local (localStorage).
  window.GESTLUX_CONFIG = {
    supabaseUrl: 'https://amdonjlbpfjutiemyldm.supabase.co',
    supabaseAnonKey: 'sb_publishable_dLf6w0A3zTSdX9b0lsd72g__RwRYord'
  };
})();
