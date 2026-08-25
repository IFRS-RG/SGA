// ============================================================
// SGA — Trilha de auditoria
// Registra QUEM fez O QUÊ em QUAL alvo e QUANDO. Nunca grava o valor
// sensível (CPF/conta/PIX) — só a ação e o identificador do alvo.
// ============================================================

function audit(ator, papel, acao, alvo, detalhe) {
  try {
    getSheet('Auditoria').appendRow([
      isoNow(), ator || '', papel || '', acao || '', alvo || '', detalhe || ''
    ]);
  } catch (e) { /* auditoria nunca bloqueia a operação principal */ }
}

// Leitura da trilha — só Admin. Mais recentes primeiro.
function getAuditoria(email) {
  requirePerfil(email, ['Admin']);
  return sheetRows('Auditoria').reverse();
}
