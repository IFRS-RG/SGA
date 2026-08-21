// ============================================================
// SGA — Sistema de Gestão de Ações · IFRS Campus Rio Grande
// Backend (Google Apps Script) — Configuração e Helpers
// ============================================================
//
// PREENCHER APÓS CRIAR A PLANILHA NOVA:
//   1. Crie uma planilha nova no Google Sheets (conta projetos@).
//   2. Copie o ID da URL (…/spreadsheets/d/<ESTE_ID>/edit) e cole abaixo.
//   3. (Opcional) Crie uma pasta no Drive para os PDFs e cole o ID dela.
//   4. Rode a função initSheets() uma vez (menu Executar) para criar as abas.
// ============================================================

const SPREADSHEET_ID = '15UBg8zHMZz5nSejT-5YMyrwbz8IAn6sizFQ4q4ZPuTk';

// Pasta raiz do Drive onde os PDFs de editais serão guardados.
// Deixe vazio ('') para o sistema criar uma pasta "SGA — Editais" na raiz do Drive.
const DRIVE_ROOT_ID  = '';

// E-mail com acesso geral (super admin). Sempre tem perfil "Admin".
const SUPER_ADMIN    = 'projetos@riogrande.ifrs.edu.br';

// Perfis de acesso disponíveis no sistema.
const PERFIS = ['Admin', 'Coordenador', 'Visualizador'];

// Segmentos (mesma lista da V1).
const SEGMENTOS = ['Ensino', 'Pesquisa', 'Extensão', 'Indissociável', 'Conjunto'];

// Tipos de documento no upload de PDF do edital.
const TIPOS_DOC = ['Edital', 'Retificação', 'Anexo', 'Demais publicações'];

// ── Índices de coluna (0-based) ──────────────────────────────
const COL = {
  Editais: {
    ID: 0, Numero: 1, Ano: 2, Titulo: 3, Fomento: 4, TipoInterno: 5, Segmento: 6,
    Bolsas: 7, CusteioCapital: 8, DataPublicacao: 9, InscricoesInicio: 10,
    InscricoesFim: 11, DataResultado: 12, AgenciaFomento: 13, Link: 14,
    Status: 15, CriadoEm: 16, CriadoPor: 17
  },
  EditalDocumentos: {
    ID: 0, EditalID: 1, Tipo: 2, NomeArquivo: 3, DriveFileId: 4, DriveUrl: 5,
    DataUpload: 6, EnviadoPor: 7
  },
  Perfis: {
    Email: 0, Nome: 1, Perfil: 2, Status: 3, AtualizadoEm: 4, AtualizadoPor: 5
  }
};

const HEADERS = {
  Editais: ['ID', 'Numero', 'Ano', 'Titulo', 'Fomento', 'TipoInterno', 'Segmento',
            'Bolsas', 'CusteioCapital', 'DataPublicacao', 'InscricoesInicio',
            'InscricoesFim', 'DataResultado', 'AgenciaFomento', 'Link', 'Status',
            'CriadoEm', 'CriadoPor'],
  EditalDocumentos: ['ID', 'EditalID', 'Tipo', 'NomeArquivo', 'DriveFileId',
                     'DriveUrl', 'DataUpload', 'EnviadoPor'],
  Perfis: ['Email', 'Nome', 'Perfil', 'Status', 'AtualizadoEm', 'AtualizadoPor']
};

// ── Helpers genéricos ────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function respond(payload) {
  const out = ContentService.createTextOutput(JSON.stringify(payload));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function getSheet(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw new Error('Aba "' + name + '" não existe. Rode initSheets().');
  return sh;
}

// Lê uma aba como array de objetos {Header: valor}.
function sheetRows(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// Retorna o número da linha (1-based) cuja 1ª coluna == id, ou -1.
function findRowIndex(sheetName, id) {
  const data = getSheet(sheetName).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function isoNow() { return new Date().toISOString(); }

function nowBR() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
}
