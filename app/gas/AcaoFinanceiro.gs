// ============================================================
// SGA — Ações · Financeiro estruturado (E1: Plano + Despesas)
// Aberto (sem LGPD): valores e itens de compra da ação.
// ============================================================

function _num2(v) { if (v === '' || v == null) return 0; return Number(v) || 0; }

// Classificação custeio/capital padrão pelo tipo (Art. 3º da IN).
function _classifPorTipo(tipo) {
  return tipo === 'Material permanente' ? 'Capital' : 'Custeio';
}

// ── Cabeçalho (Plano + totais) — 1 linha por ação, chave = AcaoID ──
function getAcaoFinanceiro(acaoId, email) {
  requirePerfil(email, ACAO_READERS);
  const h = sheetRows('AcaoFinanceiro').find(r => String(r.AcaoID) === String(acaoId)) || {};
  const despesas = sheetRows('AcaoDespesas').filter(d => String(d.AcaoID) === String(acaoId)).map(d => ({
    ID: d.ID, Descricao: d.Descricao, Tipo: d.Tipo, Classificacao: d.Classificacao,
    DataCompra: _dateStr(d.DataCompra), Fornecedor: d.Fornecedor, NumDocFiscal: d.NumDocFiscal,
    ValorUnitario: d.ValorUnitario, Qtd: d.Qtd, ValorTotal: d.ValorTotal
  }));
  const utilizado = despesas.reduce((s, d) => s + _num2(d.ValorTotal), 0);
  return {
    unidadeExecucao: h.UnidadeExecucao || '',
    custeioPrevisto: h.CusteioPrevisto === undefined ? '' : h.CusteioPrevisto,
    capitalPrevisto: h.CapitalPrevisto === undefined ? '' : h.CapitalPrevisto,
    valorRecebido:   h.ValorRecebido === undefined ? '' : h.ValorRecebido,
    valorDevolvido:  h.ValorDevolvido === undefined ? '' : h.ValorDevolvido,
    valorUtilizado:  utilizado,
    despesas: despesas
  };
}

// Upsert do cabeçalho (plano/totais).
function saveAcaoFinanceiro(acaoId, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  const row = [
    acaoId, String(p.unidadeExecucao || '').trim(),
    _num2(p.custeioPrevisto), _num2(p.capitalPrevisto), _num2(p.valorRecebido), _num2(p.valorDevolvido),
    nowBR(), email
  ];
  const idx = findRowIndex('AcaoFinanceiro', acaoId);
  if (idx === -1) getSheet('AcaoFinanceiro').appendRow(row);
  else {
    // Preserva CriadoEm/CriadoPor originais.
    const old = getSheet('AcaoFinanceiro').getRange(idx, 1, 1, HEADERS.AcaoFinanceiro.length).getValues()[0];
    row[COL.AcaoFinanceiro.CriadoEm] = old[COL.AcaoFinanceiro.CriadoEm] || nowBR();
    row[COL.AcaoFinanceiro.CriadoPor] = old[COL.AcaoFinanceiro.CriadoPor] || email;
    getSheet('AcaoFinanceiro').getRange(idx, 1, 1, row.length).setValues([row]);
  }
  return { ok: true };
}

// ── Despesas (Anexo III) ──────────────────────────────────────
function _validaDespesa(p) {
  if (!String(p.descricao || '').trim()) throw userError('Descrição é obrigatória.');
  if (p.tipo && TIPO_DESPESA.indexOf(p.tipo) === -1) throw userError('Tipo de despesa inválido.');
  if (p.classificacao && CLASSIF_DESPESA.indexOf(p.classificacao) === -1) throw userError('Classificação inválida.');
}

function _despesaRow(id, p, criadoEm, criadoPor) {
  const unit = _num2(p.valorUnitario);
  const qtd = _num2(p.qtd);
  const classif = p.classificacao || _classifPorTipo(p.tipo);
  return [
    id, p.acaoId, String(p.descricao || '').trim(), p.tipo || '', classif,
    _dateStr(p.dataCompra), String(p.fornecedor || '').trim(), String(p.numDocFiscal || '').trim(),
    unit, qtd, unit * qtd, criadoEm, criadoPor
  ];
}

function addDespesa(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(p.acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  _validaDespesa(p);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  getSheet('AcaoDespesas').appendRow(_despesaRow(id, p, nowBR(), email));
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateDespesa(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const idx = findRowIndex('AcaoDespesas', id);
  if (idx === -1) throw userError('Despesa não encontrada.');
  const sh = getSheet('AcaoDespesas');
  const old = sh.getRange(idx, 1, 1, HEADERS.AcaoDespesas.length).getValues()[0];
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(old[COL.AcaoDespesas.AcaoID]));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  p.acaoId = old[COL.AcaoDespesas.AcaoID];
  _validaDespesa(p);
  const row = _despesaRow(id, p, old[COL.AcaoDespesas.CriadoEm], old[COL.AcaoDespesas.CriadoPor]);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteDespesa(id, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const d = sheetRows('AcaoDespesas').find(x => String(x.ID) === String(id));
  if (!d) throw userError('Despesa não encontrada.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(d.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  getSheet('AcaoDespesas').deleteRow(findRowIndex('AcaoDespesas', id));
  return { ok: true };
}
