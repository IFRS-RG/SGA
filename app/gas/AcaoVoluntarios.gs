// ============================================================
// SGA — Ações · Voluntários (Fatia D)
// Voluntário = Aluno. Semanas e CH total calculados NO SERVIDOR.
// Sem edital/valor (é voluntariado). Relatório final por participante.
// ============================================================

function _validaVoluntario(p) {
  if (!p.alunoId) throw userError('Selecione o aluno.');
  if (p.chVoluntariado && !/^\d+$/.test(String(p.chVoluntariado))) throw userError('CH inválida.');
  if (p.statusSigaa && STATUS_SIGAA.indexOf(p.statusSigaa) === -1) throw userError('Status SIGAA inválido.');
  if (p.statusRelatorio && STATUS_RELATORIO.indexOf(p.statusRelatorio) === -1) throw userError('Status do relatório inválido.');
  if (p.status && STATUS_VINCULO.indexOf(p.status) === -1) throw userError('Status inválido.');
  if (p.dataInicio && p.dataFim && _dateStr(p.dataFim) < _dateStr(p.dataInicio)) {
    throw userError('A data de término não pode ser anterior à de início.');
  }
}

function _voluntarioRow(id, p, criadoEm, criadoPor, keepRel) {
  const semanas = _semanas(p.dataInicio, p.dataFim);
  const ch = Number(p.chVoluntariado) || 0;
  keepRel = keepRel || {};
  return [
    id, p.acaoId, p.alunoId, p.chVoluntariado || '',
    _dateStr(p.dataInicio), _dateStr(p.dataFim), semanas, ch * semanas,
    p.statusSigaa || '', p.statusRelatorio || '',
    keepRel.fileId || '', keepRel.url || '',
    String(p.observacoes || '').trim(), p.status || 'Ativo', criadoEm, criadoPor
  ];
}

function getVoluntarios(acaoId, email) {
  requirePerfil(email, ACAO_READERS);
  const alunos = sheetRows('Alunos');
  return sheetRows('AcaoVoluntarios').filter(v => String(v.AcaoID) === String(acaoId)).map(v => {
    const al = alunos.find(a => String(a.ID) === String(v.AlunoID));
    return {
      ID: v.ID, AlunoID: v.AlunoID, alunoNome: al ? _nomeExib(al) : '',
      CHVoluntariado: v.CHVoluntariado,
      DataInicio: _dateStr(v.DataInicio), DataFim: _dateStr(v.DataFim),
      TotalSemanas: v.TotalSemanas, CHTotal: v.CHTotal,
      StatusSIGAA: v.StatusSIGAA, StatusRelatorio: v.StatusRelatorio,
      relatorioUrl: v.RelatorioUrl || '', temRelatorio: !!v.RelatorioFileId,
      Observacoes: v.Observacoes, Status: v.Status
    };
  });
}

function addVoluntario(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(p.acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  _validaVoluntario(p);
  if (_alunoJaVinculado(p.acaoId, p.alunoId)) throw userError('Este aluno já é bolsista ou voluntário desta ação.');
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  getSheet('AcaoVoluntarios').appendRow(_voluntarioRow(id, p, nowBR(), email, {}));
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateVoluntario(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const idx = findRowIndex('AcaoVoluntarios', id);
  if (idx === -1) throw userError('Voluntário não encontrado.');
  const sh = getSheet('AcaoVoluntarios');
  const old = sh.getRange(idx, 1, 1, HEADERS.AcaoVoluntarios.length).getValues()[0];
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(old[COL.AcaoVoluntarios.AcaoID]));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  p.acaoId = old[COL.AcaoVoluntarios.AcaoID];
  _validaVoluntario(p);
  if (_alunoJaVinculado(p.acaoId, p.alunoId, id)) throw userError('Este aluno já é bolsista ou voluntário desta ação.');
  const keepRel = { fileId: old[COL.AcaoVoluntarios.RelatorioFileId], url: old[COL.AcaoVoluntarios.RelatorioUrl] };
  const row = _voluntarioRow(id, p, old[COL.AcaoVoluntarios.CriadoEm], old[COL.AcaoVoluntarios.CriadoPor], keepRel);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteVoluntario(id, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const v = sheetRows('AcaoVoluntarios').find(x => String(x.ID) === String(id));
  if (!v) throw userError('Voluntário não encontrado.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(v.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  if (v.RelatorioFileId) { try { DriveApp.getFileById(v.RelatorioFileId).setTrashed(true); } catch (e) {} }
  getSheet('AcaoVoluntarios').deleteRow(findRowIndex('AcaoVoluntarios', id));
  return { ok: true };
}

function uploadVoluntarioRelatorio(volId, payload, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const v = sheetRows('AcaoVoluntarios').find(x => String(x.ID) === String(volId));
  if (!v) throw userError('Voluntário não encontrado.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(v.AcaoID));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  const bytes = Utilities.base64Decode(payload.base64);
  if (!_isPdf(bytes)) throw userError('O arquivo enviado não é um PDF válido.');
  let fileName = String(payload.fileName || 'Relatório final.pdf').trim();
  if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';
  const folder = _childFolder(_acaoFolder(acao), 'Relatorios');
  const file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', fileName));
  const idx = findRowIndex('AcaoVoluntarios', volId);
  if (idx !== -1) {
    const sh = getSheet('AcaoVoluntarios');
    sh.getRange(idx, COL.AcaoVoluntarios.RelatorioFileId + 1).setValue(file.getId());
    sh.getRange(idx, COL.AcaoVoluntarios.RelatorioUrl + 1).setValue(file.getUrl());
  }
  return { ok: true, url: file.getUrl() };
}
