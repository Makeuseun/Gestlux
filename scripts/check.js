/* ===========================
   GESTLUX - VERIFICAÇÕES DE CI
   node scripts/check.js
   =========================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = path.resolve(__dirname, '..');
let erros = [];

function falhar(mensagem) {
  erros.push(mensagem);
}

function arquivos(dir, filtro) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && filtro.test(e.name))
    .map((e) => path.join(dir, e.name));
}

// 1. Sintaxe dos JS
for (const arquivo of arquivos(path.join(raiz, 'js'), /\.js$/)) {
  try {
    execFileSync(process.execPath, ['--check', arquivo], { stdio: 'pipe' });
  } catch (e) {
    falhar('Sintaxe inválida em ' + path.relative(raiz, arquivo) + ': ' + e.stderr.toString());
  }
}

// 2. Nenhuma chave secreta no front
// O prefixo real da chave secreta é "sb_secret_".
// "service_role" só é tratado como vazamento em config.js/HTML;
// nos demais JS pode aparecer em comentários que explicam o bloqueio.
const vazamentoChave = /sb_secret_/i;
for (const arquivo of [
  path.join(raiz, 'js', 'config.js'),
  ...arquivos(path.join(raiz, 'js'), /\.js$/),
  ...arquivos(raiz, /\.html$/)
]) {
  const conteudo = fs.readFileSync(arquivo, 'utf8');
  const relativo = path.relative(raiz, arquivo);
  if (vazamentoChave.test(conteudo)) {
    falhar('Chave secreta sb_secret_ encontrada em ' + relativo);
  }
  if (relativo.replace(/\\/g, '/') === 'js/config.js' || /\.html$/.test(relativo)) {
    if (/service_role/i.test(conteudo)) {
      falhar('Referência a service_role em ' + relativo);
    }
  }
}

// 3. Arquivos essenciais
for (const nome of [
  'index.html',
  'login.html',
  'cadastro.html',
  'dashboard.html',
  'css/style.css',
  'favicon.svg',
  'js/config.js',
  'js/backend.js',
  'supabase/schema.sql',
  'supabase/seed.sql'
]) {
  if (!fs.existsSync(path.join(raiz, nome))) falhar('Arquivo essencial ausente: ' + nome);
}

// 4. Referências locais nos HTML existem
const referencia = /(?:src|href)="([^"]+)"/g;
for (const arquivo of arquivos(raiz, /\.html$/)) {
  const conteudo = fs.readFileSync(arquivo, 'utf8');
  let m;
  while ((m = referencia.exec(conteudo)) !== null) {
    const alvo = m[1];
    if (/^(https?:|data:|mailto:|#)/i.test(alvo)) continue;
    const limpo = alvo.split('#')[0];
    if (!limpo) continue;
    if (!fs.existsSync(path.join(raiz, limpo))) {
      falhar('Referência quebrada em ' + path.relative(raiz, arquivo) + ': ' + alvo);
    }
  }
}

// 5. Chaves do CSS balanceadas
const css = fs.readFileSync(path.join(raiz, 'css', 'style.css'), 'utf8');
const abre = (css.match(/\{/g) || []).length;
const fecha = (css.match(/\}/g) || []).length;
if (abre !== fecha) {
  falhar('CSS desbalanceado: ' + abre + ' chaves abertas, ' + fecha + ' fechadas');
}

// 6. Supabase: seed precisa ser repetível e recuperável
const seed = fs.readFileSync(path.join(raiz, 'supabase', 'seed.sql'), 'utf8');
if (!/repet[ií]vel e recuper[aá]vel/i.test(seed)) {
  falhar('seed.sql não está marcado como repetível/recuperável (risco de não restaurar a demo)');
}

if (erros.length) {
  console.error('Falhas de verificação:');
  for (const e of erros) console.error(' - ' + e);
  process.exit(1);
}

console.log('check.js: todas as verificações passaram.');
