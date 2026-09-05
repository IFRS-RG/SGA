// ============================================================
// Portal do Aluno — Configuração (projeto Apps Script SEPARADO)
// Este robô só enxerga a PLANILHA DO PORTAL. Nunca toca no SGA.
// ============================================================

// Planilha do portal (a mesma cujo ID você cadastrou no SGA).
const PORTAL_SPREADSHEET_ID = '1yBRRO9xeM75U2czJYTWFGlP0VujJ4YN4mKJACejYMl4';

// OAuth Client ID (o MESMO do SGA — origem ifrs-rg.github.io já autorizada).
const OAUTH_CLIENT_ID = '417258387995-5979idejok5shddicb8skm120bv67rbj.apps.googleusercontent.com';

// Só entra quem tem e-mail deste domínio.
const ALUNO_DOMAIN = '@aluno.riogrande.ifrs.edu.br';

// Abas da planilha do portal (o SGA as cria/alimenta; aqui só usamos).
const TAB = {
  Selecao: ['SelecaoID', 'Nome', 'Status', 'MaxVagasAluno', 'PublicadoEm'],
  Vagas: ['SelecaoID', 'VagaID', 'Titulo', 'Tipo', 'Segmento', 'Acao', 'Edital', 'FaixasJSON', 'RequisitosJSON', 'CriteriosJSON', 'CoordNome', 'CoordEmail', 'Resumo', 'HabilidadesJSON'],
  Inscricoes: ['SelecaoID', 'VagaID', 'FaixaCH', 'Nome', 'Matricula', 'Curso', 'Email', 'EmailAluno', 'DataInscricao'],
  Cursos: ['ID', 'Nome']
};

function _book() { return SpreadsheetApp.openById(PORTAL_SPREADSHEET_ID); }

function _sheet(name) {
  const b = _book();
  let sh = b.getSheetByName(name);
  if (!sh) { sh = b.insertSheet(name); sh.appendRow(TAB[name]); }
  return sh;
}

// Lê uma aba como lista de objetos (chaves = cabeçalho). _row = linha na planilha.
function _objs(name) {
  const sh = _book().getSheetByName(name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const h = data[0].map(String);
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const o = { _row: i + 1 };
    h.forEach((k, j) => { o[k] = data[i][j]; });
    out.push(o);
  }
  return out;
}

function _resp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function _now() { return new Date().toISOString(); }

function _uErr(msg) { const e = new Error(msg); e.userFacing = true; return e; }
