// ============================================================
// SGA — Módulo Editais
// CRUD + clonar + upload de documentos PDF (verificados)
// ============================================================

const EDITAL_WRITERS = ['Admin', 'Gestor'];

// Monta o objeto de linha a partir do payload do formulário.
function _editalRow(id, p, criadoEm, criadoPor) {
  return [
    id,
    p.numero || '',
    p.ano || '',
    p.titulo || '',
    p.fomento || 'Não',
    p.tipoInterno || 'Interno',
    p.segmento || '',
    p.bolsas || 'Não',
    p.custeioCapital || 'Não',
    p.dataPublicacao || '',
    p.inscricoesInicio || '',
    p.inscricoesFim || '',
    p.dataResultado || '',
    p.agenciaFomento || '',
    p.link || '',
    p.status || 'Ativo',
    criadoEm,
    criadoPor
  ];
}

// ── Listar ────────────────────────────────────────────────────
function getEditais() {
  const editais = sheetRows('Editais');
  const docs    = sheetRows('EditalDocumentos');
  // Anexa a contagem de documentos por edital.
  return editais.map(e => {
    e.docsCount = docs.filter(d => String(d.EditalID) === String(e.ID)).length;
    return e;
  });
}

// ── Criar ─────────────────────────────────────────────────────
function addEdital(p, email) {
  requirePerfil(email, EDITAL_WRITERS);
  if (!p.numero || !p.titulo) throw new Error('Número e Título são obrigatórios.');
  const id = genId();
  getSheet('Editais').appendRow(_editalRow(id, p, nowBR(), email));
  return { ok: true, id: id };
}

// ── Atualizar ─────────────────────────────────────────────────
function updateEdital(id, p, email) {
  requirePerfil(email, EDITAL_WRITERS);
  const idx = findRowIndex('Editais', id);
  if (idx === -1) throw new Error('Edital não encontrado.');
  const sh  = getSheet('Editais');
  const old = sh.getRange(idx, 1, 1, HEADERS.Editais.length).getValues()[0];
  // Preserva CriadoEm/CriadoPor originais.
  const row = _editalRow(id, p, old[COL.Editais.CriadoEm], old[COL.Editais.CriadoPor]);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

// ── Excluir ───────────────────────────────────────────────────
function deleteEdital(id, email) {
  requirePerfil(email, EDITAL_WRITERS);
  const idx = findRowIndex('Editais', id);
  if (idx === -1) throw new Error('Edital não encontrado.');
  getSheet('Editais').deleteRow(idx);
  // Remove também os documentos vinculados (linhas da aba + arquivos do Drive).
  const docs = sheetRows('EditalDocumentos').filter(d => String(d.EditalID) === String(id));
  docs.forEach(d => { try { _deleteDocFile(d.DriveFileId); } catch (e) {} });
  _removeDocsRows(id);
  return { ok: true };
}

// ── Clonar / Copiar ───────────────────────────────────────────
// Cria um novo edital com os mesmos campos (Título prefixado "[Cópia]").
// Não copia os documentos PDF (o usuário reenvia se precisar).
function cloneEdital(id, email) {
  requirePerfil(email, EDITAL_WRITERS);
  const orig = sheetRows('Editais').find(e => String(e.ID) === String(id));
  if (!orig) throw new Error('Edital não encontrado.');
  const p = {
    numero: orig.Numero, ano: orig.Ano, titulo: '[Cópia] ' + orig.Titulo,
    fomento: orig.Fomento, tipoInterno: orig.TipoInterno, segmento: orig.Segmento,
    bolsas: orig.Bolsas, custeioCapital: orig.CusteioCapital,
    dataPublicacao: orig.DataPublicacao, inscricoesInicio: orig.InscricoesInicio,
    inscricoesFim: orig.InscricoesFim, dataResultado: orig.DataResultado,
    agenciaFomento: orig.AgenciaFomento, link: orig.Link, status: 'Ativo'
  };
  const newId = genId();
  getSheet('Editais').appendRow(_editalRow(newId, p, nowBR(), email));
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

// Garante a pasta do edital ({segmento}/{ano do edital}/{label}) e retorna a URL.
function getEditalFolderUrl(editalId) {
  const edital = sheetRows('Editais').find(e => String(e.ID) === String(editalId));
  if (!edital) throw new Error('Edital não encontrado.');
  const label  = (edital.Numero || '') + '-' + (edital.Ano || '') + ' ' + (edital.Titulo || '');
  const folder = _editalFolder(label.trim(), edital.Ano, edital.Segmento);
  return { url: folder.getUrl() };
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
  // Estrutura: {segmento}/{ano}/{edital}/Documentos Edital/*.pdf (+ pasta "Ações" ao lado).
  const editalFolder = _editalFolder(label.trim(), anoPasta, edital.Segmento);
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
