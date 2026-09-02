// ============================================================
// SGA — Seleção (processo seletivo nomeado)
// Uma seleção tem NOME e agrega VAGAS ativas de QUALQUER ação/edital.
// Cada vaga só pode estar em UM processo. A avaliação de candidatos
// é etapa posterior. Reusa ACAO_READERS/ACAO_WRITERS (Acoes.gs).
// ============================================================

// Vagas já usadas em algum processo (exceto o que está sendo editado).
function _selUsadas(exceptId) {
  const usadas = {};
  sheetRows('Selecoes').forEach(s => {
    if (exceptId && String(s.ID) === String(exceptId)) return;
    let v = []; try { v = JSON.parse(s.VagasJSON || '[]'); } catch (e) {}
    v.forEach(id => { usadas[String(id)] = true; });
  });
  return usadas;
}

// Todas as vagas ABERTAS ainda não usadas em outro processo (Gestor: só do seu segmento).
function getVagasAtivas(exceptId, email) {
  const info = requirePerfil(email, ACAO_READERS);
  const acoes = sheetRows('Acoes');
  const editais = sheetRows('Editais');
  const usadas = _selUsadas(exceptId);
  return sheetRows('SelVagas')
    .filter(v => String(v.Status) === 'Aberta' && !usadas[String(v.ID)])
    .map(v => {
      const a = acoes.find(x => String(x.ID) === String(v.AcaoID));
      const e = a ? editais.find(x => String(x.ID) === String(a.EditalID)) : null;
      let faixas = []; try { faixas = JSON.parse(v.FaixasJSON || '[]'); } catch (er) {}
      const qtd = faixas.reduce((s, f) => s + (Number(f.quantidade) || 0), 0) || Number(v.Quantidade) || 0;
      return {
        ID: v.ID, Titulo: v.Titulo, Tipo: v.Tipo, quantidade: qtd,
        acaoId: v.AcaoID, acaoTitulo: a ? a.Titulo : '', editalId: a ? a.EditalID : '',
        editalLabel: e ? _editalLabel(e) : '(sem edital)', segmento: a ? a.Segmento : ''
      };
    })
    .filter(v => info.role === 'Admin' || info.segmento === 'Todos' || String(v.segmento) === String(info.segmento));
}

function getSelecoes(email) {
  const info = requirePerfil(email, ACAO_READERS);
  const acoes = sheetRows('Acoes');
  const vagas = sheetRows('SelVagas');
  return sheetRows('Selecoes').map(s => {
    let vids = []; try { vids = JSON.parse(s.VagasJSON || '[]'); } catch (e) {}
    const vgs = vids.map(id => {
      const v = vagas.find(x => String(x.ID) === String(id));
      if (!v) return null;
      const a = acoes.find(x => String(x.ID) === String(v.AcaoID));
      return { ID: v.ID, Titulo: v.Titulo, Tipo: v.Tipo, acaoId: v.AcaoID, acaoTitulo: a ? a.Titulo : '', segmento: a ? a.Segmento : '' };
    }).filter(Boolean);
    const acoesDist = {}; vgs.forEach(v => { if (v.acaoTitulo) acoesDist[v.acaoId] = v.acaoTitulo; });
    const segs = {}; vgs.forEach(v => { if (v.segmento) segs[v.segmento] = true; });
    return {
      ID: s.ID, Nome: s.Nome, Status: s.Status, vagas: vgs,
      acoes: Object.keys(acoesDist).map(k => acoesDist[k]), segmentos: Object.keys(segs)
    };
  }).filter(s => info.role === 'Admin' || info.segmento === 'Todos' || s.segmentos.indexOf(info.segmento) !== -1);
}

// Valida que as vagas existem, estão abertas, livres e (Gestor) do seu segmento.
function _assertVagasSelecionaveis(vagas, info, exceptId) {
  const usadas = _selUsadas(exceptId);
  const allV = sheetRows('SelVagas');
  const acoes = sheetRows('Acoes');
  vagas.forEach(id => {
    const v = allV.find(x => String(x.ID) === String(id));
    if (!v) throw userError('Uma das vagas escolhidas não existe mais.');
    if (usadas[String(id)]) throw userError('A vaga "' + v.Titulo + '" já está em outro processo seletivo.');
    const a = acoes.find(x => String(x.ID) === String(v.AcaoID));
    if (a && !(info.role === 'Admin' || info.segmento === 'Todos' || String(a.Segmento) === String(info.segmento))) {
      throw userError('Você só pode incluir vagas do seu segmento (' + info.segmento + ').');
    }
  });
}

// Valor da bolsa do edital pela CH (casando o segmento quando a linha tiver).
function _valorBolsaEdital(editalRow, ch, segmento) {
  if (!editalRow) return '';
  let bolsas = []; try { bolsas = JSON.parse(editalRow.BolsasJSON || '[]'); } catch (e) {}
  let line = bolsas.find(b => String(b.ch) === String(ch) && b.segmento && b.segmento === segmento);
  if (!line) line = bolsas.find(b => String(b.ch) === String(ch));
  return line ? line.valor : '';
}

