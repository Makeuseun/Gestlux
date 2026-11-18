# Gestlux — MVP operacional

Sistema de gestão multi-público (empresarial, educacional, saúde e varejo) em HTML, CSS e JavaScript puro, com **backend real no Supabase** e fallback local para a demo nunca quebrar.

**Posicionamento:** MVP operacional, com backend real e multi-tenant, pronto para o primeiro piloto.

## Como executar

Abra um terminal nesta pasta e rode:

```bash
python -m http.server 8123
```

Depois acesse `http://127.0.0.1:8123/`.

> Use um servidor local em vez de abrir os arquivos com duplo clique. Alguns navegadores restringem `localStorage` em `file://`.

## Publicar no GitHub e na Vercel

Repositório: **https://github.com/Makeuseun/Gestlux**

Depois de uma alteração, rode nesta pasta:

```powershell
.\publicar.ps1 -Mensagem "Descrição curta da mudança"
```

O script faz `git add`, `commit` e `push` em `main`. Com o projeto importado na Vercel pelo GitHub, cada push atualiza o site automaticamente.

Configuração inicial da Vercel (uma vez):

1. Acesse [vercel.com/new](https://vercel.com/new) e importe `Makeuseun/Gestlux`.
2. Framework: **Other** (site estático). Root Directory: **.** (raiz). Build Command vazio; Output Directory vazio.
3. Clique em **Deploy**. Não há variáveis de ambiente obrigatórias: `js/config.js` já contém apenas a chave publicável do Supabase.
4. Se quiser um deploy manual além do automático, crie um Deploy Hook em **Settings → Git → Deploy Hooks** e defina `VERCEL_DEPLOY_HOOK_URL` no PowerShell antes de rodar `publicar.ps1`.

> Nunca coloque `service_role`/`sb_secret_...` no repositório. A chave publicável (`sb_publishable_...`) é própria para o front; a segurança vem do RLS.

## Modo local (padrão)

Sem configuração, o sistema usa `localStorage` e funciona imediatamente:

- Login aceita qualquer e-mail/senha.
- Dados de exemplo (Loja Central) são criados automaticamente em `gestlux_local_db`.
- Cadastro de produtos, vendas, alertas de estoque, configurações e usuários persistem no navegador.

É o modo de segurança da apresentação: se o Supabase falhar, basta deixar `js/config.js` vazio.

## Ativando o Supabase (backend real)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com/).
2. No **SQL Editor**, rode o conteúdo de `supabase/schema.sql`.
   - Cria `organizacoes`, `perfis`, `produtos` e `movimentacoes`.
   - Cria as funções `organizacao_atual()`, `criar_organizacao(...)` e `registrar_venda(...)` (venda atômica).
   - Habilita **RLS** isolando os dados por organização.
3. Em **Authentication → Providers → Email**, desative a confirmação de e-mail para a demo (ou mantenha ativa e confirme o usuário criado).
4. Crie o usuário de demonstração em **Authentication → Users → Add user**:
   - E-mail: `demo@gestlux.com.br`
   - Senha: `Demo@12345`
5. Volte ao **SQL Editor** e rode `supabase/seed.sql`.
   - Cria a organização "Loja Central (exemplo)", o perfil do usuário, 6 produtos e vendas recentes.
   - Importante: rode o seed **depois** de criar o usuário. Se o e-mail ainda não existir no Auth, o script avisa e não insere nada.
6. Em **Project Settings → API**, copie a **Project URL** e a chave publicável (`sb_publishable_...`). A chave `anon` legada também funciona.
7. Preencha `js/config.js`:

```js
window.GESTLUX_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
  // supabaseAnonKey também é aceito (compatibilidade)
};
```

8. Recarregue a página. O badge no dashboard passa a exibir **"Supabase conectado"** e o aviso da tela de login mostra as credenciais da demo.

> Use apenas chaves públicas no front (`sb_publishable_...` ou `anon`). Nunca coloque `service_role`/`sb_secret_...` em `js/config.js`: o backend ignora essa chave e a segurança vem das políticas de RLS.

> Se o badge estiver conectado, mas o dashboard aparecer zerado, o seed não encontrou o usuário demo. Crie `demo@gestlux.com.br` no Auth e rode `supabase/seed.sql` novamente.

## O que já funciona

- **Site institucional**: menu mobile, tema, filtro de módulos por setor, formulário de contato com validação.
- **Demo rápida**: questionário de 3 etapas com pré-visualização personalizada por setor.
- **Autenticação real ou simulada**: login/cadastro no Supabase (Auth) ou no navegador (fallback), logout e perfil.
- **Estoque operacional**: cadastro de produto, níveis mínimos, alerta de reposição e registro de venda com baixa automática de estoque.
- **Visão geral com dados reais**: vendas em 30 dias, produtos, alertas, pedidos e gráfico dos últimos 7 dias gerados a partir de `movimentacoes`.
- **Relatórios**: total vendido, ticket médio, movimentações recentes e exportação CSV.
- **Multi-tenant**: RLS por `organizacao_id`; cada cadastro cria sua própria organização via RPC.
- **Textos fixos em pt-BR** e tema claro/escuro.

## Estrutura

```text
index.html            Página inicial
login.html            Entrar
cadastro.html         Criar conta
dashboard.html        Painel operacional
css/style.css         Estilos e variáveis de tema
favicon.svg           Ícone da marca — monograma GL (favicon e cabeçalhos)
favicon-g.svg         Variante alternativa do ícone — símbolo G
js/config.js          Credenciais do Supabase (vazio = modo local)
js/backend.js         Camada de dados: Supabase + fallback localStorage
js/data.js            Módulos e configuração dos setores
js/theme.js           Tema e notificações
js/script.js          Página inicial
js/demo.js            Demo rápida
js/auth.js            Login, cadastro, logout e perfil
js/dashboard.js       Indicadores, estoque, relatórios e navegação
supabase/schema.sql   Tabelas, funções e RLS
supabase/seed.sql     Dados de exemplo para o pitch
```

## Modelo de dados

```text
organizacoes (id, nome, segmento, notificacoes)
  └── perfis (id -> auth.users, organizacao_id, nome, email, papel)
  └── produtos (id, organizacao_id, nome, sku, preco, quantidade, minimo)
  └── movimentacoes (id, organizacao_id, produto_id, tipo, quantidade, valor, criado_em)
```

## Observações honestas

- A vitrine operacional é **varejo**. Empresarial, educacional e saúde aparecem como configuração do mesmo núcleo no site.
- Não há cliente pagante nem piloto real ainda. O correto é dizer **"pronto para o primeiro piloto"**.
- Termos de uso, política de privacidade e validação jurídica de LGPD estão no roadmap.
- NF-e, prontuário e integrações marcadas como "em breve" não estão implementados.
