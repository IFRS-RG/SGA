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
  return {
    modalidade: modal,
    cursos: cursos,                                   // 'todos' | ['id', ...]
    periodoMin: String(r.periodoMin || '').trim(),
    situacao: String(r.situacao || '').trim(),
    assistencia: !!r.assistencia,
    condicoesOutros: String(r.condicoesOutros || '').trim(),
    outrosFormais: String(r.outrosFormais || '').trim()
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

function _vagaOut(v) {
  let req = {}, crit = [];
  try { req = JSON.parse(v.RequisitosJSON || '{}'); } catch (e) {}
  try { crit = JSON.parse(v.CriteriosJSON || '[]'); } catch (e) {}
  return {
    ID: v.ID, Tipo: v.Tipo, Titulo: v.Titulo, CH: v.CH, Quantidade: v.Quantidade,
    Status: v.Status, requisitos: req, criterios: crit
  };
}

function getVagas(acaoId, email) {
  requirePerfil(email, ACAO_READERS);
  return sheetRows('SelVagas').filter(v => String(v.AcaoID) === String(acaoId)).map(_vagaOut);
}

function _validaVaga(p) {
  if (TIPO_VAGA.indexOf(p.tipo) === -1) throw userError('Tipo de vaga inválido.');
  if (!String(p.titulo || '').trim()) throw userError('Informe o título da vaga.');
  if (p.tipo === 'Bolsista' && CH_BOLSA_VAGA.indexOf(String(p.ch)) === -1) {
    throw userError('Para bolsista, a CH deve ser 4, 8, 12 ou 16.');
  }
  const qtd = Number(p.quantidade);
  if (!(qtd >= 1)) throw userError('Quantidade de vagas deve ser ao menos 1.');
}

function _vagaRow(id, p, criadoEm, criadoPor) {
  const ch = p.tipo === 'Bolsista' ? String(p.ch) : (Number(p.ch) || 0);
  return [id, p.acaoId, p.tipo, String(p.titulo).trim(), ch, Number(p.quantidade) || 0,
    JSON.stringify(_selRequisitos(p.requisitos)), JSON.stringify(_selCriterios(p.criterios)),
    STATUS_VAGA.indexOf(p.status) !== -1 ? p.status : 'Aberta', criadoEm, criadoPor];
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