// Detalhe do processo: vagas completas (requisitos/critérios/faixas) + inscritos.
function getSelecao(id, email) {
  const info = requirePerfil(email, ACAO_READERS);
  const s = sheetRows('Selecoes').find(x => String(x.ID) === String(id));
  if (!s) throw userError('Seleção não encontrada.');
  const acoes = sheetRows('Acoes');
  const editais = sheetRows('Editais');
  const cursos = sheetRows('Cursos');
  const allVagas = sheetRows('SelVagas');
  const inscricoes = sheetRows('Inscricoes');
  const cursoNome = {}; cursos.forEach(c => { cursoNome[String(c.ID)] = c.Nome; });

  let vids = []; try { vids = JSON.parse(s.VagasJSON || '[]'); } catch (e) {}
  const segset = {};
  const vagas = vids.map(vid => {
    const vrow = allVagas.find(x => String(x.ID) === String(vid));
    if (!vrow) return null;
    const out = _vagaOut(vrow);
    const a = acoes.find(x => String(x.ID) === String(vrow.AcaoID));
    const e = a ? editais.find(x => String(x.ID) === String(a.EditalID)) : null;
    out.acaoId = vrow.AcaoID; out.acaoTitulo = a ? a.Titulo : '';
    out.segmento = a ? a.Segmento : ''; out.editalLabel = e ? _editalLabel(e) : '';
    // Valor da bolsa por faixa (só bolsista), puxado do edital pela CH.
    if (out.Tipo === 'Bolsista') {
      (out.faixas || []).forEach(f => { f.valor = _valorBolsaEdital(e, f.ch, out.segmento); });
    }
    // Nomes de curso para exibir nos requisitos.
    out.cursosNomes = (out.requisitos && Array.isArray(out.requisitos.cursos))
      ? out.requisitos.cursos.map(cid => cursoNome[String(cid)] || cid) : [];
    if (out.segmento) segset[out.segmento] = true;
    out.inscritos = inscricoes
      .filter(x => String(x.SelecaoID) === String(id) && String(x.VagaID) === String(vid))
      .map(x => ({
        nome: x.CandidatoNome, matricula: x.Matricula, curso: cursoNome[String(x.Curso)] || x.Curso,
        email: x.Email, faixaCH: x.FaixaCH, dataInscricao: x.DataInscricao,
        notaFinal: x.NotaFinal, situacao: x.Situacao
      }));
    return out;
  }).filter(Boolean);

  if (!(info.role === 'Admin' || info.segmento === 'Todos') && vagas.length && Object.keys(segset).indexOf(info.segmento) === -1) {
    throw userError('Você não tem acesso a esta seleção.');
  }
  const totalInscritos = vagas.reduce((t, v) => t + v.inscritos.length, 0);
  return { ID: s.ID, Nome: s.Nome, Status: s.Status, vagas: vagas, totalInscritos: totalInscritos };
}

function addSelecao(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const nome = String(p.nome || '').trim();
  if (!nome) throw userError('Informe o nome do processo seletivo.');
  const vagas = Array.isArray(p.vagas) ? p.vagas.map(String) : [];
  if (!vagas.length) throw userError('Escolha ao menos uma vaga ativa.');
  _assertVagasSelecionaveis(vagas, info, null);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  getSheet('Selecoes').appendRow([id, nome, JSON.stringify(vagas),
    STATUS_VAGA.indexOf(p.status) !== -1 ? p.status : 'Aberta', nowBR(), email]);
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateSelecao(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const idx = findRowIndex('Selecoes', id);
  if (idx === -1) throw userError('Seleção não encontrada.');
  const sh = getSheet('Selecoes');
  const old = sh.getRange(idx, 1, 1, HEADERS.Selecoes.length).getValues()[0];
  const nome = String(p.nome || '').trim();
  if (!nome) throw userError('Informe o nome do processo seletivo.');
  const vagas = Array.isArray(p.vagas) ? p.vagas.map(String) : [];
  if (!vagas.length) throw userError('Escolha ao menos uma vaga ativa.');
  _assertVagasSelecionaveis(vagas, info, id);
  const row = [id, nome, JSON.stringify(vagas),
    STATUS_VAGA.indexOf(p.status) !== -1 ? p.status : old[COL.Selecoes.Status],
    old[COL.Selecoes.CriadoEm], old[COL.Selecoes.CriadoPor]];
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteSelecao(id, email) {
  requirePerfil(email, ACAO_WRITERS);
  const s = sheetRows('Selecoes').find(x => String(x.ID) === String(id));
  if (!s) throw userError('Seleção não encontrada.');
  getSheet('Selecoes').deleteRow(findRowIndex('Selecoes', id));
  return { ok: true };
}
