const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const valueOf = (lines, index) => lines[index] || 'R$ 0';
const numberOf = (value) => Number(String(value).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0;
const byId = (id) => document.getElementById(id);
function render(data) {
  const sections = data.sections || {};
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
  byId('source').textContent = `Fonte: ${data.url || 'Pluggy'}`;
}
async function load() { byId('refresh').classList.add('loading'); try { const response = await fetch('/api/dados'); if (!response.ok) throw new Error('Sem dados'); render(await response.json()); } catch { byId('updated').textContent = 'Nenhuma coleta encontrada'; } finally { byId('refresh').classList.remove('loading'); } }
byId('refresh').addEventListener('click', load); load();