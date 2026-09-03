const lista = document.getElementById('lista');
const contagem = document.getElementById('contagem');
const vazio = document.getElementById('vazio');
const botaoAtualizar = document.getElementById('atualizar');

const modal = document.getElementById('modal');
const modalTitulo = document.getElementById('modal-titulo');
const modalConteudo = document.getElementById('modal-conteudo');
document.getElementById('modal-fechar').addEventListener('click', fecharModal);
modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

function fecharModal() {
  modal.hidden = true;
}

function abrirModal(titulo, objeto) {
  modalTitulo.textContent = titulo;
  modalConteudo.textContent = JSON.stringify(objeto, null, 2);
  modal.hidden = false;
}

function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusDe(arquivo) {
  if (!arquivo.normalizado) return { classe: 'pendente', texto: 'pendente' };
  if (arquivo.desatualizado) return { classe: 'desatualizado', texto: 'desatualizado' };
  return { classe: 'ok', texto: 'normalizado' };
}

function renderizarItem(arquivo) {
  const li = document.createElement('li');
  li.className = 'item';

  const status = statusDe(arquivo);

  li.innerHTML = `
    <span class="status-dot ${status.classe}"></span>
    <span class="item-info">
      <div class="item-nome">${arquivo.nome}</div>
      <div class="item-meta">${formatarTamanho(arquivo.tamanhoBytes)} · ${formatarData(arquivo.modificadoEm)}</div>
    </span>
    <span class="item-status ${status.classe}">${status.texto}</span>
    <span class="acoes"></span>
  `;

  const acoes = li.querySelector('.acoes');

  const botaoVerOriginal = document.createElement('button');
  botaoVerOriginal.className = 'botao';
  botaoVerOriginal.textContent = 'Ver bruto';
  botaoVerOriginal.addEventListener('click', () => verArquivo(arquivo.nome));
  acoes.appendChild(botaoVerOriginal);

  if (arquivo.normalizado) {
    const botaoVerLimpo = document.createElement('button');
    botaoVerLimpo.className = 'botao';
    botaoVerLimpo.textContent = 'Ver normalizado';
    botaoVerLimpo.addEventListener('click', () => verArquivo(arquivo.nomeLimpo));
    acoes.appendChild(botaoVerLimpo);
  }

  const botaoNormalizar = document.createElement('button');
  botaoNormalizar.className = 'botao primario';
  botaoNormalizar.textContent = arquivo.normalizado
    ? (arquivo.desatualizado ? 'Renormalizar' : 'Normalizar de novo')
    : 'Normalizar';
  botaoNormalizar.addEventListener('click', () => normalizar(arquivo.nome, botaoNormalizar));
  acoes.appendChild(botaoNormalizar);

  return li;
}

async function verArquivo(nome) {
  const resp = await fetch(`/api/ver?nome=${encodeURIComponent(nome)}`);
  const dados = await resp.json();
  if (!resp.ok) {
    abrirModal(nome, { erro: dados.erro });
    return;
  }
  abrirModal(nome, dados.conteudo);
}

async function normalizar(nome, botao) {
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Normalizando…';
  try {
    const resp = await fetch('/api/normalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    });
    const dados = await resp.json();
    if (!resp.ok) {
      alert(`Erro ao normalizar: ${dados.erro}`);
      return;
    }
    await carregarLista();
  } catch (erro) {
    alert(`Erro ao normalizar: ${erro.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

async function carregarLista() {
  const resp = await fetch('/api/arquivos');
  const dados = await resp.json();
  const arquivos = dados.arquivos || [];

  lista.innerHTML = '';
  vazio.hidden = arquivos.length > 0;

  const pendentes = arquivos.filter((a) => !a.normalizado || a.desatualizado).length;
  contagem.textContent = arquivos.length
    ? `${arquivos.length} arquivo(s) · ${pendentes} pendente(s)`
    : '';

  arquivos.forEach((arquivo) => lista.appendChild(renderizarItem(arquivo)));
}

botaoAtualizar.addEventListener('click', carregarLista);
carregarLista();
