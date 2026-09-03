// ============================================================
// SGA — Sincronização com o Portal do Aluno (planilha SEPARADA)
// O SGA (lado confiável) ESCREVE as vagas na planilha do portal e LÊ
// as inscrições de lá. O aluno só toca na planilha do portal.
// Troca automática (gatilho diário) + botões manuais na gestão.
// ============================================================

function _portalId() { return String(_param('PORTAL_SHEET_ID', PORTAL_SHEET_ID_DEFAULT) || '').trim(); }

function _portalBook() {
  const id = _portalId();
  if (!id) throw userError('Configure o ID da planilha do portal em Admin › Parâmetros.');
  try { return SpreadsheetApp.openById(id); }
  catch (e) { throw userError('Não consegui abrir a planilha do portal. Confira o ID e se ela pertence a esta conta.'); }
}

// Lê uma aba de outra planilha como lista de objetos (chaves = cabeçalho).
function _sheetObjs(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(String);
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const o = {}; headers.forEach((h, j) => { o[h] = data[i][j]; });
    out.push(o);
  }
  return out;
}

// Garante a aba com o cabeçalho certo na planilha do portal.
function _portalTab(book, name) {
  let sh = book.getSheetByName(name);
  if (!sh) sh = book.insertSheet(name);
  const headers = PORTAL_HEADERS[name];
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  } else if (sh.getLastRow() === 1) {
    const cur = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0].map(String);
    if (cur.slice(0, headers.length).join('|') !== headers.join('|')) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

// Substitui as linhas de UMA seleção (col 0 = SelecaoID), preservando as outras.
function _portalUpsert(sheet, headers, selecaoId, newRows) {
  const data = sheet.getDataRange().getValues();
  const kept = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(selecaoId)) kept.push(data[i].slice(0, headers.length));
  }
  const all = kept.concat(newRows);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (all.length) sheet.getRange(2, 1, all.length, headers.length).setValues(all);
}

// ── Preparar a planilha do portal (Admin) ────────────────────
function prepararPortal(email) {
  requirePerfil(email, ['Admin']);
  const book = _portalBook();
  Object.keys(PORTAL_HEADERS).forEach(n => _portalTab(book, n));
  ['Página1', 'Sheet1', 'Planilha1'].forEach(n => {
    const s = book.getSheetByName(n);
    if (s && s.getLastRow() === 0 && book.getSheets().length > 1) book.deleteSheet(s);
  });
  return { ok: true, url: book.getUrl() };
}

// ── Publicar / despublicar uma seleção no portal ─────────────
function publicarSelecao(id, email) {
  requirePerfil(email, ACAO_WRITERS);
  const full = getSelecao(id, email);   // valida acesso/segmento e traz vagas completas
  const book = _portalBook();
  const selSheet = _portalTab(book, 'Selecao');
  const vagasSheet = _portalTab(book, 'Vagas');
  _portalTab(book, 'Inscricoes');
  const now = nowBR();
  _portalUpsert(selSheet, PORTAL_HEADERS.Selecao, id,
    [[id, full.Nome, full.Status, full.maxVagasAluno || 1, now]]);
  const rows = (full.vagas || []).map(v => [
    id, v.ID, v.Titulo, v.Tipo, v.acaoTitulo || '', v.editalLabel || '',
    JSON.stringify(v.faixas || []),
    JSON.stringify(Object.assign({}, v.requisitos || {}, { cursosNomes: v.cursosNomes || [] })),
    JSON.stringify(v.criterios || [])
  ]);
  _portalUpsert(vagasSheet, PORTAL_HEADERS.Vagas, id, rows);
  const idx = findRowIndex('Selecoes', id);
  if (idx !== -1) getSheet('Selecoes').getRange(idx, COL.Selecoes.PublicadoEm + 1).setValue(now);
  return { ok: true, url: book.getUrl(), vagas: rows.length };
}

function despublicarSelecao(id, email) {
  requirePerfil(email, ACAO_WRITERS);
  const book = _portalBook();
  const selSheet = book.getSheetByName('Selecao'); if (selSheet) _portalUpsert(selSheet, PORTAL_HEADERS.Selecao, id, []);
  const vagasSheet = book.getSheetByName('Vagas'); if (vagasSheet) _portalUpsert(vagasSheet, PORTAL_HEADERS.Vagas, id, []);
  const idx = findRowIndex('Selecoes', id);
  if (idx !== -1) getSheet('Selecoes').getRange(idx, COL.Selecoes.PublicadoEm + 1).setValue('');
  return { ok: true };
}

