// ============================================================
// SGA — Sistema de Gestão de Ações · IFRS Campus Rio Grande
// Backend: Google Apps Script
// ============================================================

const SS_ID         = '1AOCt24MM_r76EnEUXHkDkh-tmOFt5AG-9QfI2DMFhfY';
const DRIVE_ROOT_ID = '1Z5Hzru-Emv5pdL6scllo32sm35-iw-uB';
const SYSTEM_URL    = 'https://IFRS-RG.github.io/SGA/';
const FOOTER        = '\n\nE-mail automático — não responda. Em caso de dúvidas, entre em contato com a Secretaria de Ensino, Pesquisa ou Extensão do IFRS Rio Grande.';
const ADMIN_DOMAIN  = 'riogrande.ifrs.edu.br';
const ALUNO_DOMAIN  = 'aluno.riogrande.ifrs.edu.br';
const ADMIN_PREFIXES = ['dex', 'den', 'dppi', 'saen'];
const ADMIN_PERMISSIONS = {
  dex:  ['Extensão'],
  dppi: ['Pesquisa', 'Indissociável'],
  den:  ['Ensino'],
  saen: ['Ensino']
};

// ── Sheet column indices (0-based) ───────────────────────────
const COL = {
  Coordenadores: { ID:0, Nome:1, Email:2, CPF:3, Telefone:4, Status:5, DataCriacao:6, DriveFolder:7 },
  Editais:       { ID:0, Numero:1, Ano:2, Titulo:3, Fomento:4, TipoInterno:5, Segmento:6, Bolsas:7, CusteioCapital:8, Status:9 },
  Acoes:         { ID:0, Titulo:1, CoordenadorEmail:2, AnoExecucao:3, Segmento:4, EditalID:5, Status:6, DriveFolder:7 },
  // Membros: identidade única do participante; dados complementares preenchidos pelo próprio
  Membros:       { ID:0, Nome:1, Email:2, Status:3, DataCriacao:4, DriveFolder:5,
                   DataNascimento:6, CPF:7, Telefone:8, Endereco:9, EmailPessoal:10,
                   CursoID:11, Curso:12, Matricula:13, AnoSemestreIngresso:14, SemestreAtual:15, DataInicio:16,
                   Banco:17, Agencia:18, Conta:19, TipoConta:20, Documentos:21 },
  // Bolsistas/Voluntarios: apenas vínculo Membro ↔ Ação
  Bolsistas:     { ID:0, MembroID:1, AcaoID:2, CargaHoraria:3, EditalID:4, Status:5 },
  Voluntarios:   { ID:0, MembroID:1, AcaoID:2, CargaHoraria:3, Status:4 },
  Cursos:        { ID:0, Nome:1, Modalidade:2, Status:3 },
  Assiduidades:  { ID:0, AcaoID:1, CoordenadorEmail:2, MesAno:3, Snapshot:4, Timestamp:5, ForaPrazo:6, Validado:7, ValidadoPor:8, TimestampValidacao:9 },
  Periodo:       { DiaInicio:0, DiaFim:1 },
  Notificacoes:  { ID:0, Dia:1, Destinatarios:2, Segmento:3, Mensagem:4, Ativo:5 },
  Auditoria:     { Timestamp:0, Perfil:1, Nome:2, Email:3, Acao:4, Detalhe:5 }
};

// ── Helpers ──────────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function respond(payload) {
  const out = ContentService.createTextOutput(JSON.stringify(payload));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function ss() { return SpreadsheetApp.openById(SS_ID); }

function getSheet(name) { return ss().getSheetByName(name); }

function sheetRows(name) {
  const sh = getSheet(name);
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

function findRowIndex(sheetName, id) {
  const sh = getSheet(sheetName);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function nowBR() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
}

function isoNow() { return new Date().toISOString(); }

function normalizeMesAno(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'America/Sao_Paulo', 'yyyy-MM');
  }
  return String(val || '').trim();
}

// ── Token Verification ───────────────────────────────────────
function verifyGoogleToken(token) {
  if (!token) return { valid: false };
  try {
    const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + token;
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return { valid: false };
    const info = JSON.parse(resp.getContentText());
    if (!info.email_verified || info.email_verified === 'false') return { valid: false };
    return { valid: true, email: info.email, name: info.name, picture: info.picture };
  } catch (e) {
    return { valid: false };
  }
}

// ── Role Detection ────────────────────────────────────────────
function getRole(email) {
  if (!email) return { role: 'denied', reason: 'Email não fornecido.' };

  const parts  = email.split('@');
  const user   = parts[0];
  const domain = parts[1];

  const validDomains = [ADMIN_DOMAIN, ALUNO_DOMAIN];
  if (!validDomains.includes(domain)) {
    return { role: 'denied', reason: 'Domínio de e-mail não autorizado. Use seu e-mail institucional do IFRS Rio Grande.' };
  }

  if (domain === ADMIN_DOMAIN && ADMIN_PREFIXES.includes(user)) {
    return { role: 'admin', email, name: user.toUpperCase(), permissions: ADMIN_PERMISSIONS[user] || [] };
  }

  // Verifica se é membro (bolsista ou voluntário)
  const membros = sheetRows('Membros');
  const membro  = membros.find(r => r.Email === email && r.Status === 'Ativo');
  if (membro) {
    return { role: 'participante', email, nome: membro.Nome };
  }

  if (domain === ADMIN_DOMAIN) {
    const coords = sheetRows('Coordenadores');
    const coord  = coords.find(r => r.Email === email && r.Status === 'Ativo');
    if (coord) return { role: 'coordenador', email, nome: coord.Nome };
    return { role: 'denied', reason: 'Seu e-mail é institucional, mas ainda não está cadastrado como coordenador ativo.' };
  }

  return { role: 'denied', reason: 'Seu e-mail de aluno não possui acesso ao sistema.' };
}

