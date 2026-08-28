// ============================================================
// SGA — Ações · Colaboradores (pessoa + função + CH total)
// ============================================================

function _colabNome(tipo, id) {
  const r = sheetRows(tipo === 'aluno' ? 'Alunos' : 'Servidores').find(x => String(x.ID) === String(id));
  return r ? _nomeExib(r) : '';
}

function getColaboradores(acaoId, email) {
  requirePerfil(email, ACAO_READERS);
  return sheetRows('AcaoColaboradores').filter(c => String(c.AcaoID) === String(acaoId)).map(c => ({
    ID: c.ID, PessoaTipo: c.PessoaTipo, PessoaID: c.PessoaID,
    nome: _colabNome(c.PessoaTipo, c.PessoaID), Funcao: c.Funcao, CHTotal: c.CHTotal
  }));
}

function _validaColaborador(p) {
  if (!p.pessoaTipo || !p.pessoaId) throw userError('Selecione a pessoa.');
  if (p.funcao && FUNCAO_COLABORADOR.indexOf(p.funcao) === -1) throw userError('Função inválida.');
}

function _colabRow(id, p, criadoEm, criadoPor) {
  return [id, p.acaoId, p.pessoaTipo, p.pessoaId, p.funcao || '',
    (p.chTotal === '' || p.chTotal == null) ? '' : (Number(p.chTotal) || 0), criadoEm, criadoPor];
}

function addColaborador(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(p.acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  _validaColaborador(p);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  getSheet('AcaoColaboradores').appendRow(_colabRow(id, p, nowBR(), email));
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateColaborador(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const idx = findRowIndex('AcaoColaboradores', id);
  if (idx === -1) throw userError('Colaborador não encontrado.');
  const sh = getSheet('AcaoColaboradores');
  const old = sh.getRange(idx, 1, 1, HEADERS.AcaoColaboradores.length).getValues()[0];
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(old[COL.AcaoColaboradores.AcaoID]));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  p.acaoId = old[COL.AcaoColaboradores.AcaoID];
  _validaColaborador(p);
  const row = _colabRow(id, p, old[COL.AcaoColaboradores.CriadoEm], old[COL.AcaoColaboradores.CriadoPor]);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteColaborador(id, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const c = sheetRows('AcaoColaboradores').find(x => String(x.ID) === String(id));
  if (!c) throw userError('Colaborador não encontrado.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(c.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  getSheet('AcaoColaboradores').deleteRow(findRowIndex('AcaoColaboradores', id));
  return { ok: true };
}
