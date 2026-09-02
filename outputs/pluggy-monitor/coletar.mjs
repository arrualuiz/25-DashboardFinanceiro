import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const URL = process.env.PLUGGY_URL || 'https://meu.pluggy.ai/overview';
const OUT = path.resolve(process.env.PLUGGY_OUT || './saida');
const PROFILE = path.resolve(process.env.PLUGGY_PROFILE || './perfil-chrome');
const chromePaths = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].filter(Boolean);
const executablePath = chromePaths.find(p => fsSync.existsSync(p));

await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(PROFILE, { recursive: true });
const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  executablePath: executablePath || undefined,
  viewport: { width: 1440, height: 1000 }
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);

if (/login|signin|entrar/i.test(page.url())) {
  console.log('Faça login no Pluggy nesta janela. Depois pressione Enter aqui.');
  process.stdin.setEncoding('utf8');
  await new Promise(resolve => process.stdin.once('data', resolve));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
}

const collectedAt = new Date().toISOString();
const text = await page.locator('body').innerText();
const sections = {};
for (const heading of ['CONTAS BANCÁRIAS', 'CARTÕES DE CRÉDITO', 'INVESTIMENTOS', 'EVOLUÇÃO DO SALDO']) {
  const start = text.toUpperCase().indexOf(heading);
  if (start >= 0) sections[heading] = text.slice(start, start + 2500).split('\n').map(x => x.trim()).filter(Boolean);
}
const data = { collectedAt, url: page.url(), title: await page.title(), sections, fullText: text };
const stamp = collectedAt.replace(/[:.]/g, '-');
await fs.writeFile(path.join(OUT, `pluggy-${stamp}.json`), JSON.stringify(data, null, 2), 'utf8');
await fs.writeFile(path.join(OUT, 'ultimo.json'), JSON.stringify(data, null, 2), 'utf8');
await page.screenshot({ path: path.join(OUT, `pluggy-${stamp}.png`), fullPage: true });
console.log(`Coleta concluída: ${Object.keys(sections).length} seções. Arquivos salvos em ${OUT}`);
await browser.close();