// ── Sincronizar inscrições (portal → SGA), modo espelho ──────
// Upsert por (seleção+vaga+matrícula), preservando NotasJSON/NotaFinal/Situacao;
// remove cancelados; rejeita vaga fechada; sinaliza matrícula não cadastrada.
function _sincronizarInscricoes() {
  const book = _portalBook();
  const insSheet = book.getSheetByName('Inscricoes');
  const portal = insSheet ? _sheetObjs(insSheet) : [];
  const selecoes = sheetRows('Selecoes');
  const vagasAll = sheetRows('SelVagas');
  const alunos = sheetRows('Alunos');
  const matAluno = {}; alunos.forEach(a => { if (a.Matricula) matAluno[String(a.Matricula).trim()] = true; });
  const selById = {}; selecoes.forEach(s => { selById[String(s.ID)] = s; });
  const vagaById = {}; vagasAll.forEach(v => { vagaById[String(v.ID)] = v; });

  const keyOf = (s, v, m) => String(s) + '|' + String(v) + '|' + String(m).trim().toLowerCase();
  const desired = {}; let rejeitados = 0, naoCadastrados = 0;
  const reconcile = {};

  portal.forEach(r => {
    const selId = String(r.SelecaoID || '').trim();
    const vagaId = String(r.VagaID || '').trim();
    const mat = String(r.Matricula || '').trim();
    if (!selId || !vagaId || !mat) { rejeitados++; return; }
    const sel = selById[selId];
    if (!sel) { rejeitados++; return; }
    let vids = []; try { vids = JSON.parse(sel.VagasJSON || '[]'); } catch (e) {}
    if (vids.map(String).indexOf(vagaId) === -1) { rejeitados++; return; }
    const vaga = vagaById[vagaId];
    if (!vaga || String(vaga.Status) !== 'Aberta') { rejeitados++; return; }
    reconcile[selId] = true;
    if (!matAluno[mat]) naoCadastrados++;
    desired[keyOf(selId, vagaId, mat)] = {
      selId: selId, vagaId: vagaId, faixaCH: r.FaixaCH, nome: r.Nome, matricula: mat,
      curso: r.Curso, email: r.Email || r.EmailAluno, data: r.DataInscricao
    };
  });
  // Seleções publicadas também entram (para refletir cancelamento total no portal).
  selecoes.forEach(s => { if (String(s.PublicadoEm || '').trim()) reconcile[String(s.ID)] = true; });

  const sh = getSheet('Inscricoes');
  const data = sh.getDataRange().getValues();
  const C = COL.Inscricoes, W = HEADERS.Inscricoes.length;
  const existing = {};
  for (let i = 1; i < data.length; i++) {
    existing[keyOf(String(data[i][C.SelecaoID]), String(data[i][C.VagaID]), String(data[i][C.Matricula]))] = { rowNum: i + 1, row: data[i] };
  }

  let novos = 0, atualizados = 0, cancelados = 0;
  const toAppend = [], toDelete = [];
  Object.keys(desired).forEach(k => {
    const d = desired[k], ex = existing[k];
    if (ex) {
      const row = ex.row.slice(0, W);
      row[C.FaixaCH] = d.faixaCH; row[C.CandidatoNome] = d.nome; row[C.Curso] = d.curso;
      row[C.Email] = d.email; row[C.DataInscricao] = d.data;
      sh.getRange(ex.rowNum, 1, 1, W).setValues([row]);
      atualizados++;
    } else {
      const row = new Array(W).fill('');
      row[C.ID] = genId(); row[C.SelecaoID] = d.selId; row[C.VagaID] = d.vagaId; row[C.FaixaCH] = d.faixaCH;
      row[C.CandidatoNome] = d.nome; row[C.Matricula] = d.matricula; row[C.Curso] = d.curso;
      row[C.Email] = d.email; row[C.DataInscricao] = d.data; row[C.Situacao] = 'Inscrito';
      toAppend.push(row); novos++;
    }
  });
  Object.keys(existing).forEach(k => {
    const selId = k.split('|')[0];
    if (reconcile[selId] && !desired[k]) { toDelete.push(existing[k].rowNum); cancelados++; }
  });
  if (toAppend.length) sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, W).setValues(toAppend);
  toDelete.sort((a, b) => b - a).forEach(rn => sh.deleteRow(rn));

  return { ok: true, novos: novos, atualizados: atualizados, cancelados: cancelados, rejeitados: rejeitados, naoCadastrados: naoCadastrados };
}

function sincronizarInscricoes(email) {
  requirePerfil(email, ACAO_WRITERS);
  return _sincronizarInscricoes();
}

// ── Gatilho diário (~07:30). Rode UMA vez no editor. ─────────
function syncDiario() {
  try { _sincronizarInscricoes(); }
  catch (e) { console.error(e && e.stack ? e.stack : String(e)); }
}

function instalarGatilhoSync() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'syncDiario') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncDiario').timeBased().everyDays(1).atHour(7).nearMinute(30).create();
  Logger.log('Gatilho diário de sincronização instalado (~07:30).');
  return 'OK — sincroniza todo dia ~07:30.';
}
