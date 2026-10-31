const SETS_MAGIC = ['hob', 'msh', 'spm', 'spe', 'tdm', 'fra'];
const SETS_POKE  = ['30th', '30th-c', 'me06'];
const CAB = ['chave','jogo','set','numero','nome','raridade','arteInteira','precoUSD','imagem'];

// sub-coleções que aparecem dentro de outra no app (chave: set da planilha → set exibido)
const GRUPOS = {'30th-c': '30th', 'spe': 'spm'};
function setExibido_(s) { return GRUPOS[s] || s; }

const NOMES_SETS = {
  hob: 'O Hobbit', msh: 'Marvel Super Heroes', spm: "Marvel's Spider-Man",
  spe: 'Spider-Man — Scene Box', tdm: 'Tarkir: Dragonstorm', fra: 'Reality Fracture',
  '30th': 'Pokémon 30 Anos', '30th-c': '30 Anos — Coleção Clássica', me06: 'Reinado Delta', dex251: 'Pokédex 251 — Arte inteira'
};

/* ===== IMPORTAÇÃO (rodar manualmente) ===== */
function importarTudo() {
  const linhas = [];
  SETS_MAGIC.forEach(s => linhas.push(...buscarMagic(s)));
  SETS_POKE.forEach(s => linhas.push(...buscarPokemon(s)));
  const ss = SpreadsheetApp.getActive();
  const aba = ss.getSheetByName('Cartas') || ss.insertSheet('Cartas');
  aba.clearContents();
  aba.getRange(1, 1, 1, CAB.length).setValues([CAB]).setFontWeight('bold');
  if (linhas.length) {
    aba.getRange(2, 4, linhas.length, 1).setNumberFormat('@');
    aba.getRange(2, 1, linhas.length, CAB.length).setValues(linhas);
  }
  aba.setFrozenRows(1);
  if (!ss.getSheetByName('Marcacoes')) {
    const m = ss.insertSheet('Marcacoes');
    m.getRange(1, 1, 1, 3).setValues([['chave','estado','data']]).setFontWeight('bold');
    m.setFrozenRows(1);
  }
  Logger.log('Total de cartas importadas: ' + linhas.length);
}

function buscarMagic(set) {
  const out = [];
  let url = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('set:' + set) + '&unique=prints&order=set';
  while (url) {
    const r = UrlFetchApp.fetch(url, {muteHttpExceptions: true, headers: {'Accept': 'application/json'}});
    if (r.getResponseCode() != 200) { Logger.log('Magic ' + set + ': erro ' + r.getResponseCode()); break; }
    const j = JSON.parse(r.getContentText());
    j.data.forEach(c => {
      const img = c.image_uris ? c.image_uris.normal
        : (c.card_faces && c.card_faces[0].image_uris ? c.card_faces[0].image_uris.normal : '');
      const preco = c.prices.usd || c.prices.usd_foil || '';
      out.push([set + '-' + c.collector_number, 'Magic', set, c.collector_number, c.name,
                c.rarity, c.border_color == 'borderless', preco ? Number(preco) : '', img]);
    });
    url = j.has_more ? j.next_page : null;
    Utilities.sleep(120);
  }
  Logger.log('Magic ' + set + ': ' + out.length + ' cartas');
  return out;
}

function buscarPokemon(set) {
  const r = UrlFetchApp.fetch('https://api.tcgdex.net/v2/en/sets/' + set, {muteHttpExceptions: true});
  if (r.getResponseCode() != 200) { Logger.log('Pokémon ' + set + ': erro ' + r.getResponseCode()); return []; }
  const cartas = JSON.parse(r.getContentText()).cards || [];
  const out = [];
  for (let i = 0; i < cartas.length; i += 40) {
    const lote = cartas.slice(i, i + 40);
    const resp = UrlFetchApp.fetchAll(lote.map(c => ({url: 'https://api.tcgdex.net/v2/en/cards/' + c.id, muteHttpExceptions: true})));
    resp.forEach((rr, k) => {
      const c = lote[k];
      const rar = rr.getResponseCode() == 200 ? (JSON.parse(rr.getContentText()).rarity || '') : '';
      const fa = /illustration|hyper|special|futur/i.test(rar);
      out.push([set + '-' + c.localId, 'Pokémon', set, c.localId, c.name, rar, fa, '',
                c.image ? c.image + '/high.webp' : '']);
    });
  }
  Logger.log('Pokémon ' + set + ': ' + out.length + ' cartas');
  return out;
}

/* ===== SÍMBOLOS DAS COLEÇÕES ===== */
function iconeSet_(set, jogo) {
  if (jogo === 'Magic') return 'https://svgs.scryfall.io/sets/' + set + '.svg';
  const cache = CacheService.getScriptCache();
  const chave = 'icone-' + set;
  const salvo = cache.get(chave);
  if (salvo !== null) return salvo;
  let url = '';
  try {
    const r = UrlFetchApp.fetch('https://api.tcgdex.net/v2/en/sets/' + set, {muteHttpExceptions: true});
    if (r.getResponseCode() == 200) {
      const j = JSON.parse(r.getContentText());
      const base = j.logo || j.symbol || '';
      if (base) url = base + '.png';
    }
  } catch (e) {}
  cache.put(chave, url, 21600); // guarda 6 horas
  return url;
}

