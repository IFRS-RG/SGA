// ============================================================
// SGA — Parâmetros ajustáveis pela gestão (aba Parametros, chave/valor)
// ============================================================

function _param(chave, def) {
  const r = sheetRows('Parametros').find(p => String(p.Chave) === String(chave));
  if (!r || r.Valor === '' || r.Valor == null) return def;
  return r.Valor;
}

function _paramNum(chave, def) {
  const n = Number(_param(chave, def));
  return isNaN(n) ? def : n;
}

function _setParam(chave, valor) {
  const sh = getSheet('Parametros');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(chave)) { sh.getRange(i + 1, 2).setValue(valor); return; }
  }
  sh.appendRow([chave, valor]);
}

// Só Admin lê/edita os parâmetros.
function getParametros(email) {
  requirePerfil(email, ['Admin']);
  return { limiteOrcamentos: _paramNum('LIMITE_TRES_ORCAMENTOS', LIMITE_ORCAMENTOS_PADRAO) };
}

function setParametros(payload, email) {
  requirePerfil(email, ['Admin']);
  const lim = Number(payload.limiteOrcamentos);
  if (isNaN(lim) || lim < 0) throw userError('Valor do limite inválido.');
  _setParam('LIMITE_TRES_ORCAMENTOS', lim);
  return { ok: true };
}
