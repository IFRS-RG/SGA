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

function _acaoRow(id, p, criadoEm, criadoPor, driveFolderId, logoFileId, logoUrl) {
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
    criadoEm, criadoPor,
    String(p.resumo || '').trim(),
    logoFileId || '',
    logoUrl || ''
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
    status: a.Status,
    resumo: a.Resumo || '', logoUrl: a.LogoUrl || '', logoFileId: a.LogoFileId || ''
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
  getSheet('Acoes').appendRow(_acaoRow(id, p, nowBR(), email, folderId, '', ''));
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
  const row = _acaoRow(id, p, old[COL.Acoes.CriadoEm], old[COL.Acoes.CriadoPor], folderId,
    old[COL.Acoes.LogoFileId], old[COL.Acoes.LogoUrl]);
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
  // Remove também os registros de documentos desta ação (arquivos já vão junto com a pasta).
  const sh = getSheet('AcaoDocumentos');
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][COL.AcaoDocumentos.AcaoID]) === String(id)) sh.deleteRow(i + 1);
  }
  getSheet('Acoes').deleteRow(idx);
  return { ok: true };
}

// ============================================================
// FATIA B — Documentos da ação (abas Documentos + Financeiro)
// ============================================================

// Garante a pasta real da ação (rastreada por DriveFolderId).
function _acaoFolder(acao) {
  if (acao.DriveFolderId) {
    try { const f = DriveApp.getFolderById(acao.DriveFolderId); if (!f.isTrashed()) return f; } catch (e) {}
  }
  const fid = _criarPastaAcao(acao.EditalID, acao.Titulo);
  if (!fid) throw userError('Pasta da ação indisponível. Vincule um edital à ação primeiro.');
  const idx = findRowIndex('Acoes', acao.ID);
  if (idx !== -1) getSheet('Acoes').getRange(idx, COL.Acoes.DriveFolderId + 1).setValue(fid);
  return DriveApp.getFolderById(fid);
}

// Subpasta conforme o tipo: Financeiro (aberto) vai em "Financeiro", o resto em "Documentos".
function _acaoSubfolder(acao, tipo) {
  const base = _acaoFolder(acao);
  const isFin = TIPOS_FIN_ACAO.indexOf(tipo) >= 0;
  return _childFolder(base, isFin ? 'Financeiro' : 'Documentos');
}

function getAcaoDocs(acaoId, email) {
  requirePerfil(email, ACAO_READERS);
  return sheetRows('AcaoDocumentos').filter(d => String(d.AcaoID) === String(acaoId));
}

// payload: { acaoId, tipo, fileName, nome, base64 }
function uploadAcaoDoc(payload, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(payload.acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  if (TIPOS_DOC_ACAO.concat(TIPOS_FIN_ACAO).indexOf(payload.tipo) === -1) throw userError('Tipo de documento inválido.');

  const bytes = Utilities.base64Decode(payload.base64);
  if (!_isPdf(bytes)) throw userError('O arquivo enviado não é um PDF válido.');

  let fileName = String(payload.nome || payload.fileName || 'documento').trim() || 'documento';
  if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';

  const folder = _acaoSubfolder(acao, payload.tipo);
  const file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', fileName));
  // Privado: herda o compartilhamento da pasta (sem ANYONE_WITH_LINK).

  const id = genId();
  getSheet('AcaoDocumentos').appendRow([id, payload.acaoId, payload.tipo, fileName, file.getId(), file.getUrl(), nowBR(), email]);
  return { ok: true, id: id, url: file.getUrl() };
}

function deleteAcaoDoc(docId, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const doc = sheetRows('AcaoDocumentos').find(d => String(d.ID) === String(docId));
  if (!doc) throw userError('Documento não encontrado.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(doc.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  try { if (doc.DriveFileId) DriveApp.getFileById(doc.DriveFileId).setTrashed(true); } catch (e) {}
  const idx = findRowIndex('AcaoDocumentos', docId);
  if (idx !== -1) getSheet('AcaoDocumentos').deleteRow(idx);
  return { ok: true };
}

function renameAcaoDoc(docId, novoNome, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const doc = sheetRows('AcaoDocumentos').find(d => String(d.ID) === String(docId));
  if (!doc) throw userError('Documento não encontrado.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(doc.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  let nome = String(novoNome || '').trim();
  if (!nome) throw userError('O nome não pode ficar vazio.');
  if (!/\.pdf$/i.test(nome)) nome += '.pdf';
  try { if (doc.DriveFileId) DriveApp.getFileById(doc.DriveFileId).setName(nome); } catch (e) {}
  const idx = findRowIndex('AcaoDocumentos', docId);
  if (idx !== -1) getSheet('AcaoDocumentos').getRange(idx, COL.AcaoDocumentos.NomeArquivo + 1).setValue(nome);
  return { ok: true, nome: nome };
}

// ── Imagem/logo do projeto (aba Dados) ──────────────────────
// Só imagem (PNG/JPEG) por magic bytes.
function _isImage(bytes) {
  if (!bytes || bytes.length < 4) return false;
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;                      // JPEG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true; // PNG
  return false;
}

// payload: { fileName, base64 } para enviar/trocar, ou { remove: true } para excluir.
function uploadAcaoLogo(id, payload, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(id));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  const idx = findRowIndex('Acoes', id);
  if (idx === -1) throw userError('Ação não encontrada.');
  const sh = getSheet('Acoes');

  // Remove a imagem anterior (se houver), tanto para trocar quanto para excluir.
  if (acao.LogoFileId) { try { DriveApp.getFileById(acao.LogoFileId).setTrashed(true); } catch (e) {} }

  if (payload && payload.remove) {
    sh.getRange(idx, COL.Acoes.LogoFileId + 1, 1, 2).setValues([['', '']]);
    return { ok: true, removed: true };
  }

  const bytes = Utilities.base64Decode(payload.base64);
  if (!_isImage(bytes)) throw userError('Envie uma imagem PNG ou JPG válida.');
  const isPng = bytes[0] === 0x89;
  const mime = isPng ? 'image/png' : 'image/jpeg';
  const fileName = 'logo' + (isPng ? '.png' : '.jpg');

  const folder = _acaoFolder(acao);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, fileName));
  // Logo não é dado sensível; precisa ser público p/ renderizar em <img>.
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
  sh.getRange(idx, COL.Acoes.LogoFileId + 1, 1, 2).setValues([[file.getId(), url]]);
  return { ok: true, url: url };
}