/* ===== FOTOS DOS PACOTES (lidas direto do Drive) ===== */
function fotoPacote(id) {
  const b = DriveApp.getFileById(id).getBlob();
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}
// Rodar UMA vez no editor para autorizar o acesso ao Drive.
function testarFotos() {
  const r = fotoPacote('1Wuk3Pq_Gw3hmo_sATX-CLxUmq884GxG5');
  Logger.log('OK, foto lida: ' + r.length + ' caracteres');
}

/* ===== PREÇO NA LIGA (experimental: o servidor do Google lê a página da Liga) ===== */
function urlLiga_(nome, jogo) {
  const base = jogo === 'pokemon' ? 'https://www.ligapokemon.com.br' : 'https://www.ligamagic.com.br';
  return base + '/?view=cards/card&card=' + encodeURIComponent(nome);
}
function buscarLiga_(nome, jogo) {
  const r = UrlFetchApp.fetch(urlLiga_(nome, jogo), {
    muteHttpExceptions: true, followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9'
    }
  });
  return {codigo: r.getResponseCode(), html: r.getContentText()};
}
function precosDoHtml_(html) {
  const vals = [];
  const re = /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    if (v > 0) vals.push(v);
  }
  return vals;
}
function precoLiga(nome, jogo) {
  const r = buscarLiga_(nome, jogo);
  if (r.codigo != 200) return {ok: false, codigo: r.codigo};
  const vals = precosDoHtml_(r.html);
  if (!vals.length) return {ok: true, codigo: 200, encontrados: 0};
  vals.sort((a, b) => a - b);
  return {ok: true, codigo: 200, encontrados: vals.length, menor: vals[0], mediana: vals[Math.floor(vals.length / 2)], maior: vals[vals.length - 1], url: urlLiga_(nome, jogo)};
}
// Rodar no editor e me mandar o registro.
function testarLiga() {
  const r = buscarLiga_('Lightning Bolt', 'magic');
  Logger.log('HTTP ' + r.codigo + ' | tamanho ' + r.html.length);
  const i = r.html.indexOf('R$');
  Logger.log('primeiro R$ em ' + i + ' | trecho: ' + (i >= 0 ? r.html.substr(Math.max(0, i - 300), 700).replace(/\s+/g, ' ') : r.html.substr(0, 500).replace(/\s+/g, ' ')));
  Logger.log('precos achados: ' + JSON.stringify(precosDoHtml_(r.html).slice(0, 20)));
}

