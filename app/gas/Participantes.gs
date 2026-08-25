// ============================================================
// SGA — Módulo Participantes (Servidores e Alunos)
// FATIA 1: leitura minimizada (identidade/contato). CPF, banco e PIX ficam
// em store segregado (ServidoresFinanceiro/AlunosFinanceiro) e chegam na F3,
// com camadas de acesso + auditoria. Ver diretriz de PII/LGPD do projeto.
// ============================================================

// Quem PODE LER a lista de participantes (identidade). Dado financeiro terá
// regra própria e mais restrita na F3 (Admin + Financeiro).
const PARTICIPANTES_READERS = ['Admin', 'Gestor', 'Visualizador', 'Financeiro'];
// Quem pode CRIAR/EDITAR participante (identidade) — definido na F2.
const PARTICIPANTES_WRITERS = ['Admin', 'Gestor'];

// Nome de exibição: usa o nome social quando preenchido (padrão respeitoso em
// telas internas). O nome CIVIL fica disponível à parte para documentos
// legais/financeiros (regra de nome social entra na geração de documentos).
function _nomeExib(rec) {
  const social = String(rec.NomeSocial || '').trim();
  return social || String(rec.Nome || '');
}

function _parseVinculo(v) {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}

// ── Servidores ────────────────────────────────────────────────
// Retorno MINIMIZADO: só identidade/contato não sensível — nada de CPF/banco.
function getServidores(email) {
  requirePerfil(email, PARTICIPANTES_READERS);
  return sheetRows('Servidores').map(r => ({
    ID:      r.ID,
    Nome:    _nomeExib(r),
    SIAPE:   r.SIAPE || '',
    vinculo: _parseVinculo(r.VinculoJSON),
    Email:   r.Email || '',
    Telefone: r.Telefone || '',
    WhatsApp: r.WhatsApp === true || r.WhatsApp === 'TRUE' || r.WhatsApp === 'Sim',
    Status:  r.Status || ''
  }));
}

// ── Alunos ────────────────────────────────────────────────────
// Retorno MINIMIZADO. DataNascimento/idade e CPF NÃO entram na lista (F3/F4).
function getAlunos(email) {
  requirePerfil(email, PARTICIPANTES_READERS);
  return sheetRows('Alunos').map(r => ({
    ID:        r.ID,
    Nome:      _nomeExib(r),
    Matricula: r.Matricula || '',
    CursoID:   r.CursoID || '',
    Email:     r.Email || '',
    Telefone:  r.Telefone || '',
    WhatsApp:  r.WhatsApp === true || r.WhatsApp === 'TRUE' || r.WhatsApp === 'Sim',
    Status:    r.Status || ''
  }));
}

// ============================================================
// FATIA 2 — Cadastro/edição de identidade (sem CPF/banco, que são F3)
// ============================================================

function _email_ok(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim()); }
function _pbool(v) { return v === true || v === 'true' || v === 'Sim' || v === 'on' || v === 1; }
function _pstatus(s) { return STATUS_PARTICIPANTE.indexOf(s) >= 0 ? s : 'Ativo'; }

// ── Servidores: escrita ───────────────────────────────────────
function _validaServidor(p) {
  if (!String(p.nome || '').trim()) throw userError('Nome é obrigatório.');
  if (!_email_ok(p.email)) throw userError('E-mail inválido.');
  if (p.siape && !/^\d{3,}$/.test(String(p.siape).replace(/\D/g, ''))) {
    throw userError('SIAPE inválido (apenas números).');
  }
  (Array.isArray(p.vinculo) ? p.vinculo : []).forEach(v => {
    if (VINCULOS_SERVIDOR.indexOf(v) === -1) throw userError('Vínculo inválido: ' + v);
  });
}

function _servidorRow(id, p, criadoEm, criadoPor) {
  const vin = (Array.isArray(p.vinculo) ? p.vinculo : []).filter(v => VINCULOS_SERVIDOR.indexOf(v) >= 0);
  return [
    id,
    String(p.nome || '').trim(),
    String(p.nomeSocial || '').trim(),
    _pbool(p.usarNomeSocialDocs),
    String(p.siape || '').replace(/\D/g, ''),
    JSON.stringify(vin),
    String(p.email || '').trim().toLowerCase(),
    String(p.telefone || '').trim(),
    _pbool(p.whatsapp),
    _pstatus(p.status),
    criadoEm, criadoPor
  ];
}

// Registro completo (identidade) para o formulário de edição — só quem escreve.
function getServidor(id, email) {
  requirePerfil(email, PARTICIPANTES_WRITERS);
  const r = sheetRows('Servidores').find(x => String(x.ID) === String(id));
  if (!r) throw userError('Servidor não encontrado.');
  return {
    ID: r.ID, nome: r.Nome, nomeSocial: r.NomeSocial,
    usarNomeSocialDocs: _pbool(r.UsarNomeSocialDocs),
    siape: r.SIAPE, vinculo: _parseVinculo(r.VinculoJSON),
    email: r.Email, telefone: r.Telefone, whatsapp: _pbool(r.WhatsApp),
    status: r.Status
  };
}

