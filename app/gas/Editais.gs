// ============================================================
// SGA — Módulo Editais
// CRUD + clonar + upload de documentos PDF (verificados)
// ============================================================

const EDITAL_WRITERS = ['Admin', 'Gestor'];
// Leitura: qualquer perfil cadastrado (inclui Visualizador). Bloqueia anônimo/sem-acesso.
const EDITAL_READERS = ['Admin', 'Gestor', 'Visualizador'];

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
function _editalRow(id, p, criadoEm, criadoPor, driveFolderId) {
  // recurso = { [segmento]: {agenciaFomento, tipoFomento, custeio, capital, agenciaBolsa, valorTotalBolsa} }
  const recurso = p.recurso || {};
  let cust = 0, cap = 0, vtb = 0;
  Object.keys(recurso).forEach(s => {
    const r = recurso[s] || {};
    cust += _num(r.custeio); cap += _num(r.capital); vtb += _num(r.valorTotalBolsa);
  });
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
    p.bolsa || 'Não',
    JSON.stringify(recurso),
    cust,                 // Custeio (soma)
    cap,                  // Capital (soma)
    cust + cap,           // Total (soma)
    vtb,                  // ValorTotalBolsa (soma)
    JSON.stringify(p.bolsas || []),
    p.dataPublicacao || '',
    JSON.stringify(p.cronograma || []),
    JSON.stringify(p.editaisPai || []),
    driveFolderId || '',
    p.anoPasta || '',
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
function getEditais(email) {
  requirePerfil(email, EDITAL_READERS);
  const editais = sheetRows('Editais');
  const docs    = sheetRows('EditalDocumentos');
  return editais.map(e => {
    e.docsCount    = docs.filter(d => String(d.EditalID) === String(e.ID)).length;
    e.recurso      = _parseJson(e.RecursoJSON, {});
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
    throw userError('Edital de segmento único pode ter apenas 1 edital pai. Para vincular a vários, use Segmento = Conjunto.');
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
  if (!p.numero || !p.titulo) throw userError('Número e Título são obrigatórios.');
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
  if (idx === -1) throw userError('Edital não encontrado.');
  const sh  = getSheet('Editais');
  const old = sh.getRange(idx, 1, 1, HEADERS.Editais.length).getValues()[0];
  const oldParents = _parseJson(old[COL.Editais.EditaisPaiJSON], []);
  // Preserva CriadoEm/CriadoPor e o ID da pasta do Drive (não recria a pasta ao editar).
  const row = _editalRow(id, p, old[COL.Editais.CriadoEm], old[COL.Editais.CriadoPor], old[COL.Editais.DriveFolderId]);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  _syncEditalPlacement(id, oldParents);
  return { ok: true };
}

// ── Excluir ───────────────────────────────────────────────────
function deleteEdital(id, email) {
  requirePerfil(email, EDITAL_WRITERS);
  const idx = findRowIndex('Editais', id);
  if (idx === -1) throw userError('Edital não encontrado.');
  const editais = sheetRows('Editais');
  const edital = editais.find(e => String(e.ID) === String(id));

  // Bloqueia se houver sub-editais vinculados a este.
  const filhos = editais.filter(e => _parseJson(e.EditaisPaiJSON, []).map(String).indexOf(String(id)) >= 0);
  if (filhos.length) {
    throw userError('Este edital tem sub-edital(is) vinculado(s): ' + filhos.map(_editalLabel).join(', ') +
      '. Desvincule ou exclua o(s) filho(s) primeiro.');
  }

  if (edital) {
    _removeEditalPlacement(edital);   // remove atalhos nos pais (caso Conjunto)
    if (edital.DriveFolderId) { try { DriveApp.getFolderById(edital.DriveFolderId).setTrashed(true); } catch (e) {} }  // pasta → lixeira
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
  if (!orig) throw userError('Edital não encontrado.');
  const p = {
    numero: orig.Numero, ano: orig.Ano, titulo: '[Cópia] ' + orig.Titulo,
    resumo: orig.Resumo, segmento: orig.Segmento, origem: orig.Origem,
    link: orig.LinkPublicacao,
    fomento: orig.Fomento, bolsa: orig.Bolsa,
    recurso: _parseJson(orig.RecursoJSON, {}),
    bolsas: _parseJson(orig.BolsasJSON, []),
    dataPublicacao: _dateStr(orig.DataPublicacao),
    cronograma: _parseJson(orig.CronogramaJSON, []),
    editaisPai: _parseJson(orig.EditaisPaiJSON, []),
    anoPasta: orig.AnoPasta || '', statusManual: orig.StatusManual || ''
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

function getEditalDocs(editalId, email) {
  requirePerfil(email, EDITAL_READERS);
  return sheetRows('EditalDocumentos').filter(d => String(d.EditalID) === String(editalId));
}

// Garante a pasta REAL do edital (conforme o vínculo) e retorna a URL.
function getEditalFolderUrl(editalId, email) {
  requirePerfil(email, EDITAL_READERS);
  const edital = sheetRows('Editais').find(e => String(e.ID) === String(editalId));
  if (!edital) throw userError('Edital não encontrado.');
  return { url: _ensureEditalFolder(edital).getUrl() };
}

// ── Colocação da pasta do edital conforme o vínculo (pai/filho) ──────────
// Nome da pasta/rótulo do edital: "Edital {Segmento} {Origem} {Nº}/{Ano} - {Título}".
function _editalLabel(e) {
  const seg = e.Segmento ? String(e.Segmento).trim() + ' ' : '';
  const org = e.Origem ? String(e.Origem).trim() + ' ' : '';
  return ('Edital ' + seg + org + (e.Numero || '') + '/' + (e.Ano || '') + ' - ' + (e.Titulo || '')).trim();
}
// Nome desejado da pasta ("Vinculado " quando é filho não-conjunto).
function _editalFolderName(edital) {
  const parents = _parseJson(edital.EditaisPaiJSON, []).map(String);
  const linked = parents.length && edital.Segmento !== 'Conjunto';
  return (linked ? 'Vinculado ' : '') + _editalLabel(edital);
}

// Pasta PAI onde a pasta do edital deve ficar (conforme vínculo/segmento/ano).
//   filho não-conjunto → dentro da pasta do pai
//   conjunto           → raiz/Conjunto/{ano}
//   sem vínculo        → raiz/{segmento}/{ano}
function _editalParentFolder(edital) {
  const parents = _parseJson(edital.EditaisPaiJSON, []).map(String);
  if (parents.length && edital.Segmento !== 'Conjunto') {
    const p = sheetRows('Editais').find(e => String(e.ID) === parents[0]);
    if (p) return _ensureEditalFolder(p);
  }
  const seg = edital.Segmento === 'Conjunto' ? 'Conjunto' : (edital.Segmento || 'Sem segmento');
  const ano = String(edital.AnoPasta || edital.Ano || 'Sem ano').trim() || 'Sem ano';
  return _childFolder(_childFolder(_editaisRootFolder(), String(seg)), ano);
}

function _storeEditalFolderId(editalId, folderId) {
  try {
    const idx = findRowIndex('Editais', editalId);
    if (idx !== -1) getSheet('Editais').getRange(idx, COL.Editais.DriveFolderId + 1).setValue(folderId);
  } catch (e) {}
}

// Garante a pasta REAL do edital, rastreada por DriveFolderId.
// Se já existe, RENOMEIA/MOVE a mesma pasta (não cria outra ao editar). Senão, cria e guarda o id.
function _ensureEditalFolder(edital) {
  const desiredName = _editalFolderName(edital);
  const parent = _editalParentFolder(edital);
  if (edital.DriveFolderId) {
    try {
      const f = DriveApp.getFolderById(edital.DriveFolderId);
      if (!f.isTrashed()) {
        if (f.getName() !== desiredName) f.setName(desiredName);
        const it = f.getParents();
        const curP = it.hasNext() ? it.next() : null;
        if (!curP || curP.getId() !== parent.getId()) f.moveTo(parent);
        return f;
      }
    } catch (e) {}
  }
  const nf = _childFolder(parent, desiredName);
  _storeEditalFolderId(edital.ID, nf.getId());
  edital.DriveFolderId = nf.getId();
  return nf;
}

// Todos os atalhos (shortcuts) dentro de uma pasta.
function _listShortcuts(folderId) {
  try {
    const res = Drive.Files.list({
      q: "'" + folderId + "' in parents and mimeType='application/vnd.google-apps.shortcut' and trashed=false",
      maxResults: 200
    });
    return res.items || [];
  } catch (e) { return []; }
}

function _findShortcuts(folderId, targetId) {
  return _listShortcuts(folderId).filter(f => f.shortcutDetails && f.shortcutDetails.targetId === targetId);
}

// Garante EXATAMENTE um atalho (scName → targetId) dentro de destId, removendo duplicados/obsoletos.
// Considera "nosso" o atalho com o mesmo nome OU que aponte para o alvo atual; mantém 1 correto e apaga o resto.
function _ensureSingleShortcut(destId, scName, targetId) {
  const ours = _listShortcuts(destId).filter(f =>
    f.title === scName || (f.shortcutDetails && f.shortcutDetails.targetId === targetId));
  let kept = null;
  ours.forEach(sc => {
    const okTarget = sc.shortcutDetails && sc.shortcutDetails.targetId === targetId;
    if (okTarget && !kept) {
      kept = sc;
      if (sc.title !== scName) { try { Drive.Files.patch({ title: scName }, sc.id); } catch (e) {} }
    } else {
      try { Drive.Files.trash(sc.id); } catch (e) {}   // duplicado ou aponta pra alvo antigo
    }
  });
  if (!kept) {
    Drive.Files.insert({ title: scName, mimeType: 'application/vnd.google-apps.shortcut',
      parents: [{ id: destId }], shortcutDetails: { targetId: targetId } });
  }
}

// Manutenção: reprocessa os atalhos de todos os editais Conjunto, apagando duplicados.
// Rode UMA vez pelo editor do Apps Script após o deploy para limpar atalhos antigos repetidos.
function fixEditalShortcuts() {
  const editais = sheetRows('Editais');
  let n = 0;
  editais.forEach(e => {
    if (e.Segmento !== 'Conjunto') return;
    const parents = _parseJson(e.EditaisPaiJSON, []).map(String);
    if (!parents.length) return;
    _syncEditalPlacement(e.ID, parents);   // dedup embutido em _ensureSingleShortcut
    n++;
  });
  return 'Reprocessados ' + n + ' edital(is) Conjunto.';
}

// Reorganiza a pasta do edital conforme o vínculo (pasta rastreada por DriveFolderId).
//   Não-conjunto: só reposiciona a pasta existente (renomeia/move); nada se ainda não há pasta.
//   Conjunto:     garante a pasta em Conjunto e cria/remove ATALHOS nos pais.
function _syncEditalPlacement(childId, oldParentIds) {
  try {
    const editais = sheetRows('Editais');
    const child = editais.find(e => String(e.ID) === String(childId));
    if (!child) return;
    const newParents = _parseJson(child.EditaisPaiJSON, []).map(String);
    oldParentIds = (oldParentIds || []).map(String);
    const byId = (pid) => editais.find(e => String(e.ID) === String(pid));

    // Não-conjunto: reposiciona a pasta existente (rename/move). Sem pasta ainda → nada (criada no upload).
    if (child.Segmento !== 'Conjunto') {
      if (child.DriveFolderId) { try { _ensureEditalFolder(child); } catch (e) {} }
      return;
    }

    // Conjunto: pasta real em Conjunto + atalho em cada pai.
    const childHomeId = _ensureEditalFolder(child).getId();
    const scName = 'Vinculado ' + _editalLabel(child);
    newParents.forEach(pid => {
      try {
        const p = byId(pid); if (!p) return;
        const dest = _ensureEditalFolder(p);
        _ensureSingleShortcut(dest.getId(), scName, childHomeId);   // 1 atalho só (apaga duplicados)
      } catch (e) {}
    });
    oldParentIds.filter(pid => newParents.indexOf(pid) < 0).forEach(pid => {
      try {
        const p = byId(pid); if (!p) return;
        if (!p.DriveFolderId) return;
        _findShortcuts(p.DriveFolderId, childHomeId).forEach(sc => { try { Drive.Files.trash(sc.id); } catch (e) {} });
      } catch (e) {}
    });
  } catch (e) { /* Drive indisponível ou erro — não bloqueia o salvamento */ }
}

// Ao excluir: remove os atalhos do caso Conjunto nos pais.
function _removeEditalPlacement(edital) {
  try {
    if (edital.Segmento !== 'Conjunto' || !edital.DriveFolderId) return;
    const parents = _parseJson(edital.EditaisPaiJSON, []).map(String);
    if (!parents.length) return;
    const editais = sheetRows('Editais');
    parents.forEach(pid => {
      try {
        const p = editais.find(e => String(e.ID) === String(pid)); if (!p || !p.DriveFolderId) return;
        _findShortcuts(p.DriveFolderId, edital.DriveFolderId).forEach(sc => { try { Drive.Files.trash(sc.id); } catch (e) {} });
      } catch (e) {}
    });
  } catch (e) {}
}

// ============================================================
// Acesso aos arquivos (SEC-002)
// Os PDFs de edital NÃO são públicos por link. O acesso de leitura é concedido
// na PASTA RAIZ do Drive aos e-mails com perfil Ativo (aba Perfis); os arquivos
// dentro dela herdam essa permissão. Ao (des)cadastrar um perfil, o Admin.gs
// chama grant/revoke; reconcileEditalAccess() ressincroniza tudo (e migra).
// ============================================================

// E-mails que devem ter leitura dos arquivos: perfis Ativos + super admin.
function _editalAccessEmails() {
  const set = {};
  set[SUPER_ADMIN] = true;
  sheetRows('Perfis').forEach(p => {
    if (String(p.Status) === 'Ativo') {
      const em = String(p.Email || '').toLowerCase().trim();
      if (em) set[em] = true;
    }
  });
  return Object.keys(set);
}

function _rootOwnerEmail(root) {
  try { const o = root.getOwner(); return o ? String(o.getEmail()).toLowerCase() : ''; }
  catch (e) { return ''; }
}

// Concede leitura a um e-mail na pasta raiz (os arquivos herdam). Não bloqueia
// a operação chamadora em caso de erro do Drive.
function grantEditalAccess(email) {
  const em = String(email || '').toLowerCase().trim();
  if (!em) return;
  try { _editaisRootFolder().addViewer(em); } catch (e) {}
}

// Revoga o acesso de um e-mail (nunca remove o dono da pasta nem o super admin).
function revokeEditalAccess(email) {
  const em = String(email || '').toLowerCase().trim();
  if (!em || em === SUPER_ADMIN) return;
  try {
    const root = _editaisRootFolder();
    if (em === _rootOwnerEmail(root)) return;
    root.removeViewer(em);
    try { root.removeEditor(em); } catch (e) {}
  } catch (e) {}
}

// Sincroniza o compartilhamento da pasta raiz com a lista de perfis Ativos.
// Idempotente. Serve também de MIGRAÇÃO do compartilhamento — rode no editor.
function reconcileEditalAccess() {
  const root  = _editaisRootFolder();
  const owner = _rootOwnerEmail(root);
  const want  = _editalAccessEmails();
  const wantSet = {};
  want.forEach(e => { wantSet[e] = true; });

  // Concede aos que faltam.
  want.forEach(em => { if (em !== owner) { try { root.addViewer(em); } catch (e) {} } });

  // Revoga quem não está mais na lista (preserva dono e super admin).
  const purge = (users, remover) => users.forEach(u => {
    const em = String(u.getEmail()).toLowerCase();
    if (em && em !== owner && em !== SUPER_ADMIN && !wantSet[em]) { try { remover(em); } catch (e) {} }
  });
  try { purge(root.getViewers(), em => root.removeViewer(em)); } catch (e) {}
  try { purge(root.getEditors(), em => root.removeEditor(em)); } catch (e) {}
  return { ok: true, autorizados: want.length };
}

// MIGRAÇÃO one-shot: torna PRIVADOS os PDFs já enviados (remove ANYONE_WITH_LINK)
// e reconcilia o acesso da pasta raiz. Rode UMA vez no editor do Apps Script
// depois do deploy, para fechar os links públicos antigos.
function migrateEditalDocsPrivados() {
  let n = 0;
  sheetRows('EditalDocumentos').forEach(d => {
    if (!d.DriveFileId) return;
    try {
      DriveApp.getFileById(d.DriveFileId).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      n++;
    } catch (e) {}
  });
  const r = reconcileEditalAccess();
  return 'Privados: ' + n + ' arquivo(s). Autorizados na raiz: ' + r.autorizados + '.';
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
  if (!payload.editalId) throw userError('Edital não informado.');
  if (TIPOS_DOC.indexOf(payload.tipo) === -1) throw userError('Tipo de documento inválido.');

  const edital = sheetRows('Editais').find(e => String(e.ID) === String(payload.editalId));
  if (!edital) throw userError('Edital não encontrado.');

  const bytes = Utilities.base64Decode(payload.base64);
  if (!_isPdf(bytes)) throw userError('O arquivo enviado não é um PDF válido.');

  // Nome do documento: usa o nome informado; senão, o nome do arquivo enviado.
  let fileName = String(payload.nome || payload.fileName || 'documento').trim() || 'documento';
  if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';

  // Pasta REAL do edital (rastreada por DriveFolderId; renomeia/move sozinha ao editar).
  const editalFolder = _ensureEditalFolder(edital);
  _childFolder(editalFolder, 'Ações');                              // reservada p/ o módulo de Ações
  const folder = _childFolder(editalFolder, 'Documentos Edital');   // onde os PDFs ficam
  const blob   = Utilities.newBlob(bytes, 'application/pdf', fileName);
  const file   = folder.createFile(blob);
  // SEC-002: o arquivo NÃO é público. Herda o compartilhamento da pasta raiz,
  // concedido aos e-mails com perfil Ativo (ver reconcileEditalAccess / Admin.gs).

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
  if (!doc) throw userError('Documento não encontrado.');
  try { _deleteDocFile(doc.DriveFileId); } catch (e) {}
  const idx = findRowIndex('EditalDocumentos', docId);
  if (idx !== -1) getSheet('EditalDocumentos').deleteRow(idx);
  return { ok: true };
}

// Renomeia o documento (arquivo no Drive + registro na planilha).
function renameEditalDoc(docId, novoNome, email) {
  requirePerfil(email, EDITAL_WRITERS);
  const doc = sheetRows('EditalDocumentos').find(d => String(d.ID) === String(docId));
  if (!doc) throw userError('Documento não encontrado.');
  let nome = String(novoNome || '').trim();
  if (!nome) throw userError('O nome não pode ficar vazio.');
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
