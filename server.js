const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const env = (nome, padrao) => (process.env[nome] && process.env[nome].trim()) || padrao;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Armazenamento ---------- */
let DATA_DIR = env('DATA_DIR', path.join(__dirname, 'dados'));
try { fs.mkdirSync(DATA_DIR, { recursive: true }); }
catch (e) { DATA_DIR = '/tmp'; console.error('Sem acesso a DATA_DIR, usando /tmp'); }
const ARQUIVO = path.join(DATA_DIR, 'respostas.json');

function lerRespostas() {
  try { return JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8')); } catch (e) { return []; }
}
function salvarResposta(r) {
  const lista = lerRespostas();
  lista.push(r);
  fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
}

/* ---------- Variáveis ---------- */
function perguntas() {
  const lista = [];
  for (let n = 1; n <= 5; n++) {
    const texto = env('BLOCO_' + n + '_PERGUNTA', env('BLOCO_' + n, ''));
    if (!texto) continue;
    lista.push({
      pergunta: texto,
      dica: env('BLOCO_' + n + '_DICA', ''),
      longo: env('BLOCO_' + n + '_TIPO', 'texto').toLowerCase() === 'longo',
    });
  }
  return lista;
}

/* ---------- Página do formulário ---------- */
function paginaForm() {
  const TITULO = env('TITULO', 'Formulário');
  const SUBTITULO = env('SUBTITULO', '');
  const BOTAO = env('TEXTO_BOTAO', 'Enviar');
  const RODAPE = env('RODAPE', '');
  const FINAL_T = env('MENSAGEM_FINAL_TITULO', 'Recebemos suas respostas!');
  const FINAL_X = env('MENSAGEM_FINAL_TEXTO', 'Obrigado por preencher.');
  const ERRO = env('MENSAGEM_ERRO', 'Preencha este campo.');

  const blocos = perguntas().map((b, i) => `
    <div class="block" data-p="${esc(b.pergunta)}">
      <label for="c${i}">${esc(b.pergunta)}</label>
      ${b.longo
        ? '<textarea id="c' + i + '" rows="3" placeholder="' + esc(b.dica) + '"></textarea>'
        : '<input id="c' + i + '" type="text" placeholder="' + esc(b.dica) + '">'}
      <div class="msg-erro">${esc(ERRO)}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TITULO)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f3f4f6;--card:#fff;--text:#111827;--muted:#6b7280;--line:#e5e7eb;--brand:#16a34a;--brand-dark:#15803d;--soft:#dcfce7;--input:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0b0f0d;--card:#151a18;--text:#f3f4f6;--muted:#9ca3af;--line:#26302c;--soft:#12301f;--input:#0f1412}}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5}
.wrap{max-width:640px;margin:0 auto;padding:32px 16px 56px}
.head{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--brand);border-radius:12px;padding:24px;margin-bottom:16px}
.head h1{margin:0 0 6px;font-size:1.5rem;font-weight:700}
.head p{margin:0;color:var(--muted);font-size:.95rem}
.block{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin-bottom:12px;transition:border-color .15s,box-shadow .15s}
.block:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px var(--soft)}
.block label{display:block;font-weight:600;margin-bottom:10px}
.block textarea,.block input{width:100%;font:inherit;color:var(--text);background:var(--input);border:1px solid var(--line);border-radius:8px;padding:12px 14px;outline:none}
.block textarea{resize:vertical;min-height:96px}
.block input::placeholder,.block textarea::placeholder{color:var(--muted)}
.block textarea:focus,.block input:focus{border-color:var(--brand)}
.block.erro{border-color:#dc2626}
.msg-erro{display:none;color:#dc2626;font-size:.85rem;margin-top:6px}
.block.erro .msg-erro{display:block}
button{width:100%;margin-top:8px;padding:16px;font:inherit;font-size:1.05rem;font-weight:600;color:#fff;background:var(--brand);border:0;border-radius:10px;cursor:pointer}
button:hover{background:var(--brand-dark)}
.rodape{text-align:center;color:var(--muted);font-size:.8rem;margin-top:16px}
.final{display:none;background:var(--card);border:1px solid var(--line);border-top:4px solid var(--brand);border-radius:12px;padding:40px 24px;text-align:center}
.check{width:56px;height:56px;border-radius:50%;background:var(--soft);color:var(--brand);display:grid;place-items:center;margin:0 auto 16px}
.final h2{margin:0 0 8px;font-size:1.35rem}.final p{margin:0;color:var(--muted)}
</style></head><body>
<main class="wrap">
  <section class="head"><h1>${esc(TITULO)}</h1>${SUBTITULO ? '<p>' + esc(SUBTITULO) + '</p>' : ''}</section>
  <form id="form" novalidate>
    ${blocos}
    <button type="submit">${esc(BOTAO)}</button>
    ${RODAPE ? '<div class="rodape">' + esc(RODAPE) + '</div>' : ''}
  </form>
  <section class="final" id="final" role="status">
    <div class="check"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
    <h2>${esc(FINAL_T)}</h2><p>${esc(FINAL_X)}</p>
  </section>
</main>
<script>
var form = document.getElementById('form');
form.querySelectorAll('input,textarea').forEach(function (t) {
  t.addEventListener('input', function () { t.parentNode.classList.remove('erro'); });
});
form.addEventListener('submit', function (e) {
  e.preventDefault();
  var dados = [], primeiro = null;
  form.querySelectorAll('.block').forEach(function (div) {
    var c = div.querySelector('input,textarea'), v = c.value.trim();
    if (!v) { div.classList.add('erro'); if (!primeiro) primeiro = c; }
    dados.push({ pergunta: div.getAttribute('data-p'), resposta: v });
  });
  if (primeiro) { primeiro.focus(); return; }
  fetch('/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }).catch(function () {});
  form.style.display = 'none';
  var f = document.getElementById('final');
  f.style.display = 'block';
  f.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
</script></body></html>`;
}

/* ---------- Área admin (usuário e senha) ---------- */
function igual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function autorizado(req) {
  const cab = req.headers.authorization || '';
  if (cab.indexOf('Basic ') !== 0) return false;
  const partes = Buffer.from(cab.slice(6), 'base64').toString().split(':');
  const usuario = partes.shift();
  const senha = partes.join(':');
  const okU = igual(usuario, process.env.ADMIN_USUARIO || '');
  const okS = igual(senha, process.env.ADMIN_SENHA || '');
  return okU && okS;
}

function paginaAdmin() {
  const lista = lerRespostas().slice().reverse();
  const cartoes = lista.map(r => `
    <article class="card"><time>${esc(new Date(r.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}</time>
    ${(r.respostas || []).map(x => `<div class="par"><strong>${esc(x.pergunta)}</strong><p>${esc(x.resposta)}</p></div>`).join('')}</article>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Respostas</title>
<style>
:root{--bg:#f3f4f6;--card:#fff;--text:#111827;--muted:#6b7280;--line:#e5e7eb;--brand:#16a34a}
@media (prefers-color-scheme:dark){:root{--bg:#0b0f0d;--card:#151a18;--text:#f3f4f6;--muted:#9ca3af;--line:#26302c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5}
.wrap{max-width:760px;margin:0 auto;padding:32px 16px 56px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
h1{margin:0;font-size:1.4rem}.top span{color:var(--muted);font-size:.9rem}
a.btn{background:var(--brand);color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:8px;font-size:.9rem}
.card{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--brand);border-radius:12px;padding:20px 24px;margin-bottom:12px}
time{display:block;color:var(--muted);font-size:.85rem;margin-bottom:12px}
.par{margin-bottom:12px}.par strong{display:block;font-size:.9rem}.par p{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.vazio{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:40px;text-align:center;color:var(--muted)}
</style></head><body><main class="wrap">
<div class="top"><div><h1>Respostas</h1><span>${lista.length} no total</span></div><a class="btn" href="/admin/csv">Baixar planilha (CSV)</a></div>
${cartoes || '<div class="vazio">Nenhuma resposta ainda.</div>'}
</main></body></html>`;
}

function csv() {
  const todas = lerRespostas();
  const colunas = [];
  todas.forEach(r => (r.respostas || []).forEach(x => { if (colunas.indexOf(x.pergunta) < 0) colunas.push(x.pergunta); }));
  const aspas = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const linhas = [['Data'].concat(colunas).map(aspas).join(';')];
  todas.forEach(r => {
    const mapa = {};
    (r.respostas || []).forEach(x => { mapa[x.pergunta] = x.resposta; });
    linhas.push([r.data].concat(colunas.map(c => mapa[c])).map(aspas).join(';'));
  });
  return '\uFEFF' + linhas.join('\r\n');
}

/* ---------- Servidor ---------- */
const servidor = http.createServer((req, res) => {
  const rota = req.url.split('?')[0];

  if (rota === '/admin' || rota === '/admin/csv') {
    if (!process.env.ADMIN_USUARIO || !process.env.ADMIN_SENHA) {
      res.writeHead(404); return res.end('Nao encontrado');
    }
    if (!autorizado(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"' });
      return res.end('Acesso restrito');
    }
    if (rota === '/admin/csv') {
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="respostas.csv"' });
      return res.end(csv());
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(paginaAdmin());
  }

  if (req.method === 'POST' && rota === '/enviar') {
    let corpo = '';
    req.on('data', c => { corpo += c; if (corpo.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const arr = JSON.parse(corpo);
        if (Array.isArray(arr)) {
          const respostas = arr.slice(0, 5).map(x => ({
            pergunta: String(x.pergunta || '').slice(0, 500),
            resposta: String(x.resposta || '').slice(0, 5000),
          }));
          salvarResposta({ data: new Date().toISOString(), respostas });
          console.log('Nova resposta:', JSON.stringify(respostas));
        }
      } catch (e) { console.error('Envio invalido'); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(paginaForm());
});

servidor.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Rodando na porta ' + (process.env.PORT || 3000)));
