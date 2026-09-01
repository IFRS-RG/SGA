// ============================================================
// SGA — Comissões (CGAE/CAGPPI/CAGE/CIEP)
// Cada cadastro = portaria (PDF) + período + membros + câmaras.
// Câmaras referenciam membros do próprio cadastro (por id).
// Escrita: Admin/Gestor. Leitura: Admin/Gestor/Visualizador/Financeiro.
// ============================================================

function _comFolder(tipo) {
  return _childFolder(_childFolder(_editaisRootFolder(), 'Comissões'), String(tipo || 'Comissão'));
}

function _comMembros(list) {
  return (Array.isArray(list) ? list : []).map(m => ({
    id: String(m.id || '').trim() || genId(),
    nome: String(m.nome || '').trim(),
    doc: String(m.doc || '').trim(),
    email: String(m.email || '').trim(),
    categoria: CATEGORIA_MEMBRO.indexOf(m.categoria) !== -1 ? m.categoria : 'Docente'
  })).filter(m => m.nome);
}

function _comCamaras(list) {
  return (Array.isArray(list) ? list : []).map(c => ({
    id: String(c.id || '').trim() || genId(),
    nome: String(c.nome || '').trim(),
    membros: (Array.isArray(c.membros) ? c.membros : []).map(String)
  })).filter(c => c.nome);
}

function _comOut(c) {
  let membros = [], camaras = [];
  try { membros = JSON.parse(c.MembrosJSON || '[]'); } catch (e) {}
  try { camaras = JSON.parse(c.CamarasJSON || '[]'); } catch (e) {}
  return {
    ID: c.ID, Tipo: c.Tipo, PortariaUrl: c.PortariaUrl, DataInicio: _dateStr(c.DataInicio),
    DataFim: _dateStr(c.DataFim), membros: membros, camaras: camaras
  };
}

function getComissoes(email) {
  requirePerfil(email, ACAO_READERS);
  return sheetRows('Comissoes').map(_comOut);
}

function _validaComissao(p) {
  if (COMISSAO_TIPOS.indexOf(p.tipo) === -1) throw userError('Comissão inválida.');
  if (p.dataInicio && p.dataFim && _dateStr(p.dataFim) < _dateStr(p.dataInicio)) {
    throw userError('A data de fim da portaria não pode ser anterior à de início.');
  }
}

// Salva a portaria (PDF) na pasta da comissão; retorna {fileId, url} ou mantém os antigos.
function _comPortaria(p, tipo, oldFileId, oldUrl) {
  if (p.portariaRemove) {
    if (oldFileId) { try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {} }
    return { fileId: '', url: '' };
  }
  if (!p.portariaBase64) return { fileId: oldFileId || '', url: oldUrl || '' };
  const bytes = Utilities.base64Decode(p.portariaBase64);
  if (!_isPdf(bytes)) throw userError('A portaria deve ser um PDF válido.');
  if (oldFileId) { try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {} }
  let nome = String(p.portariaFileName || ('Portaria ' + tipo)).trim() || 'Portaria';
  if (!/\.pdf$/i.test(nome)) nome += '.pdf';
  const file = _comFolder(tipo).createFile(Utilities.newBlob(bytes, 'application/pdf', nome));
  return { fileId: file.getId(), url: file.getUrl() };
}

function addComissao(p, email, reqId) {
  requirePerfil(email, ACAO_WRITERS);
  _validaComissao(p);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const port = _comPortaria(p, p.tipo, '', '');
  const id = genId();
  getSheet('Comissoes').appendRow([
    id, p.tipo, port.fileId, port.url, _dateStr(p.dataInicio), _dateStr(p.dataFim),
    JSON.stringify(_comMembros(p.membros)), JSON.stringify(_comCamaras(p.camaras)), nowBR(), email
  ]);
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateComissao(id, p, email) {
  requirePerfil(email, ACAO_WRITERS);
  const idx = findRowIndex('Comissoes', id);
  if (idx === -1) throw userError('Comissão não encontrada.');
  const sh = getSheet('Comissoes');
  const old = sh.getRange(idx, 1, 1, HEADERS.Comissoes.length).getValues()[0];
  p.tipo = old[COL.Comissoes.Tipo];
  _validaComissao(p);
  const port = _comPortaria(p, p.tipo, old[COL.Comissoes.PortariaFileId], old[COL.Comissoes.PortariaUrl]);
  // Câmaras: se não vierem no payload, preserva as existentes.
  const camaras = p.camaras !== undefined ? _comCamaras(p.camaras)
    : (function () { try { return JSON.parse(old[COL.Comissoes.CamarasJSON] || '[]'); } catch (e) { return []; } })();
  const membros = p.membros !== undefined ? _comMembros(p.membros)
    : (function () { try { return JSON.parse(old[COL.Comissoes.MembrosJSON] || '[]'); } catch (e) { return []; } })();
  const row = [id, p.tipo, port.fileId, port.url, _dateStr(p.dataInicio), _dateStr(p.dataFim),
    JSON.stringify(membros), JSON.stringify(camaras),
    old[COL.Comissoes.CriadoEm], old[COL.Comissoes.CriadoPor]];
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function setComissaoCamaras(id, camaras, email) {
  return updateComissao(id, { camaras: camaras }, email);
}

function deleteComissao(id, email) {
  requirePerfil(email, ACAO_WRITERS);
  const c = sheetRows('Comissoes').find(x => String(x.ID) === String(id));
  if (!c) throw userError('Comissão não encontrada.');
  if (c.PortariaFileId) { try { DriveApp.getFileById(c.PortariaFileId).setTrashed(true); } catch (e) {} }
  getSheet('Comissoes').deleteRow(findRowIndex('Comissoes', id));
  return { ok: true };
}
