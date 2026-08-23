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

// Pasta raiz do Drive onde os arquivos são guardados ("SGA - ARQUIVOS", movida/renomeada).
// Deixe vazio ('') para o sistema criar uma pasta "SGA - ARQUIVOS" na raiz do My Drive.
const DRIVE_ROOT_ID  = '1HcZMS3oX6C5C8ED4E8a-9AgtqugdJjy0';

// E-mail com acesso geral (super admin). Sempre tem perfil "Admin".
const SUPER_ADMIN    = 'projetos@riogrande.ifrs.edu.br';

// Perfis de acesso disponíveis no sistema.
//   Admin       → acesso geral (todos os segmentos)
//   Gestor      → diretoria/setor: gerencia editais/ações de UM segmento
//   Visualizador→ somente leitura
const PERFIS = ['Admin', 'Gestor', 'Visualizador'];

// Segmentos das AÇÕES/EDITAIS. "Conjunto" engloba os 4 segmentos.
const SEGMENTOS = ['Ensino', 'Pesquisa', 'Extensão', 'Indissociável', 'Conjunto'];
// Os 4 segmentos "reais" (usados quando o edital é Conjunto).
const SEGMENTOS_BASE = ['Ensino', 'Pesquisa', 'Extensão', 'Indissociável'];

// Segmentos usados no PERFIL de acesso ('Todos' = geral).
const SEGMENTOS_ACESSO = ['Todos', 'Ensino', 'Pesquisa', 'Extensão', 'Indissociável'];

// Listas de edital.
const CATEGORIA_EDITAL = ['IFRS-RG', 'PROEN', 'PROEX', 'PROPPI'];
// Tipo (finalidade) e Regime (modalidade de submissão). O form aceita "Outro" (texto livre).
const TIPO_EDITAL = ['Fomento', 'Auxílio', 'Apoio', 'Registro', 'Seleção',
  'Chamamento Público', 'Credenciamento', 'Premiação', 'Concessão'];
const REGIME_EDITAL = ['Chamada única', 'Chamada periódica', 'Fluxo contínuo',
  'Fluxo contínuo permanente', 'Emergencial / Extraordinária'];

// Tipos de fomento/auxílio por segmento (o form também aceita "Outro" via texto livre).
const TIPO_FOMENTO = {
  'Ensino': ['PAIEN'],
  'Pesquisa': ['AIPCTI'],
  'Extensão': ['PAIEX'],
  'Indissociável': ['PAIIND']
};
// Tipos de bolsa por segmento.
const TIPO_BOLSA = {
  'Ensino': ['PIBEN'],
  'Pesquisa': ['PIBIC', 'PIBIC-Af', 'PIBIC-EM', 'PROBIC', 'PIBITI', 'PROBITI'],
  'Extensão': ['PIBEX'],
  'Indissociável': ['PIBIND']
};
// Valor da bolsa por carga horária semanal (referência PIBEX/PIBEN).
const CH_VALOR = { '4': 175, '8': 350, '12': 525, '16': 700 };

// Tipos de documento no upload de PDF do edital.
const TIPOS_DOC = ['Edital', 'Retificação', 'Anexo', 'Demais publicações'];

// ── Índices de coluna (0-based) ──────────────────────────────
const COL = {
  Editais: {
    ID: 0, Numero: 1, Ano: 2, Titulo: 3, Resumo: 4, Segmento: 5, Categoria: 6,
    TipoEdital: 7, Regime: 8, LinkPublicacao: 9, Fomento: 10, AgenciaFomento: 11,
    TipoFomentoJSON: 12, Custeio: 13, Capital: 14, Total: 15, Bolsa: 16,
    AgenciaBolsa: 17, BolsasJSON: 18, DataPublicacao: 19, CronogramaJSON: 20,
    EditaisPaiJSON: 21, StatusManual: 22, CriadoEm: 23, CriadoPor: 24
  },
  EditalDocumentos: {
    ID: 0, EditalID: 1, Tipo: 2, NomeArquivo: 3, DriveFileId: 4, DriveUrl: 5,
    DataUpload: 6, EnviadoPor: 7
  },
  Perfis: {
    Email: 0, Nome: 1, Perfil: 2, Segmento: 3, Status: 4, AtualizadoEm: 5, AtualizadoPor: 6
  }
};

const HEADERS = {
  Editais: ['ID', 'Numero', 'Ano', 'Titulo', 'Resumo', 'Segmento', 'Categoria',
            'TipoEdital', 'Regime', 'LinkPublicacao', 'Fomento', 'AgenciaFomento',
            'TipoFomentoJSON', 'Custeio', 'Capital', 'Total', 'Bolsa', 'AgenciaBolsa',
            'BolsasJSON', 'DataPublicacao', 'CronogramaJSON', 'EditaisPaiJSON',
            'StatusManual', 'CriadoEm', 'CriadoPor'],
  EditalDocumentos: ['ID', 'EditalID', 'Tipo', 'NomeArquivo', 'DriveFileId',
                     'DriveUrl', 'DataUpload', 'EnviadoPor'],
  Perfis: ['Email', 'Nome', 'Perfil', 'Segmento', 'Status', 'AtualizadoEm', 'AtualizadoPor']
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
