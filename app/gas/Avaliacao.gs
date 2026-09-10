// ============================================================
// SGA — Avaliação dos inscritos (na aba Seleção de bolsistas da ação)
// O coordenador lança nota por critério (soma ponderada), marca
// requisitos/habilidades (atende/não), anexa a ata (PDF por candidato)
// e define a situação. "Indicar" ranqueia por nota (Selecionado/Suplente).
// Tudo INTERNO ao SGA (não vai ao portal).
// ============================================================

// Inscritos de todas as vagas de uma ação.
function getInscritosDaAcao(acaoId, email) {
  const info = requirePerfil(email, ACAO_READERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  const vagaIds = sheetRows('SelVagas').filter(v => String(v.AcaoID) === String(acaoId)).map(v => String(v.ID));
  return sheetRows('Inscricoes').filter(i => vagaIds.indexOf(String(i.VagaID)) !== -1).map(i => {
    let notas = {}, check = {};
    try { notas = JSON.parse(i.NotasJSON || '{}'); } catch (e) {}
    try { check = JSON.parse(i.ChecklistJSON || '{}'); } catch (e) {}
    return {
      ID: i.ID, vagaId: i.VagaID, selecaoId: i.SelecaoID, nome: i.CandidatoNome, matricula: i.Matricula,
      curso: i.Curso, email: i.Email, faixaCH: i.FaixaCH, dataInscricao: i.DataInscricao,
      notas: notas, notaFinal: i.NotaFinal, situacao: i.Situacao || 'Inscrito', checklist: check, ataUrl: i.AtaUrl || ''
    };
  });
}

// Localiza a inscrição + a vaga + a ação (e valida segmento).
function _inscContexto(id, info) {
  const insc = sheetRows('Inscricoes').find(x => String(x.ID) === String(id));
  if (!insc) throw userError('Inscrição não encontrada.');
  const vaga = sheetRows('SelVagas').find(v => String(v.ID) === String(insc.VagaID));
  const acao = vaga ? sheetRows('Acoes').find(a => String(a.ID) === String(vaga.AcaoID)) : null;
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  return { insc: insc, vaga: vaga, acao: acao };
}

// Salva nota por critério (recalcula nota final = soma ponderada), checklist e situação.
function saveAvaliacao(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const ctx = _inscContexto(id, info);
  const idx = findRowIndex('Inscricoes', id);
  const sh = getSheet('Inscricoes');
  const C = COL.Inscricoes;

  let criterios = [];
  if (ctx.vaga) { try { criterios = JSON.parse(ctx.vaga.CriteriosJSON || '[]'); } catch (e) {} }
  const notas = (p.notas && typeof p.notas === 'object') ? p.notas : {};
  let nf = 0;
  criterios.forEach((c, i) => { const n = Number(notas[i]); if (!isNaN(n)) nf += n * (Number(c.peso) || 0); });
  nf = Math.round(nf * 100) / 100;

  const situ = SITUACAO_INSCRICAO.indexOf(p.situacao) !== -1 ? p.situacao : (ctx.insc.Situacao || 'Inscrito');
  sh.getRange(idx, C.NotasJSON + 1).setValue(JSON.stringify(notas));
  sh.getRange(idx, C.NotaFinal + 1).setValue(nf);
  sh.getRange(idx, C.ChecklistJSON + 1).setValue(JSON.stringify(p.checklist || {}));
  sh.getRange(idx, C.Situacao + 1).setValue(situ);
  return { ok: true, notaFinal: nf };
}

// Ata de avaliação (PDF por candidato) na subpasta "Avaliações" da ação.
function uploadAtaAvaliacao(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const ctx = _inscContexto(id, info);
  if (!ctx.acao) throw userError('Ação da inscrição não encontrada.');
  const idx = findRowIndex('Inscricoes', id);
  const sh = getSheet('Inscricoes');
  const C = COL.Inscricoes;
  if (ctx.insc.AtaFileId) { try { DriveApp.getFileById(ctx.insc.AtaFileId).setTrashed(true); } catch (e) {} }
  if (p && p.remove) { sh.getRange(idx, C.AtaFileId + 1, 1, 2).setValues([['', '']]); return { ok: true, removed: true }; }
  const bytes = Utilities.base64Decode(p.base64);
  if (!_isPdf(bytes)) throw userError('A ata deve ser um PDF válido.');
  const folder = _childFolder(_acaoFolder(ctx.acao), 'Avaliações');
  const nome = ('Ata - ' + (ctx.insc.CandidatoNome || ctx.insc.Matricula || id)).replace(/[\\/:*?"<>|]/g, '-') + '.pdf';
  const file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', nome));
  sh.getRange(idx, C.AtaFileId + 1, 1, 2).setValues([[file.getId(), file.getUrl()]]);
  return { ok: true, url: file.getUrl() };
}

// Curso (nome) → CursoID cadastrado (para pré-cadastrar o aluno).
function _cursoIdPorNome(nome) {
  if (!nome) return '';
  const c = sheetRows('Cursos').find(x => String(x.Nome).trim().toLowerCase() === String(nome).trim().toLowerCase());
  return c ? c.ID : '';
}

// Garante o aluno em Participantes (casa por matrícula; cria "pré-cadastro" se não existir).
function _garantirAluno(insc, email) {
  const mat = String(insc.Matricula || '').trim();
  const existente = mat ? sheetRows('Alunos').find(x => String(x.Matricula).trim() === mat) : null;
  if (existente) return { id: existente.ID, novo: false };
  const id = genId();
  const C = COL.Alunos;
  const row = new Array(HEADERS.Alunos.length).fill('');
  row[C.ID] = id;
  row[C.Nome] = String(insc.CandidatoNome || '').trim();
  row[C.Matricula] = mat;
  row[C.CursoID] = _cursoIdPorNome(insc.Curso);
  row[C.Email] = String(insc.Email || '').trim();
  row[C.Status] = 'Ativo';
  row[C.CriadoEm] = nowBR();
  row[C.CriadoPor] = email + ' (seleção)';
  getSheet('Alunos').appendRow(row);
  return { id: id, novo: true };
}

// Aprovação final da vaga (Gestor): promove os SELECIONADOS a Bolsista/Voluntário
// e garante o cadastro em Participantes. Idempotente (não duplica ao reaprovar).
function aprovarVaga(vagaId, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const vaga = sheetRows('SelVagas').find(v => String(v.ID) === String(vagaId));
  if (!vaga) throw userError('Vaga não encontrada.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(vaga.AcaoID));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  const edital = sheetRows('Editais').find(e => String(e.ID) === String(acao.EditalID));
  const selec = sheetRows('Inscricoes').filter(i => String(i.VagaID) === String(vagaId) && String(i.Situacao) === 'Selecionado');
  if (!selec.length) throw userError('Nenhum candidato "Selecionado" nesta vaga. Ajuste as situações (ou use "Indicar por nota") antes de aprovar.');

  const bolsRows = sheetRows('AcaoBolsistas');
  const volRows = sheetRows('AcaoVoluntarios');
  let promovidos = 0, jaExistiam = 0, novosAlunos = 0;

  selec.forEach(insc => {
    const al = _garantirAluno(insc, email);
    if (al.novo) novosAlunos++;
    if (vaga.Tipo === 'Bolsista') {
      if (bolsRows.some(b => String(b.AcaoID) === String(acao.ID) && String(b.AlunoID) === String(al.id))) { jaExistiam++; return; }
      const ch = insc.FaixaCH || vaga.CH;
      const valor = _valorBolsaEdital(edital, ch, acao.Segmento);
      const C = COL.AcaoBolsistas;
      const row = new Array(HEADERS.AcaoBolsistas.length).fill('');
      row[C.ID] = genId(); row[C.AcaoID] = acao.ID; row[C.AlunoID] = al.id; row[C.EditalBolsaID] = acao.EditalID || '';
      row[C.CHBolsa] = ch; row[C.ValorBolsa] = (valor !== '' && valor != null) ? valor : '';
      row[C.StatusSIGAA] = 'Não cadastrado'; row[C.StatusRelatorio] = 'Não entregue'; row[C.Status] = 'Ativo';
      row[C.Observacoes] = 'Promovido da seleção'; row[C.CriadoEm] = nowBR(); row[C.CriadoPor] = email;
      getSheet('AcaoBolsistas').appendRow(row); promovidos++;
    } else {
      if (volRows.some(v => String(v.AcaoID) === String(acao.ID) && String(v.AlunoID) === String(al.id))) { jaExistiam++; return; }
      const ch = insc.FaixaCH || vaga.CH;
      const C = COL.AcaoVoluntarios;
      const row = new Array(HEADERS.AcaoVoluntarios.length).fill('');
      row[C.ID] = genId(); row[C.AcaoID] = acao.ID; row[C.AlunoID] = al.id; row[C.CHVoluntariado] = ch;
      row[C.StatusSIGAA] = 'Não cadastrado'; row[C.StatusRelatorio] = 'Não entregue'; row[C.Status] = 'Ativo';
      row[C.Observacoes] = 'Promovido da seleção'; row[C.CriadoEm] = nowBR(); row[C.CriadoPor] = email;
      getSheet('AcaoVoluntarios').appendRow(row); promovidos++;
    }
  });
  return { ok: true, promovidos: promovidos, jaExistiam: jaExistiam, novosAlunos: novosAlunos, total: selec.length, tipo: vaga.Tipo };
}

// Indicação automática por nota: N primeiros (N = posições da vaga) = Selecionado; demais = Suplente.
function indicarVaga(vagaId, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const vaga = sheetRows('SelVagas').find(v => String(v.ID) === String(vagaId));
  if (!vaga) throw userError('Vaga não encontrada.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(vaga.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  let faixas = []; try { faixas = JSON.parse(vaga.FaixasJSON || '[]'); } catch (e) {}
  const N = faixas.reduce((s, f) => s + (Number(f.quantidade) || 0), 0) || Number(vaga.Quantidade) || 1;
  const sh = getSheet('Inscricoes');
  const data = sh.getDataRange().getValues();
  const C = COL.Inscricoes;
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][C.VagaID]) === String(vagaId)) rows.push({ r: i + 1, nf: Number(data[i][C.NotaFinal]) || 0 });
  }
  rows.sort((a, b) => b.nf - a.nf);
  rows.forEach((row, i) => { sh.getRange(row.r, C.Situacao + 1).setValue(i < N ? 'Selecionado' : 'Suplente'); });
  return { ok: true, indicados: Math.min(N, rows.length), total: rows.length };
}
