# Gestlux — MVP operacional

Sistema de gestão multi-setor com **backend real no Supabase** e fallback local. Varejo é a operação completa; os outros setores são vitrine de configuração.

**Posicionamento:** MVP operacional, com backend real e multi-tenant, pronto para o primeiro piloto.

## Rodar localmente

```powershell
python -m http.server 8123
```

Acesse `http://127.0.0.1:8123/`. Sem Supabase, o sistema usa `localStorage` e aceita qualquer e-mail/senha.

Demo Supabase: `demo@gestlux.com.br` / `Demo@12345`.

## Supabase

1. Rode `supabase/schema.sql` no SQL Editor.
2. Crie o usuário demo no Auth.
3. Rode `supabase/seed.sql` **depois** do usuário.
4. Preencha `js/config.js` com a Project URL e a chave `sb_publishable_...`.

Nunca use `service_role` ou `sb_secret_...` no front. O badge “Supabase conectado” confirma a conexão.

Ambos os SQLs são idempotentes: pode rodar de novo sem duplicar. Atualizou o `schema.sql`? Rode-o novamente no SQL Editor.

CI leve: cada push roda `node scripts/check.js` no GitHub (sintaxe, referências e segredos). Rode localmente também antes de publicar.

## Observações

- Indicadores, estoque, vendas, relatórios e CSV usam dados reais quando conectado.
- Demo Rápida gera uma projeção ilustrativa a partir das respostas.
- Não há cliente pagante nem piloto real ainda: use “pronto para o primeiro piloto”.
- NF-e, prontuário e integrações marcadas como “em breve” não estão implementados.
