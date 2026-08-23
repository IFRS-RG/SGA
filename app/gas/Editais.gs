// ============================================================
// SGA — Módulo Editais
// CRUD + clonar + upload de documentos PDF (verificados)
// ============================================================

const EDITAL_WRITERS = ['Admin', 'Gestor'];

function _num(v) {
  if (v === '' || v == null) return 0;
  return Number(v) || 0;
}
function _dateStr(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Sao_Paulo', 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// Monta a linha (ordem = HEADERS.Editais) a partir do payload do formulário.
function _editalRow(id, p, criadoEm, criadoPor) {
  const custeio = _num(p.custeio);
  const capital = _num(p.capital);
  return [
    id,
    p.numero || '',
    p.ano || '',
    p.titulo || '',
    p.resumo || '',
    p.segmento || '',
    p.origem || '',
    p.link || '',
    p.fomento || 'Não',
    p.agenciaFomento || '',
    JSON.stringify(p.tipoFomento || {}),
    custeio,
    capital,
    custeio + capital,
    p.bolsa || 'Não',
    p.agenciaBolsa || '',
    JSON.stringify(p.bolsas || []),
    p.dataPublicacao || '',
    JSON.stringify(p.cronograma || []),
    JSON.stringify(p.editaisPai || []),
    p.statusManual || '',
    criadoEm,
    criadoPor
  ];
}

// Status manual: Encerrado se marcado, senão Vigente.
function _computeStatus(e) {
  return e.StatusManual === 'Encerrado' ? 'Encerrado' : 'Vigente';
}

function _parseJson(v, fallback) {
  try { return JSON.parse(v || ''); } catch (e) { return fallback; }
}

// ── Listar ────────────────────────────────────────────────────
function getEditais() {
  const editais = sheetRows('Editais');
  const docs    = sheetRows('EditalDocumentos');
  return editais.map(e => {
    e.docsCount    = docs.filter(d => String(d.EditalID) === String(e.ID)).length;
    e.tipoFomento  = _parseJson(e.TipoFomentoJSON, {});
    e.bolsas       = _parseJson(e.BolsasJSON, []);
    e.cronograma   = _parseJson(e.CronogramaJSON, []);
    e.editaisPai   = _parseJson(e.EditaisPaiJSON, []);
    e.DataPublicacao = _dateStr(e.DataPublicacao);
    e.Status       = _computeStatus(e);   // Vigente / Encerrado (manual)
    return e;
  });
}

// Segmento único só pode ter 1 pai; vários → precisa ser Conjunto.
function _validateVinculo(p) {
  if (p.segmento !== 'Conjunto' && (p.editaisPai || []).length > 1) {
    throw new Error('Edital de segmento único pode ter apenas 1 edital pai. Para vincular a vários, use Segmento = Conjunto.');
  }
}

// Idempotência: se o mesmo reqId já foi processado há pouco, devolve o id anterior.
function _idempotentId(reqId) {
  if (!reqId) return null;
  return CacheService.getScriptCache().get('req_' + reqId) || null;
}
function _idempotentStore(reqId, id) {
  if (reqId) CacheService.getScriptCache().put('req_' + reqId, id, 120);   // 2 min
}

// ── Criar ─────────────────────────────────────────────────────
function addEdital(p, email, reqId) {
  requirePerfil(email, EDITAL_WRITERS);
  if (!p.numero || !p.titulo) throw new Error('Número e Título são obrigatórios.');
  _validateVinculo(p);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  getSheet('Editais').appendRow(_editalRow(id, p, nowBR(), email));
  _idempotentStore(reqId, id);
  _syncEditalPlacement(id, []);
  return { ok: true, id: id };
}

// ── Atualizar ─────────────────────────────────────────────────
function updateEdital(id, p, email) {
  requirePerfil(email, EDITAL_WRITERS);
  _validateVinculo(p);
  const idx = findRowIndex('Editais', id);
  if (idx === -1) throw new Error('Edital não encontrado.');
  const sh  = getSheet('Editais');
  const old = sh.getRange(idx, 1, 1, HEADERS.Editais.length).getValues()[0];
  const oldParents = _parseJson(old[COL.Editais.EditaisPaiJSON], []);
  // Preserva CriadoEm/CriadoPor originais.
  const row = _editalRow(id, p, old[COL.Editais.CriadoEm], old[COL.Editais.CriadoPor]);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  _syncEditalPlacement(id, oldParents);
  return { ok: true };
}

// ── Excluir ───────────────────────────────────────────────────
function deleteEdital(id, email) {
  requirePerfil(email, EDITAL_WRITERS);
  const idx = findRowIndex('Editais', id);
  if (idx === -1) throw new Error('Edital não encontrado.');
  const editais = sheetRows('Editais');
  const edital = editais.find(e => String(e.ID) === String(id));

  // Bloqueia se houver sub-editais vinculados a este.
  const filhos = editais.filter(e => _parseJson(e.EditaisPaiJSON, []).map(String).indexOf(String(id)) >= 0);
  if (filhos.length) {
    throw new Error('Este edital tem sub-edital(is) vinculado(s): ' + filhos.map(_editalLabel).join(', ') +
      '. Desvincule ou exclua o(s) filho(s) primeiro.');
  }

  if (edital) {
    _removeEditalPlacement(edital);   // remove atalhos nos pais (caso Conjunto)
    try { _editalHomeFolder(edital, edital.Ano).setTrashed(true); } catch (e) {}   // pasta → lixeira
  }
  getSheet('Editais').deleteRow(idx);
  // Fallback: manda os PDFs pra lixeira também (caso a pasta não tenha sido apagada) + limpa a aba.
  const docs = sheetRows('EditalDocumentos').filter(d => String(d.EditalID) === String(id));
  docs.forEach(d => { try { _deleteDocFile(d.DriveFileId); } catch (e) {} });
  _removeDocsRows(id);
  return { ok: true };
}

// ── Clonar / Copiar ───────────────────────────────────────────
// Cria um novo edital com os mesmos campos (Título prefixado "[Cópia]").
// Não copia os documentos PDF (o usuário reenvia se precisar).
function cloneEdital(id, email, reqId) {
  requirePerfil(email, EDITAL_WRITERS);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const orig = sheetRows('Editais').find(e => String(e.ID) === String(id));
  if (!orig) throw new Error('Edital não encontrado.');
  const p = {
    numero: orig.Numero, ano: orig.Ano, titulo: '[Cópia] ' + orig.Titulo,
    resumo: orig.Resumo, segmento: orig.Segmento, origem: orig.Origem,
    link: orig.LinkPublicacao,
    fomento: orig.Fomento, agenciaFomento: orig.AgenciaFomento,
    tipoFomento: _parseJson(orig.TipoFomentoJSON, {}),
    custeio: orig.Custeio, capital: orig.Capital,
    bolsa: orig.Bolsa, agenciaBolsa: orig.AgenciaBolsa,
    bolsas: _parseJson(orig.BolsasJSON, []),
    dataPublicacao: _dateStr(orig.DataPublicacao),
    cronograma: _parseJson(orig.CronogramaJSON, []),
    editaisPai: _parseJson(orig.EditaisPaiJSON, []), statusManual: orig.StatusManual || ''
  };
  const newId = genId();
  getSheet('Editais').appendRow(_editalRow(newId, p, nowBR(), email));
  _idempotentStore(reqId, newId);
  _syncEditalPlacement(newId, []);   // a cópia herda os vínculos → posiciona a pasta/atalhos
  return { ok: true, id: newId };
}

// ============================================================
// Documentos PDF
// ============================================================

// Acha ou cria uma subpasta pelo nome, dentro de `parent`.
function _childFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// Pasta raiz. Use DRIVE_ROOT_ID (recomendado — a pasta "SGA - ARQUIVOS" foi movida/renomeada).
// Fallback: cria/acha "SGA - ARQUIVOS" na raiz do My Drive.
function _editaisRootFolder() {
  if (DRIVE_ROOT_ID) return DriveApp.getFolderById(DRIVE_ROOT_ID);
  return _childFolder(DriveApp.getRootFolder(), 'SGA - ARQUIVOS');
}

// Estrutura: raiz / {Segmento} / {Ano} / {Edital}.
function _editalFolder(editalLabel, ano, segmento) {
  const root = _editaisRootFolder();
  const segFolder = _childFolder(root, String(segmento || 'Sem segmento'));
  const anoFolder = _childFolder(segFolder, String(ano || 'Sem ano'));
  return _childFolder(anoFolder, editalLabel);
}

function getEditalDocs(editalId) {
  return sheetRows('EditalDocumentos').filter(d => String(d.EditalID) === String(editalId));
}

// Garante a pasta REAL do edital (conforme o vínculo) e retorna a URL.
function getEditalFolderUrl(editalId) {
  const edital = sheetRows('Editais').find(e => String(e.ID) === String(editalId));
  if (!edital) throw new Error('Edital não encontrado.');
  return { url: _editalHomeFolder(edital, edital.Ano).getUrl() };
}

// ── Colocação da pasta do edital conforme o vínculo (pai/filho) ──────────
// Nome da pasta/rótulo do edital: "Edital {Segmento} {Origem} {Nº}/{Ano} - {Título}".
function _editalLabel(e) {
  const seg = e.Segmento ? String(e.Segmento).trim() + ' ' : '';
  const org = e.Origem ? String(e.Origem).trim() + ' ' : '';
  return ('Edital ' + seg + org + (e.Numero || '') + '/' + (e.Ano || '') + ' - ' + (e.Titulo || '')).trim();
}
function _parentHomeFolder(p) {
  return _editalFolder(_editalLabel(p), p.Ano, p.Segmento);
}

// Pasta REAL onde o edital mora, conforme o vínculo:
//   sem vínculo            → {segmento}/{ano}/{label}   (ano pode ser override do upload)
//   vinculado NÃO-conjunto → {pai}/Vinculado {label}    (1 pai)
//   vinculado CONJUNTO     → Conjunto/{ano do edital}/{label}
function _editalHomeFolder(edital, ano) {
  const parents = _parseJson(edital.EditaisPaiJSON, []).map(String);
  if (parents.length) {
    if (edital.Segmento !== 'Conjunto') {
      const p = sheetRows('Editais').find(e => String(e.ID) === parents[0]);
      if (p) return _childFolder(_parentHomeFolder(p), 'Vinculado ' + _editalLabel(edital));
    } else {
      return _editalFolder(_editalLabel(edital), edital.Ano, 'Conjunto');
    }
  }
  return _editalFolder(_editalLabel(edital), ano || edital.Ano, edital.Segmento);
}

function _findShortcuts(folderId, targetId) {
  try {
    const res = Drive.Files.list({
      q: "'" + folderId + "' in parents and mimeType='application/vnd.google-apps.shortcut' and trashed=false",
      maxResults: 200
    });
    return (res.items || []).filter(f => f.shortcutDetails && f.shortcutDetails.targetId === targetId);
  } catch (e) { return []; }
}

// Reorganiza a pasta do edital filho conforme o vínculo.
//   Caso A (não-conjunto): move a pasta REAL para dentro do pai (ou de volta se desvincular).
//   Caso B (conjunto):     mantém a pasta em Conjunto e cria/remove ATALHOS nos pais.
function _syncEditalPlacement(childId, oldParentIds) {
  try {
    const editais = sheetRows('Editais');
    const child = editais.find(e => String(e.ID) === String(childId));
    if (!child) return;
    const label = _editalLabel(child);
    const newParents = _parseJson(child.EditaisPaiJSON, []).map(String);
    oldParentIds = (oldParentIds || []).map(String);
    const byId = (pid) => editais.find(e => String(e.ID) === String(pid));

    // ── Caso A: filho de segmento único (1 pai) → pasta real dentro do pai ──
    if (child.Segmento !== 'Conjunto') {
      if (!newParents.length && !oldParentIds.length) return;
      const linkName = 'Vinculado ' + label;

      // Acha a pasta atual (dentro do pai antigo, ou solta em {seg}/{ano}).
      let current = null;
      const oldP = oldParentIds.length ? byId(oldParentIds[0]) : null;
      if (oldP) { const it = _parentHomeFolder(oldP).getFoldersByName(linkName); if (it.hasNext()) current = it.next(); }
      if (!current) {
        const anoF = _childFolder(_childFolder(_editaisRootFolder(), String(child.Segmento || 'Sem segmento')), String(child.Ano || 'Sem ano'));
        const it2 = anoF.getFoldersByName(label); if (it2.hasNext()) current = it2.next();
      }

      const newP = newParents.length ? byId(newParents[0]) : null;
      if (newP) {
        const dest = _parentHomeFolder(newP);
        if (current) { try { if (current.getName() !== linkName) current.setName(linkName); current.moveTo(dest); } catch (e) {} }
        else { _childFolder(dest, linkName); }
      } else if (current) {
        // Desvinculado → devolve para {segmento}/{ano}/{label} (sem prefixo).
        try {
          const anoF = _childFolder(_childFolder(_editaisRootFolder(), String(child.Segmento || 'Sem segmento')), String(child.Ano || 'Sem ano'));
          if (current.getName() !== label) current.setName(label);
          current.moveTo(anoF);
        } catch (e) {}
      }
      return;
    }

    // ── Caso B: Conjunto → pasta real em Conjunto + atalho em cada pai ──
    const childHomeId = _editalFolder(label, child.Ano, 'Conjunto').getId();
    const scName = 'Vinculado ' + label;
    newParents.forEach(pid => {
      try {
        const p = byId(pid); if (!p) return;
        const dest = _parentHomeFolder(p);
        if (!_findShortcuts(dest.getId(), childHomeId).length) {
          Drive.Files.insert({ title: scName, mimeType: 'application/vnd.google-apps.shortcut', parents: [{ id: dest.getId() }], shortcutDetails: { targetId: childHomeId } });
        }
      } catch (e) {}
    });
    oldParentIds.filter(pid => newParents.indexOf(pid) < 0).forEach(pid => {
      try {
        const p = byId(pid); if (!p) return;
        const dest = _parentHomeFolder(p);
        _findShortcuts(dest.getId(), childHomeId).forEach(sc => { try { Drive.Files.trash(sc.id); } catch (e) {} });
      } catch (e) {}
    });
  } catch (e) { /* Drive indisponível ou erro — não bloqueia o salvamento */ }
}

// Ao excluir: remove os atalhos do caso B (a pasta real do caso A some junto com o pai só se estiver dentro dele).
function _removeEditalPlacement(edital) {
  try {
    if (edital.Segmento !== 'Conjunto') return;
    const parents = _parseJson(edital.EditaisPaiJSON, []).map(String);
    if (!parents.length) return;
    const editais = sheetRows('Editais');
    const cid = _editalFolder(_editalLabel(edital), edital.Ano, 'Conjunto').getId();
    parents.forEach(pid => {
      try {
        const p = editais.find(e => String(e.ID) === String(pid)); if (!p) return;
        const dest = _parentHomeFolder(p);
        _findShortcuts(dest.getId(), cid).forEach(sc => { try { Drive.Files.trash(sc.id); } catch (e) {} });
      } catch (e) {}
    });
  } catch (e) {}
}

// Valida que o arquivo enviado é mesmo um PDF (magic bytes "%PDF").
function _isPdf(bytes) {
  return bytes.length >= 4 &&
         bytes[0] === 0x25 && bytes[1] === 0x50 &&  // %P
         bytes[2] === 0x44 && bytes[3] === 0x46;    // DF
}

// payload: { editalId, tipo, fileName, base64 }
function uploadEditalDoc(payload, email) {
  requirePerfil(email, EDITAL_WRITERS);
  if (!payload.editalId) throw new Error('Edital não informado.');
  if (TIPOS_DOC.indexOf(payload.tipo) === -1) throw new Error('Tipo de documento inválido.');

  const edital = sheetRows('Editais').find(e => String(e.ID) === String(payload.editalId));
  if (!edital) throw new Error('Edital não encontrado.');

  const bytes = Utilities.base64Decode(payload.base64);
  if (!_isPdf(bytes)) throw new Error('O arquivo enviado não é um PDF válido.');

  // Nome do documento: usa o nome informado; senão, o nome do arquivo enviado.
  let fileName = String(payload.nome || payload.fileName || 'documento').trim() || 'documento';
  if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';

  // Ano da pasta: escolhido no upload (pode diferir do ano do edital); default = ano do edital.
  const anoPasta = String(payload.ano || edital.Ano || '').trim() || 'Sem ano';
  const label  = (edital.Numero || '') + '-' + (edital.Ano || '') + ' ' + (edital.Titulo || '');
  // Pasta REAL conforme o vínculo (dentro do pai, em Conjunto, ou {segmento}/{ano}).
  const editalFolder = _editalHomeFolder(edital, anoPasta);
  _childFolder(editalFolder, 'Ações');                              // reservada p/ o módulo de Ações
  const folder = _childFolder(editalFolder, 'Documentos Edital');   // onde os PDFs ficam
  const blob   = Utilities.newBlob(bytes, 'application/pdf', fileName);
  const file   = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const id = genId();
  getSheet('EditalDocumentos').appendRow([
    id, payload.editalId, payload.tipo, fileName,
    file.getId(), file.getUrl(), nowBR(), email
  ]);
  _syncEditalPlacement(payload.editalId, []);   // garante atalhos nos pais (se vinculado)
  return { ok: true, id: id, url: file.getUrl() };
}

function deleteEditalDoc(docId, email) {
  requirePerfil(email, EDITAL_WRITERS);
  const doc = sheetRows('EditalDocumentos').find(d => String(d.ID) === String(docId));
  if (!doc) throw new Error('Documento não encontrado.');
  try { _deleteDocFile(doc.DriveFileId); } catch (e) {}
  const idx = findRowIndex('EditalDocumentos', docId);
  if (idx !== -1) getSheet('EditalDocumentos').deleteRow(idx);
  return { ok: true };
}

// Renomeia o documento (arquivo no Drive + registro na planilha).
function renameEditalDoc(docId, novoNome, email) {
  requirePerfil(email, EDITAL_WRITERS);
  const doc = sheetRows('EditalDocumentos').find(d => String(d.ID) === String(docId));
  if (!doc) throw new Error('Documento não encontrado.');
  let nome = String(novoNome || '').trim();
  if (!nome) throw new Error('O nome não pode ficar vazio.');
  if (!/\.pdf$/i.test(nome)) nome += '.pdf';
  try { if (doc.DriveFileId) DriveApp.getFileById(doc.DriveFileId).setName(nome); } catch (e) {}
  const idx = findRowIndex('EditalDocumentos', docId);
  if (idx !== -1) {
    getSheet('EditalDocumentos').getRange(idx, COL.EditalDocumentos.NomeArquivo + 1).setValue(nome);
  }
  return { ok: true, nome: nome };
}

function _deleteDocFile(fileId) {
  if (fileId) DriveApp.getFileById(fileId).setTrashed(true);
}

function _removeDocsRows(editalId) {
  const sh = getSheet('EditalDocumentos');
  const data = sh.getDataRange().getValues();
  // Remove de baixo para cima para não bagunçar os índices.
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][COL.EditalDocumentos.EditalID]) === String(editalId)) {
      sh.deleteRow(i + 1);
    }
  }
}
