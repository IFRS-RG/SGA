// ============================================================
// SGA — Ações · Seleção de bolsistas (VAGAS)
// Cada vaga carrega seus PRÓPRIOS requisitos (eliminatórios) e
// critérios (classificatórios, com peso). A avaliação de candidatos
// é etapa posterior (importação automática de outra planilha).
// ============================================================

const CH_BOLSA_VAGA = ['4', '8', '12', '16'];  // bolsista usa o menu (como no edital)

// Requisitos: normaliza para um objeto estável (não confia no cliente).
function _selRequisitos(r) {
  r = r || {};
  const modal = (Array.isArray(r.modalidade) ? r.modalidade : [])
    .filter(m => MODALIDADE_VAGA.indexOf(m) !== -1);
  let cursos = r.cursos;
  if (cursos !== 'todos') cursos = (Array.isArray(cursos) ? cursos.map(String) : []);
  const demais = (Array.isArray(r.demais) ? r.demais : []).map(d => ({
    requisito: String(d.requisito || '').trim(),
    comprovacao: String(d.comprovacao || '').trim()
  })).filter(d => d.requisito || d.comprovacao);
  return {
    modalidade: modal,
    cursos: cursos,                                   // 'todos' | ['id', ...]
    periodoMin: String(r.periodoMin || '').trim(),
    assistencia: !!r.assistencia,
    demais: demais
  };
}

// Critérios: array de { categoria, criterio, forma, peso }.
function _selCriterios(list) {
  return (Array.isArray(list) ? list : []).map(c => ({
    categoria: CATEGORIA_CRITERIO.indexOf(c.categoria) !== -1 ? c.categoria : 'Outros',
    criterio: String(c.criterio || '').trim(),
    forma: String(c.forma || '').trim(),
    peso: Number(c.peso) || 0
  })).filter(c => c.criterio || c.forma || c.peso);
}

// Faixas de CH/quantidade da vaga (uma vaga pode ofertar 4h e 8h, por ex.).
function _selFaixas(list, tipo) {
  return (Array.isArray(list) ? list : []).map(f => {
    let ch = tipo === 'Bolsista' ? String(f.ch) : (Number(f.ch) || 0);
    if (tipo === 'Bolsista' && CH_BOLSA_VAGA.indexOf(ch) === -1) ch = '';
    return { ch: ch, quantidade: Number(f.quantidade) || 0 };
  }).filter(f => f.quantidade >= 1 && f.ch !== '' && f.ch !== 0);
}

function _selHabilidades(h) {
  h = h || {};
  return { soft: String(h.soft || '').trim(), hard: String(h.hard || '').trim() };
}

function _vagaOut(v) {
  let req = {}, crit = [], faixas = [], hab = {};
  try { req = JSON.parse(v.RequisitosJSON || '{}'); } catch (e) {}
  try { crit = JSON.parse(v.CriteriosJSON || '[]'); } catch (e) {}
  try { faixas = JSON.parse(v.FaixasJSON || '[]'); } catch (e) {}
  try { hab = JSON.parse(v.HabilidadesJSON || '{}'); } catch (e) {}
  if (!faixas.length && v.CH !== '' && v.CH != null) faixas = [{ ch: v.CH, quantidade: Number(v.Quantidade) || 0 }];
  return {
    ID: v.ID, Tipo: v.Tipo, Titulo: v.Titulo, CH: v.CH, Quantidade: v.Quantidade,
    Status: v.Status, requisitos: req, criterios: crit, faixas: faixas, habilidades: _selHabilidades(hab)
  };
}

function getVagas(acaoId, email) {
  requirePerfil(email, ACAO_READERS);
  return sheetRows('SelVagas').filter(v => String(v.AcaoID) === String(acaoId)).map(_vagaOut);
}

function _validaVaga(p) {
  if (TIPO_VAGA.indexOf(p.tipo) === -1) throw userError('Tipo de vaga inválido.');
  if (!String(p.titulo || '').trim()) throw userError('Informe o título da vaga.');
  const faixas = _selFaixas(p.faixas, p.tipo);
  if (!faixas.length) throw userError(p.tipo === 'Bolsista'
    ? 'Adicione ao menos uma faixa (CH 4/8/12/16 + quantidade).'
    : 'Adicione ao menos uma faixa (horas + quantidade).');
  const soma = _selCriterios(p.criterios).reduce((s, c) => s + (Number(c.peso) || 0), 0);
  if (soma > PESO_MAXIMO_CRITERIOS + 0.0001) {
    throw userError('O somatório dos pesos dos critérios não pode passar de ' + PESO_MAXIMO_CRITERIOS.toFixed(1).replace('.', ',') + '.');
  }
}

function _vagaRow(id, p, criadoEm, criadoPor) {
  const faixas = _selFaixas(p.faixas, p.tipo);
  const chLegacy = faixas.length ? faixas[0].ch : '';
  const qtdTotal = faixas.reduce((s, f) => s + f.quantidade, 0);
  return [id, p.acaoId, p.tipo, String(p.titulo).trim(), chLegacy, qtdTotal,
    JSON.stringify(_selRequisitos(p.requisitos)), JSON.stringify(_selCriterios(p.criterios)),
    STATUS_VAGA.indexOf(p.status) !== -1 ? p.status : 'Aberta', criadoEm, criadoPor,
    JSON.stringify(faixas), JSON.stringify(_selHabilidades(p.habilidades))];
}

function addVaga(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(p.acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  _validaVaga(p);
  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };
  const id = genId();
  getSheet('SelVagas').appendRow(_vagaRow(id, p, nowBR(), email));
  _idempotentStore(reqId, id);
  return { ok: true, id: id };
}

function updateVaga(id, p, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const idx = findRowIndex('SelVagas', id);
  if (idx === -1) throw userError('Vaga não encontrada.');
  const sh = getSheet('SelVagas');
  const old = sh.getRange(idx, 1, 1, HEADERS.SelVagas.length).getValues()[0];
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(old[COL.SelVagas.AcaoID]));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  p.acaoId = old[COL.SelVagas.AcaoID];
  _validaVaga(p);
  const row = _vagaRow(id, p, old[COL.SelVagas.CriadoEm], old[COL.SelVagas.CriadoPor]);
  sh.getRange(idx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteVaga(id, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const v = sheetRows('SelVagas').find(x => String(x.ID) === String(id));
  if (!v) throw userError('Vaga não encontrada.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(v.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  getSheet('SelVagas').deleteRow(findRowIndex('SelVagas', id));
  return { ok: true };
}
