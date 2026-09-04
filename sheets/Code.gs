const ABA_BRUTO = 'pluggy_bruto';
const ABA_TRANSACOES = 'pluggy_transacoes';
const ABA_CATEGORIAS = 'categorias';
const ABA_DASHBOARD = 'dashboard';
const CABECALHO_TRANSACOES = ['id','recebido_em','coletado_em','periodo','dia','dia_semana','parte_mes','descricao','conta','cartao','instituicao','categoria_original','categoria_manual','local','valor','tipo','status_validacao','observacao'];
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pluggy Monitor')
    .addItem('Atualizar dashboard', 'atualizarDashboard')
    .addItem('Reclassificar transações', 'reclassificarTransacoes')
    .addItem('Reprocessar histórico bruto', 'reprocessarHistoricoBruto')
    .addToUi();
}
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const recebido = new Date();
  salvarBruto(payload, recebido);
  prepararCategorias();
  salvarTransacoes(extrairTransacoes(payload, recebido));
  atualizarDashboard();
  return resposta( {
    ok:true
  }  );
}
function doGet() {
  const aba=SpreadsheetApp.getActive().getSheetByName(ABA_TRANSACOES);
  return resposta( {
    ok:true, transacoes:aba ? Math.max(0,aba.getLastRow()-1) : 0
  }  );
}
function salvarBruto(payload, recebido) {
  obterAba(ABA_BRUTO,['recebido_em','coletado_em','fonte','payload_json']).appendRow([recebido,payload.collectedAt||'',payload.source||'pluggy',JSON.stringify(payload)]);
}
function extrairTransacoes(payload, recebido) {
  const mapa=new Map();
  const historico=payload.pages?.fluxo?.historico|| {
  };
  Object.entries(historico).forEach(([periodo,registro])=> {
    const captures=registro.captures|| {
    };
    ['Entradas','Saídas'].forEach(tipo=> {
      if(captures[tipo]) extrairCaptura(captures[tipo],periodo,tipo==='Entradas'?'Entrada':'Saída',payload,recebido,mapa);
    }    );
    if(!captures.Entradas&&!captures['Saídas']) extrairCaptura(captures.Todos||captures.base||[],periodo,'Não identificado',payload,recebido,mapa);
  }  );
  if(!Object.keys(historico).length) {
    const linhas=payload.pages?.fluxo?.captures?.base||[];
    extrairCaptura(linhas,encontrarPeriodo(linhas),'Não identificado',payload,recebido,mapa);
  }
  return [...mapa.values()];
}
function extrairCaptura(linhas,periodo,tipo,payload,recebido,mapa) {
  const cartoes=obterCartoes(payload);
  for(let i=0;
  i<linhas.length-6;
  i++) {
    if(!/^\d+$/.test(String(linhas[i]))) continue;
    const valorTexto=String(linhas[i+6]||'');
    if(!valorTexto.startsWith('R$')) continue;
    const descricao=linhas[i+2]||'';
    const conta=linhas[i+3]||'';
    const categoria=linhas[i+5]||'';
    const id=[periodo,linhas[i],descricao,conta,categoria,valorTexto].join('|');
    if(mapa.has(id)) continue;
    const regra=encontrarCategoria(descricao,categoria);
    mapa.set(id,[id,recebido,payload.collectedAt||'',periodo,linhas[i],linhas[i+1]||'',parteDoMes(linhas[i]),descricao,conta,encontrarCartao(conta,cartoes),encontrarInstituicao(conta),categoria,regra,'',converterMoeda(valorTexto),tipo,'Pendente','']);
  }
}
function salvarTransacoes(linhas) {
  if(!linhas.length) return;
  const aba=obterAba(ABA_TRANSACOES,CABECALHO_TRANSACOES);
  const linhasExistentes = new Map();

  if (aba.getLastRow() > 1) {
    aba
      .getRange(2, 1, aba.getLastRow() - 1, CABECALHO_TRANSACOES.length)
      .getValues()
      .forEach((linha, indice) => {
        linhasExistentes.set(String(linha[0]), indice + 2);
      });
  }

  const novas = [];

  linhas.forEach((linha) => {
    const linhaExistente = linhasExistentes.get(String(linha[0]));

    if (linhaExistente) {
      aba
        .getRange(linhaExistente, 1, 1, CABECALHO_TRANSACOES.length)
        .setValues([linha]);
    } else {
      novas.push(linha);
    }
  });

  if (novas.length) {
    aba
      .getRange(aba.getLastRow() + 1, 1, novas.length, CABECALHO_TRANSACOES.length)
      .setValues(novas);
  }

  configurarTransacoes(aba);
}

