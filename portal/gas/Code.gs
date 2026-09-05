// ============================================================
// Portal do Aluno — Roteador (Web App)
// Toda chamada valida o token @aluno antes de qualquer coisa.
// ============================================================

function doGet() {
  return _resp({ ok: true, service: 'SGA Portal Aluno', time: _now() });
}

const WRITE_ACTIONS = ['inscrever', 'cancelar'];

function doPost(e) {
  let lock = null;
  try {
    const data = JSON.parse(e.postData.contents);
    const v = verifyAlunoToken(data.token);
    if (!v.valid) {
      return _resp({
        error: v.notAluno
          ? 'Acesso permitido apenas para contas ' + ALUNO_DOMAIN + '.'
          : 'Sessão inválida ou expirada. Faça login novamente.'
      });
    }

    if (WRITE_ACTIONS.indexOf(data.action) >= 0) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(15000)) return _resp({ error: 'Servidor ocupado, tente novamente.' });
    }

    switch (data.action) {
      case 'getVagas':  return _resp(getVagas());
      case 'getCursos': return _resp(getCursos());
      case 'getMinhas': return _resp(getMinhas(v.email));
      case 'inscrever': return _resp(inscrever(v.email, v.nome, data.payload));
      case 'cancelar':  return _resp(cancelar(v.email, data.payload));
      default:          return _resp({ error: 'Ação desconhecida.' });
    }
  } catch (err) {
    if (err && err.userFacing) return _resp({ error: err.message });
    console.error(err && err.stack ? err.stack : String(err));
    return _resp({ error: 'Ocorreu um erro ao processar sua solicitação. Tente novamente.' });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e2) {} }
  }
}
