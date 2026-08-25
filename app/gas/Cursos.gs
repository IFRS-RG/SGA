// ============================================================
// SGA — Cursos (cadastro pelo Admin; usado no formulário de Aluno)
// ============================================================

// Leitura: qualquer perfil cadastrado (o form de Aluno precisa da lista).
function getCursos(email) {
  requirePerfil(email, PERFIS);
  return sheetRows('Cursos');
}

function addCurso(payload, email) {
  requirePerfil(email, ['Admin']);
  const nome = String(payload.nome || '').trim();
  if (!nome) throw userError('Nome do curso é obrigatório.');
  const dup = sheetRows('Cursos').some(c => String(c.Nome).trim().toLowerCase() === nome.toLowerCase());
  if (dup) throw userError('Já existe um curso com este nome.');
  const id = genId();
  getSheet('Cursos').appendRow([id, nome, String(payload.modalidade || '').trim(), 'Ativo']);
  return { ok: true, id: id };
}

function updateCurso(id, payload, email) {
  requirePerfil(email, ['Admin']);
  const idx = findRowIndex('Cursos', id);
  if (idx === -1) throw userError('Curso não encontrado.');
  const nome = String(payload.nome || '').trim();
  if (!nome) throw userError('Nome do curso é obrigatório.');
  const status = STATUS_PARTICIPANTE.indexOf(payload.status) >= 0 ? payload.status : 'Ativo';
  getSheet('Cursos').getRange(idx, 1, 1, HEADERS.Cursos.length)
    .setValues([[id, nome, String(payload.modalidade || '').trim(), status]]);
  return { ok: true };
}

function deleteCurso(id, email) {
  requirePerfil(email, ['Admin']);
  const idx = findRowIndex('Cursos', id);
  if (idx === -1) throw userError('Curso não encontrado.');
  // Bloqueia exclusão se houver aluno usando o curso (integridade).
  const emUso = sheetRows('Alunos').some(a => String(a.CursoID) === String(id));
  if (emUso) throw userError('Há aluno(s) vinculado(s) a este curso. Marque como Inativo em vez de excluir.');
  getSheet('Cursos').deleteRow(idx);
  return { ok: true };
}
