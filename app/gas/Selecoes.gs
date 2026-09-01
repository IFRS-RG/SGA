// ============================================================
// SGA — Seleção (processo seletivo)
// Uma seleção referencia um Edital → uma Ação → as VAGAS ofertadas
// escolhidas. A avaliação de candidatos é etapa posterior.
// Reusa ACAO_READERS / ACAO_WRITERS (Acoes.gs) e _assertSegmentoAcao.
// ============================================================

// Ações de um edital que têm vagas ABERTAS (para escolher na nova seleção).
function getAcoesComVagas(editalId, email) {
  requirePerfil(email, ACAO_READERS);
  const vagas = sheetRows('SelVagas');
  return sheetRows('Acoes')
    .filter(a => String(a.EditalID) === String(editalId))
    .map(a => ({
      acaoId: a.ID, titulo: a.Titulo, segmento: a.Segmento,
      vagas: vagas.filter(v => String(v.AcaoID) === String(a.ID) && String(v.Status) === 'Aberta')
        .map(v => ({ ID: v.ID, Titulo: v.Titulo, Tipo: v.Tipo }))
    }))
    .filter(a => a.vagas.length);
}

function getSelecoes(email) {
  const info = requirePerfil(email, ACAO_READERS);
  const acoes = sheetRows('Acoes');
  const editais = sheetRows('Editais');
  const vagas = sheetRows('SelVagas');
  return sheetRows('Selecoes').map(s => {
    const a = acoes.find(x => String(x.ID) === String(s.AcaoID));
    const e = editais.find(x => String(x.ID) === String(s.EditalID));
    let vids = []; try { vids = JSON.parse(s.VagasJSON || '[]'); } catch (err) {}
    const vgs = vagas.filter(v => vids.map(String).indexOf(String(v.ID)) !== -1)
      .map(v => ({ ID: v.ID, Titulo: v.Titulo, Tipo: v.Tipo }));
    return {
      ID: s.ID, EditalID: s.EditalID, AcaoID: s.AcaoID, Status: s.Status,
      editalLabel: e ? _editalLabel(e) : '', acaoTitulo: a ? a.Titulo : '',
      segmento: a ? a.Segmento : '', vagas: vgs
    };
  }).filter(s => info.role === 'Admin' || info.segmento === 'Todos' || String(s.segmento) === String(info.segmento));
}

function addSelecao(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(p.acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  const vagas = Array.isArray(p.vagas) ? p.vagas.map(String) : [];
  if (!vagas.length) throw userError('Escolha ao menos uma vaga ofertada.');
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  getSheet('Selecoes').appendRow([id, p.editalId || acao.EditalID, p.acaoId,
    JSON.stringify(vagas), STATUS_VAGA.indexOf(p.status) !== -1 ? p.status : 'Aberta', nowBR(), email]);
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function deleteSelecao(id, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const s = sheetRows('Selecoes').find(x => String(x.ID) === String(id));
  if (!s) throw userError('Seleção não encontrada.');
  const a = sheetRows('Acoes').find(x => String(x.ID) === String(s.AcaoID));
  if (a) _assertSegmentoAcao(info, a.Segmento);
  getSheet('Selecoes').deleteRow(findRowIndex('Selecoes', id));
  return { ok: true };
}
