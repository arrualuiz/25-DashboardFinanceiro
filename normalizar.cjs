#!/usr/bin/env node
/**
 * normalizar.js
 * -------------
 * Converte o JSON "cru" do scraping do Pluggy (arrays de strings soltas,
 * na ordem em que aparecem na tela) em um JSON estruturado, com nomes de
 * campo explícitos, fácil de mandar pra qualquer LLM ou de usar em código.
 *
 * Uso:
 *   node normalizar.js saida/registro-completo-XXXX.json
 *   node normalizar.js saida/registro-completo-XXXX.json saida/limpo.json
 *
 * Se não passar o segundo argumento, salva ao lado do arquivo original
 * com o sufixo "-limpo.json".
 */

const fs = require('fs');

// ---------- helpers de parsing de valores ----------

function isMoney(str) {
  return typeof str === 'string' && str.trim().startsWith('R$');
}

function parseMoney(str) {
  if (!isMoney(str)) return null;
  const clean = str.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return Number.isNaN(num) ? null : num;
}

function isPercent(str) {
  return typeof str === 'string' && /%\s*$/.test(str.trim());
}

function parsePercent(str) {
  if (!isPercent(str)) return null;
  const num = parseFloat(str.replace('%', '').trim().replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}

// ---------- OVERVIEW ----------

function parseOverview(arr) {
  const contas = [];
  let i = arr.indexOf('CONTAS BANCÁRIAS');
  i += 2; // pula título + total geral das contas
  while (i < arr.length && arr[i] !== 'CARTÕES DE CRÉDITO') {
    const nome = arr[i];
    const info = arr[i + 1] || '';
    const saldo = arr[i + 2];
    if (isMoney(saldo)) {
      const m = info.match(/([\d.,]+)\s*conta[s]?\s*·\s*([\d.,]+)\s*%/i);
      contas.push({
        banco: nome,
        quantidade_contas: m ? parseInt(m[1], 10) : null,
        percentual_do_total: m ? parseFloat(m[2].replace(',', '.')) : null,
        saldo: parseMoney(saldo),
      });
      i += 3;
    } else {
      i += 1;
    }
  }

  const cartoesResult = { total_fatura: null, percentual_uso: null, limite: null, cartoes: [] };
  let c = arr.indexOf('CARTÕES DE CRÉDITO');
  if (c !== -1) {
    cartoesResult.total_fatura = parseMoney(arr[c + 1]);
    const usoMatch = (arr[c + 2] || '').match(/([\d.,]+)\s*%/);
    cartoesResult.percentual_uso = usoMatch ? parseFloat(usoMatch[1].replace(',', '.')) : null;
    const limiteMatch = (arr[c + 3] || '').match(/R\$\s*[\d.,]+/);
    cartoesResult.limite = limiteMatch ? parseMoney(limiteMatch[0]) : null;
    let j = c + 4;
    while (j < arr.length && arr[j] !== 'INVESTIMENTOS') {
      const nome = arr[j];
      const final = arr[j + 1];
      const saldo = arr[j + 2];
      if (isMoney(saldo)) {
        cartoesResult.cartoes.push({
          nome,
          final_cartao: final ? final.replace(/xxxx/i, '').trim() : null,
          saldo: parseMoney(saldo),
        });
        j += 3;
      } else {
        j += 1;
      }
    }
  }

  const investimentos = { total: null, resumo: null, por_classe: [] };
  let k = arr.indexOf('INVESTIMENTOS');
  if (k !== -1) {
    k += 1;
    while (arr[k] === 'Classes' || arr[k] === 'Instituições') k += 1; // pula labels de toggle
    investimentos.total = parseMoney(arr[k]);
    k += 1;
    investimentos.resumo = arr[k] || null; // ex: "1 classes · 62 ativos(37 ativos, 25 inativos)"
    k += 1;
    while (k < arr.length && arr[k] !== 'EVOLUÇÃO DO SALDO') {
      const classe = arr[k];
      const perc = arr[k + 1];
      const valor = arr[k + 2];
      if (isPercent(perc) && isMoney(valor)) {
        investimentos.por_classe.push({ classe, percentual: parsePercent(perc), valor: parseMoney(valor) });
        k += 3;
      } else {
        k += 1;
      }
    }
  }

  return { contas_bancarias: contas, cartoes_credito: cartoesResult, investimentos };
}

// ---------- FLUXO DE CAIXA ----------

function parsePairsUntilMarker(arr, startIdx, endMarker) {
  const list = [];
  let i = startIdx;
  while (i < arr.length && arr[i] !== endMarker) {
    const categoria = arr[i];
    const valor = arr[i + 1];
    if (isMoney(valor)) {
      list.push({ categoria, valor: parseMoney(valor) });
      i += 2;
    } else {
      i += 1;
    }
  }
  return { list, nextIndex: i };
}

// Nomes de mês em pt-BR aparecem como "Setembro De 2026" logo após a lista
// de categorias de despesas futuras — isso marca o fim da lista.
const MES_REGEX = /^[A-Za-zÀ-ú]+\s+De\s+\d{4}$/i;

function parsePairsWhileMoney(arr, startIdx) {
  const list = [];
  let i = startIdx;
  while (i + 1 < arr.length && isMoney(arr[i + 1]) && !MES_REGEX.test(arr[i])) {
    list.push({ categoria: arr[i], valor: parseMoney(arr[i + 1]) });
    i += 2;
  }
  return { list, nextIndex: i };
}

function parseFluxo(arr) {
  let i = arr.indexOf('DESPESAS');
  const totalDespesas = parseMoney(arr[i + 1]);
  i += 3; // pula "Transações categorizadas"
  const despesas = parsePairsUntilMarker(arr, i, 'DESPESAS FUTURAS');

  i = despesas.nextIndex;
  const totalFuturas = parseMoney(arr[i + 1]);
  i += 3; // pula "Transações pendentes"
  const futuras = parsePairsWhileMoney(arr, i);
  i = futuras.nextIndex;

  const mesReferencia = MES_REGEX.test(arr[i]) ? arr[i] : arr[i];
  i += 1;
  const entradasMes = parseMoney(arr[i]); i += 1;
  const saidasMes = parseMoney(arr[i]); i += 1;

  const contasStart = arr.indexOf('Todas contas', i);
  if (contasStart === -1) {
    // fallback de segurança: não deveria acontecer se o parsing acima estiver correto
    return {
      despesas: { total: totalDespesas, categorias: despesas.list },
      despesas_futuras: { total: totalFuturas, categorias: futuras.list },
      mes_referencia: mesReferencia,
      resumo_mes: { entradas: entradasMes, saidas: saidasMes },
      contas_disponiveis: [],
      transacoes: [],
      _erro: 'não encontrou "Todas contas" após o índice esperado — revisar formato de entrada',
    };
  }
  const contas = [];
  let c = contasStart + 1;
  while (c < arr.length && arr[c] !== 'Todos') { contas.push(arr[c]); c += 1; }
  i = c + 3; // pula labels de aba "Todos","Entradas","Saídas"

  const transacoes = [];
  let diaAtual = null;
  let diaSemanaAtual = null;
  while (i < arr.length) {
    const item = arr[i];
    if (/transações$/i.test(item) || /^Saldo:/i.test(item)) { i += 1; continue; }
    if (/^\d+$/.test(item) && arr[i + 1] && /-feira$/i.test(arr[i + 1])) {
      diaAtual = item;
      diaSemanaAtual = arr[i + 1];
      i += 2;
      continue;
    }
    const descricao = arr[i];
    const conta = arr[i + 1];
    const dot = arr[i + 2];
    const categoria = arr[i + 3];
    const valor = arr[i + 4];
    if (dot === '·' && isMoney(valor)) {
      transacoes.push({
        dia: diaAtual,
        dia_semana: diaSemanaAtual,
        descricao,
        conta,
        categoria,
        valor: parseMoney(valor),
      });
      i += 5;
    } else {
      i += 1;
    }
  }

  return {
    despesas: { total: totalDespesas, categorias: despesas.list },
    despesas_futuras: { total: totalFuturas, categorias: futuras.list },
    mes_referencia: mesReferencia,
    resumo_mes: { entradas: entradasMes, saidas: saidasMes },
    contas_disponiveis: contas,
    transacoes,
  };
}

// ---------- ATIVOS ----------

function parseAtivos(arr) {
  let i = arr.indexOf('Carteira (62 ativos)');
  if (i === -1) i = arr.findIndex((s) => /^Carteira \(/.test(s));
  const totalCarteira = parseMoney(arr[i + 1]);
  const categoria = arr[i + 2];
  const totalCategoria = parseMoney(arr[i + 3]);
  let j = i + 4;

  const ativos = [];
  while (j < arr.length) {
    const nome = arr[j];
    const instituicao = arr[j + 1];
    const dot = arr[j + 2];
    const tipo = arr[j + 3];
    const valor = arr[j + 4];
    const percentual = arr[j + 5];
    if (dot === '·' && isMoney(valor) && isPercent(percentual)) {
      ativos.push({
        nome,
        instituicao,
        tipo,
        valor: parseMoney(valor),
        percentual: parsePercent(percentual),
      });
      j += 6;
    } else {
      j += 1;
    }
  }

  return { total: totalCarteira, categoria, total_categoria: totalCategoria, ativos };
}

// ---------- ORQUESTRADOR ----------

function normalizarRegistro(raw) {
  const out = {
    collectedAt: raw.collectedAt,
    source: raw.source,
  };

  if (raw.pages?.overview?.captures?.base) {
    out.overview = parseOverview(raw.pages.overview.captures.base);
  }

  // O scraper salva a mesma tela repetida em base/Todos/Entradas/Saídas
  // porque clicou nas abas de filtro. Usamos só "base" (a mais completa).
  const fluxoCap = raw.pages?.fluxo?.captures?.base || raw.pages?.fluxo?.captures?.Todos;
  if (fluxoCap) {
    out.fluxo = parseFluxo(fluxoCap);
    const historico = raw.pages?.fluxo?.historico || {};
    out.fluxo.historico = Object.fromEntries(Object.entries(historico).map(([periodo, registro]) => {
      const captures = registro.captures || {};
      const normalizado = parseFluxo(captures.base || []);
      normalizado.filtros = Object.fromEntries(['Todos', 'Entradas', 'Saídas'].filter(nome => captures[nome]).map(nome => [nome, parseFluxo(captures[nome])]));
      return [periodo, normalizado];
    }));
  }

  const ativosCap = raw.pages?.ativos?.captures?.base || raw.pages?.ativos?.captures?.Classes;
  if (ativosCap) {
    out.ativos = parseAtivos(ativosCap);
  }

  out.connections = raw.connections;
  // A normalização agrega os dados para consumo do dashboard, mas nunca
  // descarta a coleta original nem as capturas alternativas dos filtros.
  out.raw = raw;
  return out;
}

// ---------- CLI ----------

if (require.main === module) {
  const [, , inputPath, outputPathArg] = process.argv;

  if (!inputPath) {
    console.error('Uso: node normalizar.cjs caminho/entrada.json [caminho/saida.json]');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const limpo = normalizarRegistro(raw);
  const outputPath = outputPathArg || inputPath.replace(/\.json$/i, '-limpo.json');

  fs.writeFileSync(outputPath, JSON.stringify(limpo, null, 2), 'utf-8');
  console.log('✅ Salvo em', outputPath);
}

module.exports = { normalizarRegistro };
