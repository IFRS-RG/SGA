// ============================================================
// SGA — Módulo Ações
// FATIA A: aba Dados + pasta no Drive dentro de {Edital}/Ações/{Título}.
// Documentos, Bolsistas, Voluntários e Financeiro vêm nas fatias B/C/D.
// ============================================================

const ACAO_READERS = ['Admin', 'Gestor', 'Visualizador', 'Financeiro'];
const ACAO_WRITERS = ['Admin', 'Gestor'];

// Gestor só gere o próprio segmento; Admin (segmento 'Todos') gere qualquer um.
function _assertSegmentoAcao(info, segmento) {
  if (info.role === 'Admin' || info.segmento === 'Todos') return;
  if (segmento && String(segmento) !== String(info.segmento)) {
    throw userError('Você (Gestor de ' + info.segmento + ') só pode gerir ações do seu segmento.');
  }
}

function _acaoColabs(v) {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}

function _acaoRow(id, p, criadoEm, criadoPor, driveFolderId) {
  return [
    id,
    String(p.titulo || '').trim(),
    p.tipoAcao || '',
    String(p.modalidade || '').trim(),
    String(p.anoExecucao || '').trim(),
    p.segmento || '',
    p.editalId || '',
    p.coordenadorId || '',
    p.coorientadorId || '',
    JSON.stringify(Array.isArray(p.colaboradores) ? p.colaboradores : []),
    _dateStr(p.dataInicio),
    _dateStr(p.dataFim),
    p.status || 'Ativa',
    driveFolderId || '',
    criadoEm, criadoPor
  ];
}

// ── Listar (enriquecido com rótulos) ──────────────────────────
function getAcoes(email) {
  requirePerfil(email, ACAO_READERS);
  const editais = sheetRows('Editais');
  const servidores = sheetRows('Servidores');
  return sheetRows('Acoes').map(a => {
    const ed = editais.find(e => String(e.ID) === String(a.EditalID));
    const coord = servidores.find(s => String(s.ID) === String(a.CoordenadorID));
    return {
      ID: a.ID, Titulo: a.Titulo, TipoAcao: a.TipoAcao, Modalidade: a.Modalidade,
      AnoExecucao: a.AnoExecucao, Segmento: a.Segmento, Status: a.Status,
      EditalID: a.EditalID,
      DataInicio: _dateStr(a.DataInicio), DataFim: _dateStr(a.DataFim),
      editalLabel: ed ? _editalLabel(ed) : '',
      coordenadorNome: coord ? _nomeExib(coord) : ''
    };
  });
}

// Registro completo para o formulário de edição.
function getAcao(id, email) {
  requirePerfil(email, ACAO_READERS);
  const a = sheetRows('Acoes').find(x => String(x.ID) === String(id));
  if (!a) throw userError('Ação não encontrada.');
  return {
    ID: a.ID, titulo: a.Titulo, tipoAcao: a.TipoAcao, modalidade: a.Modalidade,
    anoExecucao: a.AnoExecucao, segmento: a.Segmento, editalId: a.EditalID,
    coordenadorId: a.CoordenadorID, coorientadorId: a.CoorientadorID,
    colaboradores: _acaoColabs(a.ColaboradoresJSON),
    dataInicio: _dateStr(a.DataInicio), dataFim: _dateStr(a.DataFim),
    status: a.Status
  };
}

function _validaAcao(p) {
  if (!String(p.titulo || '').trim()) throw userError('Título é obrigatório.');
  if (p.tipoAcao && TIPO_ACAO.indexOf(p.tipoAcao) === -1) throw userError('Tipo de ação inválido.');
  if (p.status && STATUS_ACAO.indexOf(p.status) === -1) throw userError('Status inválido.');
  if (p.dataInicio && p.dataFim && _dateStr(p.dataFim) < _dateStr(p.dataInicio)) {
    throw userError('A data de fim não pode ser anterior à de início.');
  }
}

// Cria/acha a pasta da ação em {Edital}/Ações/{Título}.
function _criarPastaAcao(editalId, titulo) {
  try {
    const edital = sheetRows('Editais').find(e => String(e.ID) === String(editalId));
    if (!edital) return '';
    const editalFolder = _ensureEditalFolder(edital);
    const acoesFolder  = _childFolder(editalFolder, 'Ações');
    return _childFolder(acoesFolder, String(titulo || 'Ação').trim() || 'Ação').getId();
  } catch (e) { return ''; }
}

function addAcao(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  _validaAcao(p);
  _assertSegmentoAcao(info, p.segmento);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  const folderId = _criarPastaAcao(p.editalId, p.titulo);
  getSheet('Acoes').appendRow(_acaoRow(id, p, nowBR(), email, folderId));
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateAcao(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  _validaAcao(p);
  _assertSegmentoAcao(info, p.segmento);
  const idx = findRowIndex('Acoes', id);
  if (idx === -1) throw userError('Ação não encontrada.');
  const sh = getSheet('Acoes');
  const old = sh.getRange(idx, 1, 1, HEADERS.Acoes.length).getValues()[0];
  let folderId = old[COL.Acoes.DriveFolderId];
  if (!folderId && p.editalId) folderId = _criarPastaAcao(p.editalId, p.titulo);
  const row = _acaoRow(id, p, old[COL.Acoes.CriadoEm], old[COL.Acoes.CriadoPor], folderId);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteAcao(id, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const a = sheetRows('Acoes').find(x => String(x.ID) === String(id));
  if (!a) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, a.Segmento);
  const idx = findRowIndex('Acoes', id);
  if (a.DriveFolderId) { try { DriveApp.getFolderById(a.DriveFolderId).setTrashed(true); } catch (e) {} }
  getSheet('Acoes').deleteRow(idx);
  return { ok: true };
}
