const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const valueOf = (lines, index) => lines[index] || 'R$ 0';
const numberOf = (value) => Number(String(value).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0;
const byId = (id) => document.getElementById(id);
let historyRecords = [];
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
function renderNormalized(data) {
  const overview = data.overview || {};
  const cards = overview.cartoes_credito || {};
  const investments = overview.investimentos || {};
  const accounts = overview.contas_bancarias || [];
  const flow = data.fluxo || {};
  const assets = data.ativos || {};
  const fmt = (value) => money(value);
  byId('total-balance').textContent = fmt(accounts.reduce((sum, account) => sum + (account.saldo || 0), 0));
  byId('total-credit').textContent = fmt(cards.total_fatura);
  byId('total-investments').textContent = fmt(investments.total);
  byId('net-worth').textContent = fmt(accounts.reduce((sum, account) => sum + (account.saldo || 0), 0) + (investments.total || 0));
  byId('evolution-value').textContent = fmt(data.overview.evolucao_saldo || 0);
  byId('account-count').textContent = `${accounts.length} contas`;
  byId('credit-limit').textContent = `Limite ${fmt(cards.limite)}`;
  byId('credit-note').textContent = `${cards.percentual_uso || 0}% utilizado`;
  byId('usage').textContent = `${cards.percentual_uso || 0}%`;
  byId('usage-bar').style.width = `${Math.min(100, cards.percentual_uso || 0)}%`;
  byId('investment-value').textContent = fmt(investments.total);
  byId('investment-count').textContent = investments.resumo || `${assets.ativos?.length || 0} ativos`;
  const firstClass = investments.por_classe?.[0];
  byId('allocation-value').textContent = fmt(firstClass?.valor || investments.total);
  byId('accounts-list').innerHTML = accounts.map(account => `<div class="row"><div><b>${account.banco}</b><small>${account.quantidade_contas || 0} conta(s) · ${account.percentual_do_total || 0}%</small></div><strong>${fmt(account.saldo)}</strong></div>`).join('');
  byId('cards-list').innerHTML = (cards.cartoes || []).map(card => `<div class="row"><div><b>${card.nome}</b><small>xxxx ${card.final_cartao || '----'}</small></div><strong>${fmt(card.saldo)}</strong></div>`).join('');
  byId('updated').textContent = `Atualizado ${new Date(data.collectedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
  byId('source').textContent = `Fonte: ${data.source || 'Pluggy'} · JSON normalizado`;
  const panel = document.querySelector('.fluxo-bonito') || document.createElement('section');
  panel.className = 'panel fluxo-bonito';
  panel.innerHTML = '<div class="flow-title"><h2>Fluxo de Caixa</h2><p>Despesas, receitas e movimentações das suas contas.</p></div><div class="flow-summary"></div><div class="flow-transactions"><h3>Transações coletadas</h3><div class="transaction-list"></div></div>';
  if (!panel.parentElement) document.querySelector('footer').before(panel);
  const summary = panel.querySelector('.flow-summary');
  for (const [title, item, tone] of [['Despesas', flow.despesas, 'red'], ['Despesas futuras', flow.despesas_futuras, 'yellow']]) {
    const card = document.createElement('article'); card.className = `flow-card ${tone}`;
    card.innerHTML = `<h3>${title}</h3><strong>${fmt(item?.total)}</strong><small>${title === 'Despesas' ? 'Transações categorizadas' : 'Transações pendentes'}</small><div class="category-list"></div>`;
    (item?.categorias || []).forEach(category => { const row = document.createElement('div'); row.innerHTML = `<span>${category.categoria}</span><b>${fmt(category.valor)}</b>`; card.querySelector('.category-list').append(row); });
    summary.append(card);
  }
  const list = panel.querySelector('.transaction-list');
  const accountFilter = byId('account-filter')?.value || '';
  const directionFilter = byId('direction-filter')?.value || '';
  const searchFilter = (byId('search-filter')?.value || '').toLowerCase().trim();
  const sourceFlow = directionFilter === 'entrada' ? (flow.filtros?.Entradas || flow) : directionFilter === 'saida' ? (flow.filtros?.Saídas || flow) : (flow.filtros?.Todos || flow);
  const visibleTransactions = (sourceFlow.transacoes || []).filter(transaction => { const text = `${transaction.descricao} ${transaction.conta} ${transaction.categoria || ''}`.toLowerCase(); return (!accountFilter || transaction.conta === accountFilter) && (!searchFilter || text.includes(searchFilter)); });
  visibleTransactions.forEach(transaction => { const row = document.createElement('div'); row.className = 'transaction-row'; row.innerHTML = `<span class="day"><b>${transaction.dia}</b>${transaction.dia_semana}</span><div><strong>${transaction.descricao}</strong><small>${transaction.conta} · ${transaction.categoria || ''}</small></div><b class="amount">${fmt(transaction.valor)}</b>`; list.append(row); });
  panel.querySelector('.flow-transactions h3').textContent = `Transações coletadas (${visibleTransactions.length} de ${(flow.transacoes || []).length})`;
  document.querySelector('#ativos-detalhados, #dados-completos')?.remove();
  const assetsPanel = document.createElement('section'); assetsPanel.id = 'ativos-detalhados'; assetsPanel.className = 'panel data-detail';
  assetsPanel.innerHTML = `<div class="panel-head"><div><span class="panel-icon lime">↗</span><h2>Carteira completa</h2></div><span class="panel-kicker">${assets.ativos?.length || 0} ativos · ${fmt(assets.total)}</span></div><div class="table-wrap"><table><thead><tr><th>Ativo</th><th>Instituição</th><th>Tipo</th><th>Valor</th><th>%</th></tr></thead><tbody></tbody></table></div>`;
  const assetBody = assetsPanel.querySelector('tbody');
  (assets.ativos || []).forEach(asset => { const row = document.createElement('tr'); [asset.nome, asset.instituicao, asset.tipo, fmt(asset.valor), `${asset.percentual || 0}%`].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }); assetBody.append(row); });
  panel.after(assetsPanel);
  const detailPanel = document.createElement('section'); detailPanel.id = 'dados-completos'; detailPanel.className = 'panel data-detail';
  detailPanel.innerHTML = '<div class="panel-head"><div><span class="panel-icon coral">≡</span><h2>Dados completos da coleta</h2></div><span class="panel-kicker">Original preservado</span></div><div class="data-tabs"></div><div class="data-capture"></div>';
  assetsPanel.after(detailPanel);
  const captureArea = detailPanel.querySelector('.data-capture'); const rawPages = data.raw?.pages || {};
  const showCapture = (pageName) => { captureArea.innerHTML = ''; const page = rawPages[pageName]; for (const [captureName, values] of Object.entries(page?.captures || {})) { const group = document.createElement('details'); group.className = 'data-group'; group.open = captureName === 'base'; const title = document.createElement('summary'); title.textContent = `${captureName} (${values.length} itens)`; group.append(title); const pre = document.createElement('pre'); pre.textContent = values.join('\n'); group.append(pre); captureArea.append(group); } };
  Object.keys(rawPages).forEach((pageName, index) => { const button = document.createElement('button'); button.className = 'tab-button'; button.textContent = pageName; button.onclick = () => showCapture(pageName); detailPanel.querySelector('.data-tabs').append(button); if (index === 0) showCapture(pageName); });
  const status = document.createElement('div'); status.className = 'data-page'; status.innerHTML = `<h3>Status técnico</h3><div class="data-card">${data.connections?.activeCount || '?'} conexões ativas · período ${flow.mes_referencia || 'não informado'}</div>`; detailPanel.append(status);
  document.querySelectorAll('nav [data-view]').forEach(button => button.onclick = () => document.getElementById(button.dataset.view === 'overview' ? 'visao' : button.dataset.view === 'fluxo' ? 'fluxo' : button.dataset.view === 'ativos' ? 'ativos-detalhados' : 'dados-completos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
function render(data) {
  if (data.overview && !data.pages) return renderNormalized(data);
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
  renderFluxoBonito(pages.fluxo?.captures?.base || []);
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
    for (const [name, lines] of Object.entries(page.captures || {})) {
      const group = document.createElement('div'); group.className = 'data-group'; group.innerHTML = `<h4>${name}</h4><div class="table-wrap"><table><tbody></tbody></table></div>`;
      const body = group.querySelector('tbody');
      for (let i = 0; i < lines.length; i += 6) { const row = document.createElement('tr'); for (const value of lines.slice(i, i + 6)) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); } body.append(row); }
      section.append(group);
    }
    content.append(section);
  }
  const status = document.createElement('div'); status.className = 'data-page'; status.innerHTML = `<h3>Status técnico</h3><div class="data-card">${data.connections?.activeCount || '?'} conexões ativas</div>`; content.append(status);
}
function renderFluxoBonito(lines) {
  let panel = document.querySelector('.fluxo-bonito');
  if (!panel) { panel = document.createElement('section'); panel.className = 'panel fluxo-bonito'; const detail = document.querySelector('.data-detail'); (detail || document.querySelector('footer')).before(panel); }
  const expense = lines.indexOf('DESPESAS'), future = lines.indexOf('DESPESAS FUTURAS'), month = lines.findIndex(x => /De \d{4}/i.test(x));
  const categories = (start, end) => { const out=[]; for(let i=start+3;i<Math.min(end, start+20);i+=2) if(lines[i] && /^R\$/.test(lines[i+1]||'')) out.push([lines[i],lines[i+1]]); return out; };
  panel.innerHTML = '<div class="flow-title"><h2>Fluxo de Caixa</h2><p>Despesas, receitas e movimentações das suas contas.</p></div><div class="flow-summary"></div><div class="flow-transactions"><h3>Transações coletadas</h3><div class="transaction-list"></div></div>';
  const summary = panel.querySelector('.flow-summary');
  for (const [title, index, end, tone] of [['Despesas',expense,future,'red'],['Despesas futuras',future,month,'yellow']]) { if(index<0) continue; const card=document.createElement('article'); card.className=`flow-card ${tone}`; card.innerHTML=`<h3>${title}</h3><strong>${lines[index+1]||'R$ 0'}</strong><small>${lines[index+2]||''}</small><div class="category-list"></div>`; for(const [name,value] of categories(index,end>0?end:lines.length)){const row=document.createElement('div');row.innerHTML=`<span>${name}</span><b>${value}</b>`;card.querySelector('.category-list').append(row);} summary.append(card); }
  const start = lines.indexOf('Saídas') + 1, list = panel.querySelector('.transaction-list');
  for(let i=Math.max(start,0); i<lines.length; i++){ if(/^\d+$/.test(lines[i]) && lines[i+1]){ const day=lines[i], weekday=lines[i+1], desc=lines[i+2], account=lines[i+3], category=lines[i+5], amount=lines[i+6]; if(desc && amount){const row=document.createElement('div');row.className='transaction-row';row.innerHTML=`<span class="day"><b>${day}</b>${weekday}</span><div><strong>${desc}</strong><small>${account} · ${category||''}</small></div><b class="amount">${amount}</b>`;list.append(row);}} }
}
function setupFilters(records) {
  const periods = byId('period-filter'); const accounts = byId('account-filter');
  const periodMap = new Map(); records.forEach((record, recordIndex) => Object.entries(record.fluxo?.historico || { [record.fluxo?.mes_referencia || `registro ${recordIndex + 1}`]: record.fluxo }).forEach(([period, fluxo]) => { if (!periodMap.has(period)) periodMap.set(period, { record, period, fluxo }); }));
  const periodEntries = [...periodMap.values()];
  periods.innerHTML = periodEntries.map((entry, index) => `<option value="${index}">${entry.period}</option>`).join('');
  const uniqueAccounts = [...new Set(periodEntries.flatMap(entry => [...(entry.fluxo?.contas_disponiveis || []), ...(entry.fluxo?.transacoes || []).map(transaction => transaction.conta)]).filter(Boolean))].sort();
  accounts.innerHTML = '<option value="">Todas as contas</option>' + uniqueAccounts.map(account => `<option value="${account}">${account}</option>`).join('');
  const refreshView = () => { const entry = periodEntries[Number(periods.value)] || periodEntries[0]; renderNormalized({ ...entry.record, fluxo: entry.fluxo }); };
  [periods, accounts, byId('direction-filter'), byId('search-filter')].forEach(control => control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', refreshView));
  refreshView();
}
async function load() { byId('refresh').classList.add('loading'); try { const response = await fetch('/api/historico'); if (!response.ok) throw new Error('Sem dados'); const payload = await response.json(); historyRecords = payload.registros || []; if (!historyRecords.length) throw new Error('Sem dados'); setupFilters(historyRecords); } catch { byId('updated').textContent = 'Nenhuma coleta encontrada'; } finally { byId('refresh').classList.remove('loading'); } }
byId('refresh').addEventListener('click', load); load();