// ── Audit Logging ─────────────────────────────────────────────
function audit(perfil, nome, email, acao, detalhe) {
  try {
    const sh = getSheet('Auditoria');
    sh.appendRow([isoNow(), perfil, nome, email, acao, detalhe]);
  } catch (e) { /* non-blocking */ }
}

// ── Drive Helpers ─────────────────────────────────────────────
function getOrCreateFolder(parentId, name) {
  const parent = DriveApp.getFolderById(parentId);
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function criarPastasCoordenador(nome) {
  return getOrCreateFolder(DRIVE_ROOT_ID, nome).getId();
}

function criarPastasAcao(coordPastaId, ano, titulo) {
  return getOrCreateFolder(coordPastaId, ano + ' — ' + titulo).getId();
}

// Pasta do membro dentro de Root/Membros/[nome]
function criarPastaMembro(nome) {
  const membrosFolder = getOrCreateFolder(DRIVE_ROOT_ID, 'Membros');
  return getOrCreateFolder(membrosFolder.getId(), nome).getId();
}

// ── Period Logic ──────────────────────────────────────────────
function getPeriodo() {
  const sh   = getSheet('Periodo');
  const data = sh.getDataRange().getValues();
  const row  = data[1] || [25, 10];
  const ini  = row[0] || 25;
  const fim  = row[1] || 10;

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  const inicio = new Date(year, month, ini);
  const fim_   = new Date(year, month + 1, fim);

  const aberto = now >= inicio && now <= fim_;
  return {
    diaInicio: ini,
    diaFim: fim,
    inicio: Utilities.formatDate(inicio, 'America/Sao_Paulo', 'dd/MM/yyyy'),
    fim: Utilities.formatDate(fim_, 'America/Sao_Paulo', 'dd/MM/yyyy'),
    aberto
  };
}

function setPeriodo(payload, email) {
  const sh   = getSheet('Periodo');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) {
    sh.appendRow([payload.diaInicio, payload.diaFim]);
  } else {
    sh.getRange(2, 1, 1, 2).setValues([[payload.diaInicio, payload.diaFim]]);
  }
  audit('Admin', email.split('@')[0], email, 'Configurar Período', `Dia ${payload.diaInicio} a Dia ${payload.diaFim}`);
  return { ok: true };
}

function isPeriodoAberto() { return getPeriodo().aberto; }

// ── Email Templates ───────────────────────────────────────────
function sendEmail(to, subject, body) {
  MailApp.sendEmail({ to, subject, htmlBody: body + FOOTER + '\n\n<a href="' + SYSTEM_URL + '">' + SYSTEM_URL + '</a>' });
}

function emailConfirmacaoAssiduidade(coord, snapshot, foraPrazo) {
  const lista = snapshot.participantes.map(p =>
    `<tr><td>${p.nome}</td><td>${p.tipo}</td><td style="color:${p.cumpriu?'green':'red'}">${p.cumpriu?'Sim':'Não'}</td><td>${p.observacao||''}</td></tr>`
  ).join('');

  const badge = foraPrazo ? `<p style="color:red;font-weight:bold">⚠ Enviado fora do prazo · ${nowBR()}</p>` : '';
  const body = `<h2>SGA — Assiduidade Registrada</h2>${badge}
    <p><strong>Ação:</strong> ${snapshot.acaoTitulo}</p>
    <p><strong>Período:</strong> ${snapshot.mesAnoLabel}</p>
    <p><strong>Enviado em:</strong> ${nowBR()}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><th>Nome</th><th>Tipo</th><th>Cumpriu?</th><th>Observação</th></tr>${lista}</table>`;

  const subject = foraPrazo
    ? `⚠ [SGA] Assiduidade fora do prazo — ${snapshot.acaoTitulo} (${snapshot.mesAnoLabel})`
    : `[SGA] Assiduidade registrada — ${snapshot.acaoTitulo} (${snapshot.mesAnoLabel})`;

  sendEmail(coord, subject, body);
}

function emailAvisoBolsistaForaPrazo(emailBolsista, nomeBolsista, snapshot) {
  const body = `<h2>SGA — Aviso de Assiduidade</h2>
    <p>Olá, <strong>${nomeBolsista}</strong>.</p>
    <p>A assiduidade da ação <strong>${snapshot.acaoTitulo}</strong> referente ao mês de <strong>${snapshot.mesAnoLabel}</strong>
    foi enviada <strong style="color:red">fora do prazo</strong> pelo coordenador.</p>
    <p>O atraso no envio pode impactar o pagamento da sua bolsa. Em caso de dúvidas, entre em contato com a secretaria responsável.</p>`;
  sendEmail(emailBolsista, `⚠ [SGA] Assiduidade enviada fora do prazo — ${snapshot.acaoTitulo}`, body);
}

// ── MEMBROS CRUD ──────────────────────────────────────────────
function getMembros() {
  const membros = sheetRows('Membros');
  const cursos  = sheetRows('Cursos');
  return membros.map(m => {
    const curso = cursos.find(c => c.ID === m.CursoID);
    let docs = [];
    try { docs = JSON.parse(m.Documentos || '[]'); } catch(e) {}
    return { ...m, cursoLabel: curso ? `${curso.Nome} — ${curso.Modalidade}` : (m.CursoID || ''), docs };
  });
}

function getPerfilMembro(email) {
  const membros = sheetRows('Membros');
  const rec = membros.find(r => r.Email === email && r.Status === 'Ativo');
  if (!rec) return { error: 'Membro não encontrado.' };
  const cursos = sheetRows('Cursos');
  const curso  = cursos.find(c => c.ID === rec.CursoID);
  let docs = [];
  try { docs = JSON.parse(rec.Documentos || '[]'); } catch(e) {}
  return { ...rec, cursoLabel: curso ? `${curso.Nome} — ${curso.Modalidade}` : (rec.CursoID || ''), docs };
}