function reprocessarHistoricoBruto() {
  const planilha = SpreadsheetApp.getActive();
  const abaBruto = planilha.getSheetByName(ABA_BRUTO);

  if (!abaBruto || abaBruto.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('Nenhum registro bruto encontrado.');
    return;
  }

  prepararCategorias();

  const registros = abaBruto
    .getRange(2, 1, abaBruto.getLastRow() - 1, 4)
    .getValues();

  let total = 0;

  registros.forEach((registro) => {
    try {
      const payload = JSON.parse(String(registro[3] || '{}'));
      const transacoes = extrairTransacoes(payload, registro[0] || new Date());
      salvarTransacoes(transacoes);
      total += transacoes.length;
    } catch (erro) {
      console.error('Registro bruto ignorado:', erro);
    }
  });

  atualizarDashboard();
  SpreadsheetApp.getUi().alert(
    `Histórico reprocessado. ${total} transações foram analisadas e atualizadas.`,
  );
}
function reclassificarTransacoes() {
  prepararCategorias();
  const aba=SpreadsheetApp.getActive().getSheetByName(ABA_TRANSACOES);
  if(!aba||aba.getLastRow()<2) return;
  const valores=aba.getRange(2,1,aba.getLastRow()-1,CABECALHO_TRANSACOES.length).getValues();
  valores.forEach(r=>r[12]=encontrarCategoria(r[7],r[11]));
  aba.getRange(2,1,valores.length,CABECALHO_TRANSACOES.length).setValues(valores);
  atualizarDashboard();
}
function atualizarDashboard() {
  const aba=obterAba(ABA_DASHBOARD,[]);
  aba.clear();
  aba.getCharts().forEach(c=>aba.removeChart(c));
  const ts=lerTransacoes();
  const entradas=ts.filter(t=>t.tipo==='Entrada');
  const saidas=ts.filter(t=>t.tipo==='Saída');
  aba.getRange('A1').setValue('PLUGGY MONITOR — DASHBOARD').setFontWeight('bold').setFontSize(16);
  aba.getRange('A3:B6').setValues([['Indicador','Valor'],['Entradas',somar(entradas)],['Saídas',somar(saidas)],['Saldo movimentado',somar(entradas)-somar(saidas)]]);
  aba.getRange('B4:B6').setNumberFormat('R$ #,##0.00');
  escreverResumo(aba,8,'Por período',agrupar(ts,t=>t.periodo),1);
  escreverResumo(aba,8,'Por parte do mês',agrupar(ts,t=>t.parteMes),7);
  escreverResumo(aba,8,'Por cartão',agrupar(ts,t=>t.cartao||'Sem cartão'),13);
  escreverResumo(aba,8,'Por categoria',agrupar(ts,t=>t.categoriaManual||t.categoriaOriginal||'Sem categoria'),19);
  escreverPendentes(aba,18,ts);
  aba.autoResizeColumns(1,24);
}
function lerTransacoes() {
  const aba=SpreadsheetApp.getActive().getSheetByName(ABA_TRANSACOES);
  if(!aba||aba.getLastRow()<2) return [];
  return aba.getRange(2,1,aba.getLastRow()-1,CABECALHO_TRANSACOES.length).getValues().map(r=>( {
    periodo:r[3],parteMes:r[6],descricao:r[7],cartao:r[9],categoriaOriginal:r[11],categoriaManual:r[12],valor:r[14],tipo:r[15],status:r[16]
  }  ));
}
function somar(ts) {
  return ts.reduce((s,t)=>s+Number(t.valor||0),0);
}
function agrupar(ts,chave) {
  const g= {
  };
  ts.forEach(t=> {
    const n=chave(t)||'Não informado';
    if(!g[n])g[n]= {
      q:0,e:0,s:0
    };
    g[n].q++;
    if(t.tipo==='Entrada')g[n].e+=Number(t.valor||0);
    if(t.tipo==='Saída')g[n].s+=Number(t.valor||0);
  }  );
  return Object.entries(g).map(([n,v])=>[n,v.q,v.e,v.s,v.e-v.s]).sort((a,b)=>b[3]-a[3]);
}
function escreverResumo(aba,linha,titulo,dados,coluna) {
  aba.getRange(linha,coluna).setValue(titulo).setFontWeight('bold');
  aba.getRange(linha+1,coluna,1,5).setValues([['Descrição','Quantidade','Entradas','Saídas','Saldo']]);
  if(dados.length) {
    aba.getRange(linha+2,coluna,dados.length,5).setValues(dados);
    aba.getRange(linha+2,coluna+2,dados.length,3).setNumberFormat('R$ #,##0.00');
  }
}
function escreverPendentes(aba,linha,ts) {
  const p=ts.filter(t=>t.status!=='Validado');
  aba.getRange(linha,1).setValue(`Pendentes de validação (${p.length})`).setFontWeight('bold');
  aba.getRange(linha+1,1,1,5).setValues([['Período','Descrição','Cartão','Categoria','Valor']]);
  if(p.length)aba.getRange(linha+2,1,p.length,5).setValues(p.map(t=>[t.periodo,t.descricao,t.cartao,t.categoriaManual||t.categoriaOriginal,t.valor]));
}
function prepararCategorias() {
  obterAba(ABA_CATEGORIAS,['texto_padrao','categoria','subcategoria','observacao']);
}
function encontrarCategoria(descricao,original) {
  const aba=SpreadsheetApp.getActive().getSheetByName(ABA_CATEGORIAS);
  if(!aba||aba.getLastRow()<2)return '';
  const texto=`${descricao} ${original}`.toLowerCase();
  const regras=aba.getRange(2,1,aba.getLastRow()-1,4).getValues();
  for(const r of regras)if(r[0]&&texto.includes(String(r[0]).toLowerCase()))return r[1]||'';
  return '';
}
function obterCartoes(payload) {
  const l=payload.pages?.overview?.captures?.base||[];
  const i=l.indexOf('CARTÕES DE CRÉDITO');
  const fim=l.indexOf('INVESTIMENTOS');
  const out=[];
  for(let p=i+4;
  i>=0&&p<(fim>i?fim:l.length)-2;
  p+=3)out.push(l[p]);
  return out;
}
function encontrarCartao(conta,cartoes) {
  return cartoes.find(c=>String(conta).toLowerCase().includes(String(c).toLowerCase())||String(c).toLowerCase().includes(String(conta).toLowerCase()))||(/cartão/i.test(conta)?conta:'');
}
function encontrarInstituicao(conta) {
  const t=String(conta).toLowerCase();
  if(t.includes('santander'))return'Santander';
  if(t.includes('nubank')||t.includes('nu pagamentos'))return'Nubank';
  if(t.includes('c6'))return'C6 Bank';
  if(t.includes('mercado'))return'Mercado Pago';
  if(t.includes('neon'))return'Neon';
  return'';
}
function parteDoMes(dia) {
  dia=Number(dia);
  return dia<=10?'Início do mês':dia<=20?'Meio do mês':'Fim do mês';
}
function encontrarPeriodo(linhas) {
  return linhas.find((linha) => /De\s+\d{4}$/i.test(String(linha))) || '';
}
function converterMoeda(valor) {
  return Number(String(valor).replace('R$','').trim().replace(/\./g,'').replace(',','.'))||0;
}
function configurarTransacoes(aba) {
  aba.getRange('O:O').setNumberFormat('R$ #,##0.00');
  aba.getRange('Q2:Q').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Pendente','Validado','Revisar','Ignorar'],true).build());
  aba.setFrozenRows(1);
}
function obterAba(nome,cabecalho) {
  const p=SpreadsheetApp.getActive();
  let a=p.getSheetByName(nome);
  if(!a)a=p.insertSheet(nome);
  if(cabecalho.length&&a.getLastRow()===0) {
    a.appendRow(cabecalho);
    a.setFrozenRows(1);
  }
  return a;
}
function resposta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