function addServidor(p, email, reqId) {
  requirePerfil(email, PARTICIPANTES_WRITERS);
  _validaServidor(p);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const alvoEmail = String(p.email || '').trim().toLowerCase();
  const siape = String(p.siape || '').replace(/\D/g, '');
  const existe = sheetRows('Servidores').some(r =>
    (siape && String(r.SIAPE) === siape) ||
    (alvoEmail && String(r.Email).toLowerCase() === alvoEmail));
  if (existe) throw userError('Já existe servidor com este SIAPE ou e-mail.');
  const id = genId();
  getSheet('Servidores').appendRow(_servidorRow(id, p, nowBR(), email));
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateServidor(id, p, email) {
  requirePerfil(email, PARTICIPANTES_WRITERS);
  _validaServidor(p);
  const idx = findRowIndex('Servidores', id);
  if (idx === -1) throw userError('Servidor não encontrado.');
  const sh = getSheet('Servidores');
  const old = sh.getRange(idx, 1, 1, HEADERS.Servidores.length).getValues()[0];
  const row = _servidorRow(id, p, old[COL.Servidores.CriadoEm], old[COL.Servidores.CriadoPor]);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteServidor(id, email) {
  requirePerfil(email, PARTICIPANTES_WRITERS);
  const idx = findRowIndex('Servidores', id);
  if (idx === -1) throw userError('Servidor não encontrado.');
  getSheet('Servidores').deleteRow(idx);
  return { ok: true };
}

// ── Alunos: escrita ───────────────────────────────────────────
function _validaAluno(p) {
  if (!String(p.nome || '').trim()) throw userError('Nome é obrigatório.');
  if (!String(p.matricula || '').trim()) throw userError('Matrícula é obrigatória.');
  if (p.email && !_email_ok(p.email)) throw userError('E-mail inválido.');
  if (p.dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(String(p.dataNascimento))) {
    throw userError('Data de nascimento inválida.');
  }
  if (p.cursoId && !sheetRows('Cursos').some(c => String(c.ID) === String(p.cursoId))) {
    throw userError('Curso selecionado não existe.');
  }
}

function _alunoRow(id, p, criadoEm, criadoPor) {
  return [
    id,
    String(p.nome || '').trim(),
    String(p.nomeSocial || '').trim(),
    _pbool(p.usarNomeSocialDocs),
    String(p.matricula || '').trim(),
    String(p.cursoId || '').trim(),
    String(p.dataNascimento || '').slice(0, 10),
    String(p.email || '').trim().toLowerCase(),
    String(p.telefone || '').trim(),
    _pbool(p.whatsapp),
    _pstatus(p.status),
    criadoEm, criadoPor
  ];
}

function getAluno(id, email) {
  requirePerfil(email, PARTICIPANTES_WRITERS);
  const r = sheetRows('Alunos').find(x => String(x.ID) === String(id));
  if (!r) throw userError('Aluno não encontrado.');
  return {
    ID: r.ID, nome: r.Nome, nomeSocial: r.NomeSocial,
    usarNomeSocialDocs: _pbool(r.UsarNomeSocialDocs),
    matricula: r.Matricula, cursoId: r.CursoID,
    dataNascimento: _dateStr(r.DataNascimento),
    email: r.Email, telefone: r.Telefone, whatsapp: _pbool(r.WhatsApp),
    status: r.Status
  };
}

function addAluno(p, email, reqId) {
  requirePerfil(email, PARTICIPANTES_WRITERS);
  _validaAluno(p);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const mat = String(p.matricula || '').trim().toLowerCase();
  if (sheetRows('Alunos').some(r => String(r.Matricula).trim().toLowerCase() === mat)) {
    throw userError('Já existe aluno com esta matrícula.');
  }
  const id = genId();
  getSheet('Alunos').appendRow(_alunoRow(id, p, nowBR(), email));
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateAluno(id, p, email) {
  requirePerfil(email, PARTICIPANTES_WRITERS);
  _validaAluno(p);
  const idx = findRowIndex('Alunos', id);
  if (idx === -1) throw userError('Aluno não encontrado.');
  const sh = getSheet('Alunos');
  const old = sh.getRange(idx, 1, 1, HEADERS.Alunos.length).getValues()[0];
  const row = _alunoRow(id, p, old[COL.Alunos.CriadoEm], old[COL.Alunos.CriadoPor]);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteAluno(id, email) {
  requirePerfil(email, PARTICIPANTES_WRITERS);
  const idx = findRowIndex('Alunos', id);
  if (idx === -1) throw userError('Aluno não encontrado.');
  getSheet('Alunos').deleteRow(idx);
  return { ok: true };
}