function addMembro(p, adminEmail) {
  const sh = getSheet('Membros');
  // Impede duplicatas por email
  const existing = sheetRows('Membros');
  if (existing.find(r => r.Email === p.email)) return { error: 'Já existe um membro com este e-mail.' };
  const id = genId();
  let driveId = '';
  try { driveId = criarPastaMembro(p.nome); } catch (e) {}
  sh.appendRow([id, p.nome, p.email, 'Ativo', isoNow(), driveId,
                '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  audit('Admin', adminEmail.split('@')[0], adminEmail, 'Adicionar Membro', p.nome + ' · ' + p.email);
  return { ok: true, id };
}

function updateMembro(id, p, adminEmail) {
  const sh  = getSheet('Membros');
  const idx = findRowIndex('Membros', id);
  if (idx < 0) return { error: 'Não encontrado' };
  const c = COL.Membros;
  sh.getRange(idx, c.Nome + 1).setValue(p.nome);
  sh.getRange(idx, c.Email + 1).setValue(p.email);
  audit('Admin', adminEmail.split('@')[0], adminEmail, 'Editar Membro', p.nome);
  return { ok: true };
}

function deleteMembro(id, email) {
  const idx = findRowIndex('Membros', id);
  if (idx < 0) return { error: 'Não encontrado' };
  getSheet('Membros').deleteRow(idx);
  audit('Admin', email.split('@')[0], email, 'Excluir Membro', 'ID ' + id);
  return { ok: true };
}

function updatePerfilMembro(email, p) {
  const rows = sheetRows('Membros');
  const rec  = rows.find(r => r.Email === email);
  if (!rec) return { error: 'Membro não encontrado.' };
  const sh  = getSheet('Membros');
  const c   = COL.Membros;
  const idx = findRowIndex('Membros', rec.ID);
  const fields = [
    ['dataNascimento',    c.DataNascimento],
    ['cpf',              c.CPF],
    ['telefone',         c.Telefone],
    ['endereco',         c.Endereco],
    ['emailPessoal',     c.EmailPessoal],
    ['cursoId',          c.CursoID],
    ['curso',            c.Curso],
    ['matricula',        c.Matricula],
    ['anoSemestreIngresso', c.AnoSemestreIngresso],
    ['semestreAtual',    c.SemestreAtual],
    ['dataInicio',       c.DataInicio],
    ['banco',            c.Banco],
    ['agencia',          c.Agencia],
    ['conta',            c.Conta],
    ['tipoConta',        c.TipoConta]
  ];
  fields.forEach(([key, col]) => {
    if (p[key] !== undefined && p[key] !== null && p[key] !== '')
      sh.getRange(idx, col + 1).setValue(p[key]);
  });
  audit('Membro', rec.Nome, email, 'Atualizar Perfil', 'Dados complementares');
  return { ok: true };
}

function uploadDocumento(email, payload) {
  const rows = sheetRows('Membros');
  const rec  = rows.find(r => r.Email === email);
  if (!rec) return { error: 'Membro não encontrado.' };
  if (!rec.DriveFolder) return { error: 'Pasta Drive não configurada. Contate o administrador.' };
  try {
    const folder = DriveApp.getFolderById(rec.DriveFolder);
    const bytes  = Utilities.base64Decode(payload.base64);
    const blob   = Utilities.newBlob(bytes, payload.mimeType || 'application/pdf', payload.fileName);
    // Remove versão anterior com mesmo nome
    const existing = folder.getFilesByName(payload.fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // Atualiza JSON de documentos no registro do membro
    const sh  = getSheet('Membros');
    const idx = findRowIndex('Membros', rec.ID);
    let docs = [];
    try { docs = JSON.parse(rec.Documentos || '[]'); } catch(e) {}
    docs = docs.filter(d => d.name !== payload.fileName);
    docs.push({ name: payload.fileName, url: file.getUrl(), fileId: file.getId() });
    sh.getRange(idx, COL.Membros.Documentos + 1).setValue(JSON.stringify(docs));
    audit('Membro', rec.Nome, email, 'Upload Documento', payload.fileName);
    return { ok: true, fileId: file.getId(), fileUrl: file.getUrl() };
  } catch (e) {
    return { error: 'Erro ao salvar arquivo: ' + e.message };
  }
}

// ── COORDENADORES CRUD ────────────────────────────────────────
function getCoordenadores() { return sheetRows('Coordenadores'); }

function addCoordenador(p, adminEmail) {
  const sh = getSheet('Coordenadores');
  const id = genId();
  let driveId = '';
  try { driveId = criarPastasCoordenador(p.nome); } catch (e) {}
  sh.appendRow([id, p.nome, p.email, p.cpf || '', p.telefone || '', 'Ativo', isoNow(), driveId]);
  audit('Admin', adminEmail.split('@')[0], adminEmail, 'Adicionar Coordenador', p.nome + ' · ' + p.email);
  return { ok: true, id };
}

function updateCoordenador(p, adminEmail) {
  const sh  = getSheet('Coordenadores');
  const idx = findRowIndex('Coordenadores', p.id);
  if (idx < 0) return { error: 'Não encontrado' };
  const c = COL.Coordenadores;
  sh.getRange(idx, c.Nome + 1).setValue(p.nome);
  sh.getRange(idx, c.Email + 1).setValue(p.email);
  if (p.cpf !== undefined)      sh.getRange(idx, c.CPF + 1).setValue(p.cpf);
  if (p.telefone !== undefined) sh.getRange(idx, c.Telefone + 1).setValue(p.telefone);
  audit('Admin', adminEmail.split('@')[0], adminEmail, 'Editar Coordenador', p.nome);
  return { ok: true };
}

function deleteCoordenador(id, email) {
  const idx = findRowIndex('Coordenadores', id);
  if (idx < 0) return { error: 'Não encontrado' };
  getSheet('Coordenadores').deleteRow(idx);
  audit('Admin', email.split('@')[0], email, 'Excluir Coordenador', 'ID ' + id);
  return { ok: true };
}

function updatePerfilCoordenador(email, p) {
  const rows = sheetRows('Coordenadores');
  const rec  = rows.find(r => r.Email === email);
  if (!rec) return { error: 'Não encontrado' };
  const sh  = getSheet('Coordenadores');
  const idx = findRowIndex('Coordenadores', rec.ID);
  const c   = COL.Coordenadores;
  if (p.cpf)      sh.getRange(idx, c.CPF + 1).setValue(p.cpf);
  if (p.telefone) sh.getRange(idx, c.Telefone + 1).setValue(p.telefone);
  audit('Coordenador', rec.Nome, email, 'Atualizar Perfil', 'CPF/Telefone');
  return { ok: true };
}

// ── EDITAIS CRUD ──────────────────────────────────────────────
function getEditais() { return sheetRows('Editais'); }

function addEdital(p, email) {
  const sh = getSheet('Editais');
  const id = genId();
  sh.appendRow([id, p.numero, p.ano, p.titulo, p.fomento, p.tipoInterno, p.segmento, p.bolsas || 'Não', p.custeioCapital || 'Não', 'Ativo']);
  audit('Admin', email.split('@')[0], email, 'Adicionar Edital', p.numero + '/' + p.ano);
  return { ok: true, id };
}

function updateEdital(id, p, email) {
  const sh  = getSheet('Editais');
  const idx = findRowIndex('Editais', id);
  if (idx < 0) return { error: 'Não encontrado' };
  sh.getRange(idx, 1, 1, 10).setValues([[id, p.numero, p.ano, p.titulo, p.fomento, p.tipoInterno, p.segmento, p.bolsas || 'Não', p.custeioCapital || 'Não', p.status || 'Ativo']]);
  audit('Admin', email.split('@')[0], email, 'Editar Edital', p.numero + '/' + p.ano);
  return { ok: true };
}

function deleteEdital(id, email) {
  const idx = findRowIndex('Editais', id);
  if (idx < 0) return { error: 'Não encontrado' };
  getSheet('Editais').deleteRow(idx);
  audit('Admin', email.split('@')[0], email, 'Excluir Edital', 'ID ' + id);
  return { ok: true };
}

// ── AÇÕES CRUD ────────────────────────────────────────────────
function getAcoes() {
  const acoes   = sheetRows('Acoes');
  const coords  = sheetRows('Coordenadores');
  const editais = sheetRows('Editais');
  return acoes.map(a => {
    const coord  = coords.find(c => c.Email === a.CoordenadorEmail);
    const edital = editais.find(e => e.ID === a.EditalID);
    return {
      ...a,
      coordenadorNome: coord  ? coord.Nome  : a.CoordenadorEmail,
      editalLabel:     edital ? `${edital.Numero}/${edital.Ano} — ${edital.Titulo}` : (a.EditalID || '')
    };
  });
}

function addAcao(p, email) {
  const sh = getSheet('Acoes');
  const id = genId();
  let driveId = '';
  try {
    const coords = sheetRows('Coordenadores');
    const coord  = coords.find(c => c.Email === p.coordenadorEmail);
    if (coord && coord.DriveFolder) {
      driveId = criarPastasAcao(coord.DriveFolder, p.anoExecucao, p.titulo);
    }
  } catch (e) {}
  sh.appendRow([id, p.titulo, p.coordenadorEmail, p.anoExecucao, p.segmento, p.editalId || '', 'Ativo', driveId]);
  audit('Admin', email.split('@')[0], email, 'Adicionar Ação', p.titulo);
  return { ok: true, id };
}

function updateAcao(id, p, email) {
  const sh  = getSheet('Acoes');
  const idx = findRowIndex('Acoes', id);
  if (idx < 0) return { error: 'Não encontrado' };
  const row = sh.getRange(idx, 1, 1, 8).getValues()[0];
  sh.getRange(idx, 1, 1, 8).setValues([[
    id, p.titulo, p.coordenadorEmail, p.anoExecucao, p.segmento,
    p.editalId || '', p.status || row[6], row[7]
  ]]);
  audit('Admin', email.split('@')[0], email, 'Editar Ação', p.titulo);
  return { ok: true };
}

function deleteAcao(id, email) {
  const idx = findRowIndex('Acoes', id);
  if (idx < 0) return { error: 'Não encontrado' };
  getSheet('Acoes').deleteRow(idx);
  audit('Admin', email.split('@')[0], email, 'Excluir Ação', 'ID ' + id);
  return { ok: true };
}

// ── BOLSISTAS CRUD ────────────────────────────────────────────
function getBolsistas() {
  const bolsistas = sheetRows('Bolsistas');
  const membros   = sheetRows('Membros');
  const acoes     = sheetRows('Acoes');
  const editais   = sheetRows('Editais');
  return bolsistas.map(b => {
    const membro = membros.find(m => m.ID === b.MembroID);
    const acao   = acoes.find(a => a.ID === b.AcaoID);
    const edital = editais.find(e => e.ID === b.EditalID);
    return {
      ...b,
      Nome:        membro ? membro.Nome  : '',
      Email:       membro ? membro.Email : '',
      acaoTitulo:  acao   ? acao.Titulo  : b.AcaoID,
      editalLabel: edital ? `${edital.Numero}/${edital.Ano} — ${edital.Titulo}` : ''
    };
  });
}

function addBolsista(p, email) {
  const sh = getSheet('Bolsistas');
  // Impede vínculo duplicado membro+ação
  const existing = sheetRows('Bolsistas');
  if (existing.find(r => r.MembroID === p.membroId && r.AcaoID === p.acaoId && r.Status === 'Ativo')) {
    return { error: 'Este membro já é bolsista desta ação.' };
  }
  const id = genId();
  sh.appendRow([id, p.membroId, p.acaoId, p.cargaHoraria || '', p.editalId || '', 'Ativo']);
  const membros = sheetRows('Membros');
  const membro  = membros.find(m => m.ID === p.membroId);
  audit('Admin', email.split('@')[0], email, 'Adicionar Bolsista', membro ? membro.Nome : p.membroId);
  return { ok: true, id };
}

function updateBolsista(id, p, email) {
  const sh  = getSheet('Bolsistas');
  const idx = findRowIndex('Bolsistas', id);
  if (idx < 0) return { error: 'Não encontrado' };
  const row = sh.getRange(idx, 1, 1, 6).getValues()[0];
  sh.getRange(idx, 1, 1, 6).setValues([[
    id,
    p.membroId    || row[1],
    p.acaoId      || row[2],
    p.cargaHoraria !== undefined ? p.cargaHoraria : row[3],
    p.editalId    !== undefined  ? p.editalId     : row[4],
    p.status      || row[5]
  ]]);
  audit('Admin', email.split('@')[0], email, 'Editar Bolsista', 'ID ' + id);
  return { ok: true };
}

function deleteBolsista(id, email) {
  const idx = findRowIndex('Bolsistas', id);
  if (idx < 0) return { error: 'Não encontrado' };
  getSheet('Bolsistas').deleteRow(idx);
  audit('Admin', email.split('@')[0], email, 'Excluir Bolsista', 'ID ' + id);
  return { ok: true };
}

// ── VOLUNTÁRIOS CRUD ──────────────────────────────────────────
function getVoluntarios() {
  const vols    = sheetRows('Voluntarios');
  const membros = sheetRows('Membros');
  const acoes   = sheetRows('Acoes');
  return vols.map(v => {
    const membro = membros.find(m => m.ID === v.MembroID);
    const acao   = acoes.find(a => a.ID === v.AcaoID);
    return {
      ...v,
      Nome:       membro ? membro.Nome  : '',
      Email:      membro ? membro.Email : '',
      acaoTitulo: acao   ? acao.Titulo  : v.AcaoID
    };
  });
}

function addVoluntario(p, email) {
  const sh = getSheet('Voluntarios');
  const existing = sheetRows('Voluntarios');
  if (existing.find(r => r.MembroID === p.membroId && r.AcaoID === p.acaoId && r.Status === 'Ativo')) {
    return { error: 'Este membro já é voluntário desta ação.' };
  }
  const id = genId();
  sh.appendRow([id, p.membroId, p.acaoId, p.cargaHoraria || '', 'Ativo']);
  const membros = sheetRows('Membros');
  const membro  = membros.find(m => m.ID === p.membroId);
  audit('Admin', email.split('@')[0], email, 'Adicionar Voluntário', membro ? membro.Nome : p.membroId);
  return { ok: true, id };
}

function updateVoluntario(id, p, email) {
  const sh  = getSheet('Voluntarios');
  const idx = findRowIndex('Voluntarios', id);
  if (idx < 0) return { error: 'Não encontrado' };
  const row = sh.getRange(idx, 1, 1, 5).getValues()[0];
  sh.getRange(idx, 1, 1, 5).setValues([[
    id,
    p.membroId     || row[1],
    p.acaoId       || row[2],
    p.cargaHoraria !== undefined ? p.cargaHoraria : row[3],
    p.status       || row[4]
  ]]);
  audit('Admin', email.split('@')[0], email, 'Editar Voluntário', 'ID ' + id);
  return { ok: true };
}

function deleteVoluntario(id, email) {
  const idx = findRowIndex('Voluntarios', id);
  if (idx < 0) return { error: 'Não encontrado' };
  getSheet('Voluntarios').deleteRow(idx);
  audit('Admin', email.split('@')[0], email, 'Excluir Voluntário', 'ID ' + id);
  return { ok: true };
}

// ── CURSOS CRUD ───────────────────────────────────────────────
function getCursos() { return sheetRows('Cursos'); }

function addCurso(p, email) {
  const sh = getSheet('Cursos');
  const id = genId();
  sh.appendRow([id, p.nome, p.modalidade, 'Ativo']);
  audit('Admin', email.split('@')[0], email, 'Adicionar Curso', p.nome);
  return { ok: true, id };
}

function updateCurso(id, p, email) {
  const sh  = getSheet('Cursos');
  const idx = findRowIndex('Cursos', id);
  if (idx < 0) return { error: 'Não encontrado' };
  sh.getRange(idx, 1, 1, 4).setValues([[id, p.nome, p.modalidade, p.status || 'Ativo']]);
  audit('Admin', email.split('@')[0], email, 'Editar Curso', p.nome);
  return { ok: true };
}

function deleteCurso(id, email) {
  const idx = findRowIndex('Cursos', id);
  if (idx < 0) return { error: 'Não encontrado' };
  getSheet('Cursos').deleteRow(idx);
  audit('Admin', email.split('@')[0], email, 'Excluir Curso', 'ID ' + id);
  return { ok: true };
}

// ── Generic Toggle Status ─────────────────────────────────────
function toggleStatus(sheetName, id, newStatus, email) {
  const sh  = getSheet(sheetName);
  const idx = findRowIndex(sheetName, id);
  if (idx < 0) return { error: 'Não encontrado' };
  const c = COL[sheetName];
  sh.getRange(idx, c.Status + 1).setValue(newStatus);
  audit('Admin', email.split('@')[0], email, `Alterar Status ${sheetName}`, `ID ${id} → ${newStatus}`);
  return { ok: true };
}

// ── ASSIDUIDADE ───────────────────────────────────────────────
function enviarAssiduidade(email, userInfo, payload) {
  const sh = getSheet('Assiduidades');

  const existentes = sheetRows('Assiduidades');
  const dup = existentes.find(r => r.AcaoID === payload.acaoId && r.MesAno === payload.mesAno);
  if (dup) return { error: 'Assiduidade já enviada para este mês.' };

  const foraPrazo = !isPeriodoAberto();
  const id        = genId();
  const timestamp = isoNow();

  const acoes       = sheetRows('Acoes');
  const bolsistas   = sheetRows('Bolsistas');
  const voluntarios = sheetRows('Voluntarios');
  const membros     = sheetRows('Membros');
  const acao = acoes.find(a => a.ID === payload.acaoId);
  if (!acao) return { error: 'Ação não encontrada.' };

  const [ano, mes] = payload.mesAno.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const mesAnoLabel = `${meses[parseInt(mes) - 1]} ${ano}`;

  const participantes = payload.participantes.map(p => {
    const b = bolsistas.find(b => b.ID === p.id);
    const v = voluntarios.find(v => v.ID === p.id);
    const rec    = b || v;
    const membro = rec ? membros.find(m => m.ID === rec.MembroID) : null;
    return {
      id:           p.id,
      nome:         membro ? membro.Nome  : (p.nome || ''),
      email:        membro ? membro.Email : '',
      tipo:         b ? 'bolsista' : 'voluntario',
      cargaHoraria: rec ? rec.CargaHoraria : '',
      cumpriu:      p.cumpriu,
      observacao:   p.observacao || ''
    };
  });

  const snapshot = {
    acaoId: payload.acaoId, acaoTitulo: acao.Titulo,
    coordenadorEmail: email, coordenadorNome: userInfo.name || email,
    mesAno: payload.mesAno, mesAnoLabel, timestamp, foraPrazo, participantes
  };

  const autoValidado = participantes.every(p => p.cumpriu && !p.observacao);
  sh.appendRow([id, payload.acaoId, email, payload.mesAno, JSON.stringify(snapshot), timestamp, foraPrazo, autoValidado, '', '']);

  try {
    emailConfirmacaoAssiduidade(email, snapshot, foraPrazo);
    if (foraPrazo) {
      participantes.filter(p => p.tipo === 'bolsista' && p.email).forEach(p => {
        emailAvisoBolsistaForaPrazo(p.email, p.nome, snapshot);
      });
    }
  } catch (e) { console.error('Email error:', e); }

  audit('Coordenador', userInfo.name || email, email, 'Enviar Assiduidade', `${acao.Titulo} · ${mesAnoLabel}${foraPrazo?' · FORA DO PRAZO':''}`);
  return { ok: true, id, foraPrazo, autoValidado };
}

function getAssiduidades(email, filters) {
  const roleInfo = getRole(email);
  let rows = sheetRows('Assiduidades');

  if (roleInfo.role === 'coordenador') {
    rows = rows.filter(r => r.CoordenadorEmail === email);
  } else if (roleInfo.role === 'participante') {
    rows = rows.filter(r => {
      try {
        const snap = typeof r.Snapshot === 'string' ? JSON.parse(r.Snapshot) : r.Snapshot;
        return snap.participantes && snap.participantes.some(p => p.email === email);
      } catch (e) { return false; }
    });
  }

  if (filters) {
    if (filters.mesAno) rows = rows.filter(r => normalizeMesAno(r.MesAno) === filters.mesAno);
    if (filters.segmento && filters.segmento !== 'Todos') {
      const acoes = sheetRows('Acoes');
      rows = rows.filter(r => {
        const acao = acoes.find(a => a.ID === r.AcaoID);
        return acao && acao.Segmento === filters.segmento;
      });
    }
    if (filters.enviado === 'Enviados')     rows = rows.filter(r => r.Timestamp);
    if (filters.enviado === 'Não enviados') rows = [];
    if (filters.validado === 'Validados')   rows = rows.filter(r => r.Validado === true || r.Validado === 'TRUE');
    if (filters.validado === 'Pendentes')   rows = rows.filter(r => !(r.Validado === true || r.Validado === 'TRUE'));
  }

  const acoes  = sheetRows('Acoes');
  const coords = sheetRows('Coordenadores');
  return rows.map(r => {
    const acao  = acoes.find(a => a.ID === r.AcaoID);
    const coord = coords.find(c => c.Email === r.CoordenadorEmail);
    let snap = {};
    try { snap = typeof r.Snapshot === 'string' ? JSON.parse(r.Snapshot) : r.Snapshot; } catch (e) {}
    return {
      ...r,
      MesAno:          normalizeMesAno(r.MesAno),
      acaoTitulo:      acao  ? acao.Titulo   : r.AcaoID,
      segmento:        acao  ? acao.Segmento : '',
      coordenadorNome: coord ? coord.Nome    : r.CoordenadorEmail,
      snapshot: snap
    };
  });
}

function validarAssiduidade(email, id) {
  const idx = findRowIndex('Assiduidades', id);
  if (idx < 0) return { error: 'Não encontrado' };

  const sh    = getSheet('Assiduidades');
  const row   = sh.getRange(idx, 1, 1, 10).getValues()[0];
  const acaoId = row[COL.Assiduidades.AcaoID];
  const acoes  = sheetRows('Acoes');
  const acao   = acoes.find(a => a.ID === acaoId);

  const prefix  = email.split('@')[0];
  const allowed = ADMIN_PERMISSIONS[prefix] || [];
  if (acao && !allowed.includes(acao.Segmento)) {
    return { error: 'Você não tem permissão para validar este segmento.' };
  }

  sh.getRange(idx, COL.Assiduidades.Validado + 1).setValue(true);
  sh.getRange(idx, COL.Assiduidades.ValidadoPor + 1).setValue(email);
  sh.getRange(idx, COL.Assiduidades.TimestampValidacao + 1).setValue(isoNow());
  audit('Admin', email.split('@')[0], email, 'Validar Assiduidade', `ID ${id}`);
  return { ok: true };
}

// ── NOTIFICAÇÕES ──────────────────────────────────────────────
function getNotificacoes() { return sheetRows('Notificacoes'); }

function addNotificacao(p, email) {
  const sh = getSheet('Notificacoes');
  const id = genId();
  sh.appendRow([id, p.dia, p.destinatarios, p.segmento, p.mensagem, p.ativo !== false]);
  audit('Admin', email.split('@')[0], email, 'Adicionar Lembrete', `Dia ${p.dia}`);
  return { ok: true, id };
}

function updateNotificacao(id, p, email) {
  const sh  = getSheet('Notificacoes');
  const idx = findRowIndex('Notificacoes', id);
  if (idx < 0) return { error: 'Não encontrado' };
  sh.getRange(idx, 1, 1, 6).setValues([[id, p.dia, p.destinatarios, p.segmento, p.mensagem, p.ativo]]);
  audit('Admin', email.split('@')[0], email, 'Editar Lembrete', `ID ${id}`);
  return { ok: true };
}

function deleteNotificacao(id, email) {
  const sh  = getSheet('Notificacoes');
  const idx = findRowIndex('Notificacoes', id);
  if (idx < 0) return { error: 'Não encontrado' };
  sh.deleteRow(idx);
  audit('Admin', email.split('@')[0], email, 'Remover Lembrete', `ID ${id}`);
  return { ok: true };
}

function buildLembreteBody(mensagem, coord) {
  return `<p>Olá, <strong>${coord.Nome}</strong>.</p>
<p>${mensagem}</p>
<p><a href="${SYSTEM_URL}">Acesse o SGA aqui</a></p>`;
}

function sendLembreteManual(p, email) {
  const coords       = sheetRows('Coordenadores');
  const acoes        = sheetRows('Acoes');
  const assiduidades = sheetRows('Assiduidades');

  const now    = new Date();
  const mesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let destCoords = coords.filter(c => c.Status === 'Ativo');

  if (p.segmento && p.segmento !== 'Todos') {
    const acoesSeg    = acoes.filter(a => a.Segmento === p.segmento && a.Status === 'Ativo');
    const emailsCoords = acoesSeg.map(a => a.CoordenadorEmail);
    destCoords = destCoords.filter(c => emailsCoords.includes(c.Email));
  }

  if (p.destinatarios === 'Enviaram') {
    const enviados = assiduidades.filter(a => a.MesAno === mesAno).map(a => a.CoordenadorEmail);
    destCoords = destCoords.filter(c => enviados.includes(c.Email));
  } else if (p.destinatarios === 'Não enviaram') {
    const enviados = assiduidades.filter(a => a.MesAno === mesAno).map(a => a.CoordenadorEmail);
    destCoords = destCoords.filter(c => !enviados.includes(c.Email));
  }

  let count = 0;
  destCoords.forEach(coord => {
    try { sendEmail(coord.Email, '[SGA] Lembrete de Assiduidade', buildLembreteBody(p.mensagem, coord)); count++; } catch (e) {}
  });

  audit('Admin', email.split('@')[0], email, 'Enviar Lembrete Manual', `${count} destinatários · ${p.segmento || 'Todos'}`);
  return { ok: true, enviados: count };
}

// ── TRIGGER DIÁRIO ────────────────────────────────────────────
function dispararLembretesDiario() {
  const notifs = sheetRows('Notificacoes').filter(n => n.Ativo === true || n.Ativo === 'TRUE');
  const hoje   = new Date().getDate();
  notifs.forEach(n => {
    if (parseInt(n.Dia) !== hoje) return;
    sendLembreteManual({ destinatarios: n.Destinatarios, segmento: n.Segmento, mensagem: n.Mensagem }, 'sistema@sga');
  });
}

// ── AUDITORIA ─────────────────────────────────────────────────
function getAuditoria() { return sheetRows('Auditoria').reverse(); }

// ── INITIALIZER ───────────────────────────────────────────────
// ATENÇÃO: só cria abas que ainda não existem. Para aplicar novo schema,
// apague a aba correspondente no Sheets antes de rodar.
function initSheets() {
  const book = ss();
  const defs = {
    Coordenadores: ['ID','Nome','Email','CPF','Telefone','Status','DataCriacao','DriveFolder'],
    Editais:       ['ID','Numero','Ano','Titulo','Fomento','TipoInterno','Segmento','Bolsas','CusteioCapital','Status'],
    Acoes:         ['ID','Titulo','CoordenadorEmail','AnoExecucao','Segmento','EditalID','Status','DriveFolder'],
    Membros:       ['ID','Nome','Email','Status','DataCriacao','DriveFolder',
                    'DataNascimento','CPF','Telefone','Endereco','EmailPessoal',
                    'CursoID','Curso','Matricula','AnoSemestreIngresso','SemestreAtual','DataInicio',
                    'Banco','Agencia','Conta','TipoConta','Documentos'],
    Bolsistas:     ['ID','MembroID','AcaoID','CargaHoraria','EditalID','Status'],
    Voluntarios:   ['ID','MembroID','AcaoID','CargaHoraria','Status'],
    Cursos:        ['ID','Nome','Modalidade','Status'],
    Assiduidades:  ['ID','AcaoID','CoordenadorEmail','MesAno','Snapshot','Timestamp','ForaPrazo','Validado','ValidadoPor','TimestampValidacao'],
    Periodo:       ['DiaInicio','DiaFim'],
    Notificacoes:  ['ID','Dia','Destinatarios','Segmento','Mensagem','Ativo'],
    Auditoria:     ['Timestamp','Perfil','Nome','Email','Acao','Detalhe']
  };

  Object.entries(defs).forEach(([name, headers]) => {
    let sh = book.getSheetByName(name);
    if (!sh) {
      sh = book.insertSheet(name);
      sh.appendRow(headers);
      sh.getRange(1, 1, 1, headers.length).setBackground('#50679c').setFontColor('#fff').setFontWeight('bold');
    }
  });

  const periodoSh = book.getSheetByName('Periodo');
  if (periodoSh && periodoSh.getLastRow() < 2) periodoSh.appendRow([25, 10]);
}

// ── MAIN HANDLER ──────────────────────────────────────────────
function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const { action, token } = data;

    let userEmail = null;
    let userInfo  = null;

    if (token) {
      const result = verifyGoogleToken(token);
      if (!result.valid) return respond({ error: 'Token inválido ou expirado. Faça login novamente.' });
      userEmail = result.email;
      userInfo  = result;
    }

    switch (action) {
      case 'getRole': return respond(getRole(userEmail));

      // Coordenadores
      case 'getCoordenadores':        return respond(getCoordenadores());
      case 'addCoordenador':          return respond(addCoordenador(data.payload, userEmail));
      case 'updateCoordenador':       return respond(updateCoordenador(data.payload, userEmail));
      case 'toggleCoordenador':       return respond(toggleStatus('Coordenadores', data.id, data.status, userEmail));
      case 'deleteCoordenador':       return respond(deleteCoordenador(data.id, userEmail));
      case 'updatePerfilCoordenador': return respond(updatePerfilCoordenador(userEmail, data.payload));

      // Editais
      case 'getEditais':   return respond(getEditais());
      case 'addEdital':    return respond(addEdital(data.payload, userEmail));
      case 'updateEdital': return respond(updateEdital(data.id, data.payload, userEmail));
      case 'toggleEdital': return respond(toggleStatus('Editais', data.id, data.status, userEmail));
      case 'deleteEdital': return respond(deleteEdital(data.id, userEmail));

      // Ações
      case 'getAcoes':   return respond(getAcoes());
      case 'addAcao':    return respond(addAcao(data.payload, userEmail));
      case 'updateAcao': return respond(updateAcao(data.id, data.payload, userEmail));
      case 'toggleAcao': return respond(toggleStatus('Acoes', data.id, data.status, userEmail));
      case 'deleteAcao': return respond(deleteAcao(data.id, userEmail));

      // Membros
      case 'getMembros':         return respond(getMembros());
      case 'addMembro':          return respond(addMembro(data.payload, userEmail));
      case 'updateMembro':       return respond(updateMembro(data.id, data.payload, userEmail));
      case 'toggleMembro':       return respond(toggleStatus('Membros', data.id, data.status, userEmail));
      case 'deleteMembro':       return respond(deleteMembro(data.id, userEmail));
      case 'getPerfilMembro':    return respond(getPerfilMembro(userEmail));
      case 'updatePerfilMembro': return respond(updatePerfilMembro(userEmail, data.payload));

      // Bolsistas
      case 'getBolsistas':   return respond(getBolsistas());
      case 'addBolsista':    return respond(addBolsista(data.payload, userEmail));
      case 'updateBolsista': return respond(updateBolsista(data.id, data.payload, userEmail));
      case 'toggleBolsista': return respond(toggleStatus('Bolsistas', data.id, data.status, userEmail));
      case 'deleteBolsista': return respond(deleteBolsista(data.id, userEmail));

      // Voluntários
      case 'getVoluntarios':   return respond(getVoluntarios());
      case 'addVoluntario':    return respond(addVoluntario(data.payload, userEmail));
      case 'updateVoluntario': return respond(updateVoluntario(data.id, data.payload, userEmail));
      case 'toggleVoluntario': return respond(toggleStatus('Voluntarios', data.id, data.status, userEmail));
      case 'deleteVoluntario': return respond(deleteVoluntario(data.id, userEmail));

      // Cursos
      case 'getCursos':   return respond(getCursos());
      case 'addCurso':    return respond(addCurso(data.payload, userEmail));
      case 'updateCurso': return respond(updateCurso(data.id, data.payload, userEmail));
      case 'toggleCurso': return respond(toggleStatus('Cursos', data.id, data.status, userEmail));
      case 'deleteCurso': return respond(deleteCurso(data.id, userEmail));

      // Assiduidade
      case 'enviarAssiduidade':  return respond(enviarAssiduidade(userEmail, userInfo, data.payload));
      case 'getAssiduidades':    return respond(getAssiduidades(userEmail, data.filters));
      case 'validarAssiduidade': return respond(validarAssiduidade(userEmail, data.id));

      // Período
      case 'getPeriodo': return respond(getPeriodo());
      case 'setPeriodo': return respond(setPeriodo(data.payload, userEmail));

      // Notificações
      case 'getNotificacoes':   return respond(getNotificacoes());
      case 'addNotificacao':    return respond(addNotificacao(data.payload, userEmail));
      case 'updateNotificacao': return respond(updateNotificacao(data.id, data.payload, userEmail));
      case 'deleteNotificacao': return respond(deleteNotificacao(data.id, userEmail));
      case 'sendLembrete':      return respond(sendLembreteManual(data.payload, userEmail));

      // Documentos
      case 'uploadDocumento': return respond(uploadDocumento(userEmail, data.payload));

      // Auditoria
      case 'getAuditoria': return respond(getAuditoria());

      default: return respond({ error: 'Ação desconhecida: ' + action });
    }
  } catch (err) {
    console.error(err);
    return respond({ error: 'Erro interno: ' + err.toString() });
  }
}

function doGet(e) {
  return respond({ ok: true, message: 'SGA Backend Online' });
}