/* ===== APP WEB ===== */
function doGet(e) {
  // modo API: /exec?liga=NOME&jogo=magic|pokemon → JSON com preços lidos da Liga
  if (e && e.parameter && e.parameter.liga) {
    const out = precoLiga(e.parameter.liga, e.parameter.jogo || 'magic');
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Grimório')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function lerMarcacoes_() {
  const v = SpreadsheetApp.getActive().getSheetByName('Marcacoes').getDataRange().getValues();
  const m = {};
  for (let i = 1; i < v.length; i++) if (v[i][0]) m[v[i][0]] = v[i][1];
  return m;
}

function lerCartas_() {
  return SpreadsheetApp.getActive().getSheetByName('Cartas').getDataRange().getValues().slice(1);
}

function listarSets() {
  const marc = lerMarcacoes_();
  const res = {};
  lerCartas_().forEach(c => {
    const s = setExibido_(c[2]);
    if (!res[s]) res[s] = {set: s, nome: NOMES_SETS[s] || s, jogo: c[1], total: 0, tenho: 0, fa: 0, faTenho: 0, icone: '', capa: ''};
    const r = res[s];
    r.total++;
    const t = marc[c[0]] === 'tenho';
    if (t) r.tenho++;
    if (c[6] === true) { r.fa++; if (t) r.faTenho++; }
    // capa do pacote: primeira carta com imagem; prefere carta com arte inteira
    if (c[8] && (!r.capa || (c[6] === true && !r.capaFA))) { r.capa = c[8]; if (c[6] === true) r.capaFA = true; }
  });
  const lista = Object.values(res);
  lista.forEach(s => { s.icone = iconeSet_(s.set, s.jogo); delete s.capaFA; });
  // Pokédex 251: um slot por Pokémon; conta slots com pelo menos uma carta "tenho"
  const dex = lerDex_();
  if (dex.length) {
    const slots = {};
    dex.forEach(r => { if (marc[r[0]] === 'tenho') slots[r[1]] = true; });
    const n = Object.keys(slots).length;
    lista.push({set: 'dex251', nome: NOMES_SETS.dex251, jogo: 'Pokémon', total: 251, tenho: n, fa: 251, faTenho: n, icone: '', capa: ''});
  }
  return lista;
}

function carregarSet(set) {
  const marc = lerMarcacoes_();
  return lerCartas_().filter(c => setExibido_(c[2]) === set).map(c => ({
    k: c[0], n: String(c[3]) + (c[2] !== set ? ' ★' : ''), nome: c[4], r: c[5], fa: c[6] === true, p: c[7], img: c[8], e: marc[c[0]] || ''
  }));
}

/* ===== POKÉDEX 251 — cartas de arte inteira dos 251 primeiros ===== */
// filtros de raridade na TCGdex (busca "contém"): IR/SIR e full art (Ultra Rare / Rare Ultra)
const DEX_FILTROS = [['illustration', 'Ilustração rara'], ['ultra', 'Full art']];
const DEX_CAB = ['chave', 'dex', 'nomeCarta', 'set', 'tipo', 'imagem'];

function importarDex()       { importarDexFaixa_(1, 251); }
function importarDexParte1() { importarDexFaixa_(1, 125); }
function importarDexParte2() { importarDexFaixa_(126, 251); }

function importarDexFaixa_(ini, fim) {
  const ss = SpreadsheetApp.getActive();
  let aba = ss.getSheetByName('Dex');
  if (!aba) { aba = ss.insertSheet('Dex'); aba.getRange(1, 1, 1, DEX_CAB.length).setValues([DEX_CAB]).setFontWeight('bold'); aba.setFrozenRows(1); }
  const antigas = aba.getDataRange().getValues().slice(1).filter(r => r[0] && !(Number(r[1]) >= ini && Number(r[1]) <= fim));
  const pedidos = [];
  for (let d = ini; d <= fim; d++) DEX_FILTROS.forEach(f => pedidos.push({dex: d, tipo: f[1],
    url: 'https://api.tcgdex.net/v2/en/cards?dexId=' + d + '&rarity=' + encodeURIComponent(f[0])}));
  const novas = [];
  for (let i = 0; i < pedidos.length; i += 40) {
    const lote = pedidos.slice(i, i + 40);
    const resp = UrlFetchApp.fetchAll(lote.map(p => ({url: p.url, muteHttpExceptions: true})));
    resp.forEach((r, k) => {
      if (r.getResponseCode() != 200) return;
      let arr = [];
      try { arr = JSON.parse(r.getContentText()); } catch (e) { return; }
      if (!Array.isArray(arr)) return;
      arr.forEach(c => {
        if (!c.id) return;
        novas.push([c.id, lote[k].dex, c.name || '', c.id.slice(0, c.id.lastIndexOf('-')), lote[k].tipo, c.image ? c.image + '/high.webp' : '']);
      });
    });
    Utilities.sleep(100);
  }
  const vistos = {};
  const todas = antigas.concat(novas).filter(r => { if (vistos[r[0]]) return false; vistos[r[0]] = true; return true; });
  todas.sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0])));
  aba.clearContents();
  aba.getRange(1, 1, 1, DEX_CAB.length).setValues([DEX_CAB]).setFontWeight('bold');
  if (todas.length) aba.getRange(2, 1, todas.length, DEX_CAB.length).setValues(todas);
  aba.setFrozenRows(1);
  Logger.log('Pokédex ' + ini + '-' + fim + ': ' + novas.length + ' cartas novas; total na aba: ' + todas.length);
}

// Rodar para conferir se a TCGdex responde ao filtro (deve listar cartas do Pikachu)
function testarDex() {
  const r = UrlFetchApp.fetch('https://api.tcgdex.net/v2/en/cards?dexId=25&rarity=illustration', {muteHttpExceptions: true});
  Logger.log('HTTP ' + r.getResponseCode() + ' — ' + r.getContentText().slice(0, 600));
}

function lerDex_() {
  const aba = SpreadsheetApp.getActive().getSheetByName('Dex');
  if (!aba) return [];
  return aba.getDataRange().getValues().slice(1).filter(r => r[0]);
}

function carregarDex() {
  const marc = lerMarcacoes_();
  return lerDex_().map(r => ({k: r[0], dex: Number(r[1]), nome: r[2], set: r[3], tipo: r[4], img: r[5], e: marc[r[0]] || ''}));
}

function marcar(chave, estado) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = SpreadsheetApp.getActive().getSheetByName('Marcacoes');
    const v = aba.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      if (v[i][0] === chave) {
        if (estado) aba.getRange(i + 1, 2, 1, 2).setValues([[estado, new Date()]]);
        else aba.deleteRow(i + 1);
        return true;
      }
    }
    if (estado) aba.appendRow([chave, estado, new Date()]);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function migrarChecklist() {
  ['hob-199','spe-21','spe-22','spe-23','spe-24','spe-25','spe-26'].forEach(k => marcar(k, 'tenho'));
  Logger.log('Marcações migradas.');
}
