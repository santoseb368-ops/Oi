const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const env = (nome, padrao) => (process.env[nome] && process.env[nome].trim()) || padrao;

/* ---------- Armazenamento das respostas ---------- */
const DATA_DIR = env('DATA_DIR', path.join(__dirname, 'dados'));
const ARQUIVO = path.join(DATA_DIR, 'respostas.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

function lerRespostas() {
  try { return JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8')); } catch { return []; }
}
function salvarResposta(resposta) {
  const lista = lerRespostas();
  lista.push(resposta);
  fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
}

/* ---------- Configuração do formulário ---------- */
function montarConfig() {
  const blocos = [1, 2, 3, 4, 5].map(n => ({
    pergunta: env(`BLOCO_${n}_PERGUNTA`, `Pergunta ${n}`),
    dica: env(`BLOCO_${n}_DICA`, 'Digite aqui'),
    tipo: env(`BLOCO_${n}_TIPO`, 'texto').toLowerCase() === 'longo' ? 'longo' : 'texto',
  }));
  return {
    TITULO: env('TITULO', 'Título do formulário'),
    SUBTITULO: env('SUBTITULO', 'Preencha os campos abaixo para continuar.'),
    TEXTO_BOTAO: env('TEXTO_BOTAO', 'Enviar'),
    RODAPE: env('RODAPE', 'Seus dados estão seguros.'),
    MENSAGEM_FINAL_TITULO: env('MENSAGEM_FINAL_TITULO', 'Recebemos suas respostas!'),
    MENSAGEM_FINAL_TEXTO: env('MENSAGEM_FINAL_TEXTO', 'Obrigado por preencher.'),
    MENSAGEM_ERRO: env('MENSAGEM_ERRO', 'Preencha este campo.'),
    BLOCOS: blocos,
  };
}

const modelo = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
function paginaHtml() {
  const json = JSON.stringify(montarConfig()).replace(/</g, '\\u003c');
  return modelo.replace('/*CONFIG*/null', json);
}

/* ---------- Área administrativa (usuário e senha) ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function igual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function autorizado(req) {
  const cab = req.headers.authorization || '';
  if (!cab.startsWith('Basic ')) return false;
  const [usuario, ...resto] = Buffer.from(cab.slice(6), 'base64').toString().split(':');
  const senha = resto.join(':');
  return igual(usuario, process.env.ADMIN_USUARIO || '') && igual(senha, process.env.ADMIN_SENHA || '');
}

function paginaAdmin() {
  const lista = lerRespostas().slice().reverse();
  const cartoes = lista.map(r => `
    <article class="card">
      <time>${esc(new Date(r.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}</time>
      ${Object.entries(r.respostas).map(([p, v]) => `<div class="par"><strong>${esc(p)}</strong><p>${esc(v)}</p></div>`).join('')}
    </article>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Respostas</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f3f4f6;--card:#fff;--text:#111827;--muted:#6b7280;--line:#e5e7eb;--brand:#16a34a}
@media (prefers-color-scheme:dark){:root{--bg:#0b0f0d;--card:#151a18;--text:#f3f4f6;--muted:#9ca3af;--line:#26302c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.5}
.wrap{max-width:760px;margin:0 auto;padding:32px 16px 56px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
h1{margin:0;font-size:1.4rem}.top span{color:var(--muted);font-size:.9rem}
a.btn{background:var(--brand);color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:8px;font-size:.9rem}
.card{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--brand);border-radius:12px;padding:20px 24px;margin-bottom:12px}
time{display:block;color:var(--muted);font-size:.85rem;margin-bottom:12px}
.par{margin-bottom:12px}.par strong{display:block;font-size:.9rem}.par p{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.vazio{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:40px;text-align:center;color:var(--muted)}
</style></head><body><main class="wrap">
<div class="top"><div><h1>Respostas</h1><span>${lista.length} ${lista.length === 1 ? 'resposta' : 'respostas'}</span></div>
<a class="btn" href="/admin/csv">Baixar planilha (CSV)</a></div>
${cartoes || '<div class="vazio">Nenhuma resposta ainda.</div>'}
</main></body></html>`;
}

function csv() {
  const campos = montarConfig().BLOCOS.map(b => b.pergunta);
  const aspas = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Data', ...campos].map(aspas).join(';')];
  lerRespostas().forEach(r => {
    linhas.push([r.data, ...campos.map(p => r.respostas[p] ?? '')].map(aspas).join(';'));
  });
  return '\uFEFF' + linhas.join('\r\n');
}

/* ---------- Servidor ---------- */
http.createServer((req, res) => {
  const rota = req.url.split('?')[0];

  if (rota === '/admin' || rota === '/admin/csv') {
    if (!process.env.ADMIN_USUARIO || !process.env.ADMIN_SENHA) {
      res.writeHead(404); return res.end('Não encontrado');
    }
    if (!autorizado(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Area administrativa", charset="UTF-8"' });
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
    req.on('end', async () => {
      try {
        const respostas = JSON.parse(corpo);
        const registro = { data: new Date().toISOString(), respostas };
        salvarResposta(registro);
        console.log('Nova resposta:', JSON.stringify(respostas));
        if (process.env.WEBHOOK_URL) {
          await fetch(process.env.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registro),
          }).catch(e => console.error('Erro no webhook:', e.message));
        }
      } catch (e) { console.error('Envio inválido'); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(paginaHtml());
}).listen(process.env.PORT || 3000, () => console.log('Rodando'));
