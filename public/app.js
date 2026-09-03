const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const valueOf = (lines, index) => lines[index] || 'R$ 0';
const numberOf = (value) => Number(String(value).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0;
const byId = (id) => document.getElementById(id);
function sectionsFromPages(data) {
  if (data.sections) return data.sections;
  const lines = data.pages?.overview?.captures?.base || [];
  const sections = {};
  const headings = ['CONTAS BANCÁRIAS', 'CARTÕES DE CRÉDITO', 'INVESTIMENTOS', 'EVOLUÇÃO DO SALDO'];
  headings.forEach((heading, index) => {
    const start = lines.findIndex(line => line.toUpperCase() === heading);
    if (start < 0) return;
    const next = headings.slice(index + 1).map(h => lines.findIndex(line => line.toUpperCase() === h)).find(i => i > start);
    sections[heading] = lines.slice(start, next > 0 ? next : lines.length);
  });
  return sections;
}
function render(data) {
  const sections = sectionsFromPages(data);
  const accounts = sections['CONTAS BANCÁRIAS'] || [];
  const cards = sections['CARTÕES DE CRÉDITO'] || [];
  const investments = sections.INVESTIMENTOS || [];
  const balance = numberOf(valueOf(accounts, 1));
  const credit = numberOf(valueOf(cards, 1));
  const invested = numberOf(valueOf(investments, 3));
  byId('total-balance').textContent = money(balance); byId('total-credit').textContent = money(credit); byId('total-investments').textContent = money(invested); byId('net-worth').textContent = money(balance + invested); byId('evolution-value').textContent = valueOf((sections['EVOLUÇÃO DO SALDO'] || []), 1);
  byId('account-count').textContent = `${Math.max(0, (accounts.length - 2) / 3)} contas`; byId('credit-limit').textContent = `Limite ${valueOf(cards, 3).replace('Limite: ', '')}`; byId('credit-note').textContent = valueOf(cards, 2); byId('usage').textContent = valueOf(cards, 2); byId('usage-bar').style.width = `${Math.min(100, numberOf(valueOf(cards, 2)))}%`;
  byId('investment-value').textContent = money(invested); byId('investment-count').textContent = valueOf(investments, 4); byId('allocation-value').textContent = money(invested);
  byId('accounts-list').innerHTML = accounts.slice(2, 17).reduce((html, item, index, list) => index % 3 === 0 && list[index + 1] ? `${html}<div class="row"><div><b>${item}</b><small>${list[index + 1]}</small></div><strong>${list[index + 2]}</strong></div>` : html, '');
  byId('cards-list').innerHTML = cards.slice(4, 22).reduce((html, item, index, list) => index % 3 === 0 && list[index + 1] ? `${html}<div class="row"><div><b>${item}</b><small>${list[index + 1]}</small></div><strong>${list[index + 2]}</strong></div>` : html, '');
  byId('updated').textContent = `Atualizado ${new Date(data.collectedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
  byId('source').textContent = `Fonte: ${data.source || data.url || 'Pluggy'}`;
  const pages = data.pages || {};
  let tabs = document.querySelector('.data-tabs');
  if (!tabs) {
    tabs = document.createElement('div'); tabs.className = 'data-tabs';
    document.querySelector('footer').before(tabs);
    const detail = document.createElement('section'); detail.className = 'panel data-detail'; detail.innerHTML = '<div class="panel-head"><h2 id="detail-title">Dados completos da coleta</h2></div><div id="detail-content" class="data-cards"></div>'; tabs.after(detail);
  }
  tabs.innerHTML = '';
  for (const [key, label] of [['overview','Overview'], ['fluxo','Fluxo'], ['ativos','Ativos'], ['conexoes','Status das conexões']]) {
    const button = document.createElement('button'); button.textContent = label; button.className = 'tab-button';
    button.onclick = () => { const capture = pages[key]?.captures?.base || []; byId('detail-title').textContent = label; byId('detail-content').textContent = key === 'conexoes' ? JSON.stringify(data.connections || {}, null, 2) : capture.join('\n'); };
    tabs.append(button);
  }
  tabs.style.display = 'none';
  const all = Object.entries(pages).map(([key, page]) => `===== ${key.toUpperCase()} =====\n${Object.entries(page.captures || {}).map(([name, lines]) => `-- ${name} --\n${lines.join('\n')}`).join('\n')}`).join('\n\n');
  byId('detail-title').textContent = 'Dados completos da coleta';
  const content = byId('detail-content'); content.innerHTML = '';
  for (const [key, page] of Object.entries(pages)) {
    const section = document.createElement('div'); section.className = 'data-page'; section.innerHTML = `<h3>${key}</h3>`;
    for (const [name, lines] of Object.entries(page.captures || {})) { const group = document.createElement('div'); group.className = 'data-group'; group.innerHTML = `<h4>${name}</h4><div class="data-grid"></div>`; for (const line of lines) { const card = document.createElement('div'); card.className = 'data-card'; card.textContent = line; group.querySelector('.data-grid').append(card); } section.append(group); }
    content.append(section);
  }
  const status = document.createElement('div'); status.className = 'data-page'; status.innerHTML = `<h3>Status técnico</h3><div class="data-card">${data.connections?.activeCount || '?'} conexões ativas</div>`; content.append(status);
}
async function load() { byId('refresh').classList.add('loading'); try { const response = await fetch('/api/dados'); if (!response.ok) throw new Error('Sem dados'); render(await response.json()); } catch { byId('updated').textContent = 'Nenhuma coleta encontrada'; } finally { byId('refresh').classList.remove('loading'); } }
byId('refresh').addEventListener('click', load); load();
