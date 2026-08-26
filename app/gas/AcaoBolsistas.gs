// ============================================================
// SGA — Ações · Bolsistas (Fatia C)
// Bolsista = Aluno. Semanas e CH total são calculados NO SERVIDOR.
// Relatório final é upload por participante (subpasta Relatorios/).
// ============================================================

// Semanas completas entre início e fim (⌊(fim − início) / 7 dias⌋).
function _semanas(ini, fim) {
  if (!ini || !fim) return 0;
  const d1 = new Date(String(ini).slice(0, 10) + 'T00:00:00');
  const d2 = new Date(String(fim).slice(0, 10) + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return 0;
  return Math.floor((d2 - d1) / (7 * 24 * 3600 * 1000));
}

// Um aluno não pode ter dois vínculos (bolsista/voluntário) na MESMA ação.
function _alunoJaVinculado(acaoId, alunoId, ignoraId) {
  const naBolsa = sheetRows('AcaoBolsistas').some(b =>
    String(b.AcaoID) === String(acaoId) && String(b.AlunoID) === String(alunoId) && String(b.ID) !== String(ignoraId || ''));
  const naVol = sheetRows('AcaoVoluntarios').some(v =>
    String(v.AcaoID) === String(acaoId) && String(v.AlunoID) === String(alunoId) && String(v.ID) !== String(ignoraId || ''));
  return naBolsa || naVol;
}

function _validaBolsista(p) {
  if (!p.alunoId) throw userError('Selecione o aluno.');
  if (p.chBolsa && !/^\d+$/.test(String(p.chBolsa))) throw userError('CH inválida.');
  if (p.statusSigaa && STATUS_SIGAA.indexOf(p.statusSigaa) === -1) throw userError('Status SIGAA inválido.');
  if (p.statusRelatorio && STATUS_RELATORIO.indexOf(p.statusRelatorio) === -1) throw userError('Status do relatório inválido.');
  if (p.status && STATUS_VINCULO.indexOf(p.status) === -1) throw userError('Status inválido.');
  if (p.dataInicio && p.dataFim && _dateStr(p.dataFim) < _dateStr(p.dataInicio)) {
    throw userError('A data de término não pode ser anterior à de início.');
  }
}

// keepRel = { fileId, url } preservados na edição (o relatório sobe à parte).
function _bolsistaRow(id, p, criadoEm, criadoPor, keepRel) {
  const semanas = _semanas(p.dataInicio, p.dataFim);
  const ch = Number(p.chBolsa) || 0;
  keepRel = keepRel || {};
  return [
    id, p.acaoId, p.alunoId, p.editalBolsaId || '', p.chBolsa || '',
    p.valorBolsa === '' || p.valorBolsa == null ? '' : Number(p.valorBolsa) || 0,
    _dateStr(p.dataInicio), _dateStr(p.dataFim), semanas, ch * semanas,
    p.statusSigaa || '', p.statusRelatorio || '',
    keepRel.fileId || '', keepRel.url || '',
    String(p.observacoes || '').trim(), p.status || 'Ativo', criadoEm, criadoPor
  ];
}

function getBolsistas(acaoId, email) {
  requirePerfil(email, ACAO_READERS);
  const alunos = sheetRows('Alunos');
  const editais = sheetRows('Editais');
  return sheetRows('AcaoBolsistas').filter(b => String(b.AcaoID) === String(acaoId)).map(b => {
    const al = alunos.find(a => String(a.ID) === String(b.AlunoID));
    const ed = editais.find(e => String(e.ID) === String(b.EditalBolsaID));
    return {
      ID: b.ID, AlunoID: b.AlunoID, alunoNome: al ? _nomeExib(al) : '',
      EditalBolsaID: b.EditalBolsaID, editalLabel: ed ? _editalLabel(ed) : '',
      CHBolsa: b.CHBolsa, ValorBolsa: b.ValorBolsa,
      DataInicio: _dateStr(b.DataInicio), DataFim: _dateStr(b.DataFim),
      TotalSemanas: b.TotalSemanas, CHTotal: b.CHTotal,
      StatusSIGAA: b.StatusSIGAA, StatusRelatorio: b.StatusRelatorio,
      relatorioUrl: b.RelatorioUrl || '', temRelatorio: !!b.RelatorioFileId,
      Observacoes: b.Observacoes, Status: b.Status
    };
  });
}

function addBolsista(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(p.acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  _validaBolsista(p);
  if (_alunoJaVinculado(p.acaoId, p.alunoId)) throw userError('Este aluno já é bolsista ou voluntário desta ação.');
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  getSheet('AcaoBolsistas').appendRow(_bolsistaRow(id, p, nowBR(), email, {}));
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateBolsista(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const idx = findRowIndex('AcaoBolsistas', id);
  if (idx === -1) throw userError('Bolsista não encontrado.');
  const sh = getSheet('AcaoBolsistas');
  const old = sh.getRange(idx, 1, 1, HEADERS.AcaoBolsistas.length).getValues()[0];
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(old[COL.AcaoBolsistas.AcaoID]));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  p.acaoId = old[COL.AcaoBolsistas.AcaoID];
  _validaBolsista(p);
  if (_alunoJaVinculado(p.acaoId, p.alunoId, id)) throw userError('Este aluno já é bolsista ou voluntário desta ação.');
  const keepRel = { fileId: old[COL.AcaoBolsistas.RelatorioFileId], url: old[COL.AcaoBolsistas.RelatorioUrl] };
  const row = _bolsistaRow(id, p, old[COL.AcaoBolsistas.CriadoEm], old[COL.AcaoBolsistas.CriadoPor], keepRel);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteBolsista(id, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const b = sheetRows('AcaoBolsistas').find(x => String(x.ID) === String(id));
  if (!b) throw userError('Bolsista não encontrado.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(b.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  if (b.RelatorioFileId) { try { DriveApp.getFileById(b.RelatorioFileId).setTrashed(true); } catch (e) {} }
  const idx = findRowIndex('AcaoBolsistas', id);
  getSheet('AcaoBolsistas').deleteRow(idx);
  return { ok: true };
}

// Upload do relatório final do bolsista (subpasta Relatorios/ da ação).
function uploadBolsistaRelatorio(bolsistaId, payload, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const b = sheetRows('AcaoBolsistas').find(x => String(x.ID) === String(bolsistaId));
  if (!b) throw userError('Bolsista não encontrado.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(b.AcaoID));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  const bytes = Utilities.base64Decode(payload.base64);
  if (!_isPdf(bytes)) throw userError('O arquivo enviado não é um PDF válido.');
  let fileName = String(payload.fileName || 'Relatório final.pdf').trim();
  if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';
  const folder = _childFolder(_acaoFolder(acao), 'Relatorios');
  const file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', fileName));
  const idx = findRowIndex('AcaoBolsistas', bolsistaId);
  if (idx !== -1) {
    const sh = getSheet('AcaoBolsistas');
    sh.getRange(idx, COL.AcaoBolsistas.RelatorioFileId + 1).setValue(file.getId());
    sh.getRange(idx, COL.AcaoBolsistas.RelatorioUrl + 1).setValue(file.getUrl());
  }
  return { ok: true, url: file.getUrl() };
}
