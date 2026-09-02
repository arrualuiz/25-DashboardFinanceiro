import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE = 'https://meu.pluggy.ai';
const OUT = path.resolve(process.env.PLUGGY_OUT || './saida');
const PROFILE = path.resolve(process.env.PLUGGY_PROFILE || './perfil-chrome');
const chromePaths = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(Boolean);
const executablePath = chromePaths.find(p => fsSync.existsSync(p));
await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(PROFILE, { recursive: true });
const browser = await chromium.launchPersistentContext(PROFILE, { headless: false, executablePath, viewport: { width: 1440, height: 1000 } });
const page = browser.pages()[0] || await browser.newPage();
await page.goto(`${BASE}/overview`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
if (/login|signin|entrar/i.test(page.url())) {
  console.log('Faça login no Pluggy nesta janela e pressione Enter aqui.');
  process.stdin.setEncoding('utf8');
  await new Promise(resolve => process.stdin.once('data', resolve));
}
const collectedAt = new Date().toISOString();
const pages = {};
async function capture(name, url, actions = []) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1800);
  const captures = {};
  for (const action of ['base', ...actions]) {
    if (action !== 'base') {
      const control = page.getByRole('button', { name: new RegExp(`^${action}$`, 'i') }).first();
      if (await control.count() && await control.isVisible()) { await control.click(); await page.waitForTimeout(700); }
    }
    captures[action] = (await page.locator('body').innerText()).split('\n').map(v => v.trim()).filter(Boolean);
  }
  pages[name] = { url: page.url(), captures };
}
await capture('overview', '/overview');
await capture('fluxo', '/cash', ['Todos', 'Entradas', 'Saídas']);
await capture('ativos', '/assets', ['Classes', 'Instituições']);
await page.goto(`${BASE}/connections`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1500);
const connectionText = await page.locator('body').innerText();
const connections = { checkedAt: collectedAt, activeCount: (connectionText.match(/(\d+)\s*ativas?/i) || [])[1] || null, hasLimitWarning: /limite de conexões atingido/i.test(connectionText) };
const data = { schemaVersion: 2, collectedAt, source: 'pluggy', pages, connections };
const stamp = collectedAt.replace(/[:.]/g, '-');
await fs.writeFile(path.join(OUT, `pluggy-completo-${stamp}.json`), JSON.stringify(data, null, 2), 'utf8');
await fs.writeFile(path.join(OUT, 'ultimo-completo.json'), JSON.stringify(data, null, 2), 'utf8');
if (process.env.SHEETS_WEBHOOK_URL) {
  const response = await fetch(process.env.SHEETS_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  console.log(`Sheets: ${response.status}`);
}
console.log(`Coleta completa concluída em ${OUT}`);
await browser.close();
