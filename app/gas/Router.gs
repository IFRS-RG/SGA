// ============================================================
// SGA — Roteador (Web App)
// Ponto de entrada. Todas as chamadas do frontend passam por doPost.
// ============================================================

function doGet() {
  return respond({ ok: true, service: 'SGA API', time: isoNow() });
}

// Ações que ESCREVEM (serializadas via LockService).
const WRITE_ACTIONS = ['addEdital', 'updateEdital', 'deleteEdital', 'cloneEdital',
  'uploadEditalDoc', 'deleteEditalDoc', 'renameEditalDoc',
  'addPerfil', 'updatePerfil', 'deletePerfil',
  'addServidor', 'updateServidor', 'deleteServidor',
  'addAluno', 'updateAluno', 'deleteAluno',
  'addCurso', 'updateCurso', 'deleteCurso',
  'saveFinanceiro',
  'addAcao', 'updateAcao', 'deleteAcao',
  'uploadAcaoDoc', 'deleteAcaoDoc', 'renameAcaoDoc', 'uploadAcaoLogo',
  'addBolsista', 'updateBolsista', 'deleteBolsista', 'uploadBolsistaRelatorio',
  'addVoluntario', 'updateVoluntario', 'deleteVoluntario', 'uploadVoluntarioRelatorio',
  'saveAcaoFinanceiro', 'addDespesa', 'updateDespesa', 'deleteDespesa',
  'addBem', 'updateBem', 'deleteBem', 'gerarBensDaDespesa', 'uploadBemAnexo',
  'addAlteracao', 'updateAlteracao', 'deleteAlteracao',
  'setParametros',
  'addCertificado', 'deleteCertificado',
  'addColaborador', 'updateColaborador', 'deleteColaborador',
  'addVaga', 'updateVaga', 'deleteVaga',
  'addSelecao', 'updateSelecao', 'deleteSelecao',
  'addComissao', 'updateComissao', 'deleteComissao', 'setComissaoCamaras'];

function doPost(e) {
  let lock = null;
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // Autenticação: valida o id_token do Google.
    let userEmail = null;
    if (data.token) {
      const v = verifyGoogleToken(data.token);
      if (!v.valid) return respond({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
      userEmail = v.email;
    }

    // Serializa as escritas para evitar corrupção por requisições concorrentes.
    if (WRITE_ACTIONS.indexOf(action) >= 0) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) return respond({ error: 'Servidor ocupado, tente novamente.' });
    }

    switch (action) {
      // ── Sessão ──
      case 'getRole':
        return respond(getRole(userEmail));

      // ── Editais ──
      case 'getEditais':
        return respond(getEditais(userEmail));
      case 'addEdital':
        return respond(addEdital(data.payload, userEmail, data.reqId));
      case 'updateEdital':
        return respond(updateEdital(data.id, data.payload, userEmail));
      case 'deleteEdital':
        return respond(deleteEdital(data.id, userEmail));
      case 'cloneEdital':
        return respond(cloneEdital(data.id, userEmail, data.reqId));

      // ── Documentos de edital ──
      case 'getEditalDocs':
        return respond(getEditalDocs(data.editalId, userEmail));
      case 'getEditalFolderUrl':
        return respond(getEditalFolderUrl(data.editalId, userEmail));
      case 'uploadEditalDoc':
        return respond(uploadEditalDoc(data.payload, userEmail));
      case 'deleteEditalDoc':
        return respond(deleteEditalDoc(data.docId, userEmail));
      case 'renameEditalDoc':
        return respond(renameEditalDoc(data.docId, data.nome, userEmail));

      // ── Participantes (Servidores / Alunos) ──
      case 'getServidores':
        return respond(getServidores(userEmail));
      case 'getServidor':
        return respond(getServidor(data.id, userEmail));
      case 'addServidor':
        return respond(addServidor(data.payload, userEmail, data.reqId));
      case 'updateServidor':
        return respond(updateServidor(data.id, data.payload, userEmail));
      case 'deleteServidor':
        return respond(deleteServidor(data.id, userEmail));
      case 'getAlunos':
        return respond(getAlunos(userEmail));
      case 'getAluno':
        return respond(getAluno(data.id, userEmail));
      case 'addAluno':
        return respond(addAluno(data.payload, userEmail, data.reqId));
      case 'updateAluno':
        return respond(updateAluno(data.id, data.payload, userEmail));
      case 'deleteAluno':
        return respond(deleteAluno(data.id, userEmail));

      // ── Financeiro (segregado; acesso por camada + auditoria) ──
      case 'getFinanceiro':
        return respond(getFinanceiro(data.tipo, data.refId, userEmail));
      case 'revealFinanceiro':
        return respond(revealFinanceiro(data.tipo, data.refId, userEmail));
      case 'saveFinanceiro':
        return respond(saveFinanceiro(data.tipo, data.refId, data.payload, userEmail));

      // ── Ações ──
      case 'getAcoes':
        return respond(getAcoes(userEmail));
      case 'getAcao':
        return respond(getAcao(data.id, userEmail));
      case 'addAcao':
        return respond(addAcao(data.payload, userEmail, data.reqId));
      case 'updateAcao':
        return respond(updateAcao(data.id, data.payload, userEmail));
      case 'deleteAcao':
        return respond(deleteAcao(data.id, userEmail));
      case 'getAcaoDocs':
        return respond(getAcaoDocs(data.acaoId, userEmail));
      case 'uploadAcaoDoc':
        return respond(uploadAcaoDoc(data.payload, userEmail));
      case 'deleteAcaoDoc':
        return respond(deleteAcaoDoc(data.docId, userEmail));
      case 'renameAcaoDoc':
        return respond(renameAcaoDoc(data.docId, data.nome, userEmail));
      case 'uploadAcaoLogo':
        return respond(uploadAcaoLogo(data.id, data.payload, userEmail));
      case 'getBolsistas':
        return respond(getBolsistas(data.acaoId, userEmail));
      case 'addBolsista':
        return respond(addBolsista(data.payload, userEmail, data.reqId));
      case 'updateBolsista':
        return respond(updateBolsista(data.id, data.payload, userEmail));
      case 'deleteBolsista':
        return respond(deleteBolsista(data.id, userEmail));
      case 'uploadBolsistaRelatorio':
        return respond(uploadBolsistaRelatorio(data.id, data.payload, userEmail));
      case 'getVoluntarios':
        return respond(getVoluntarios(data.acaoId, userEmail));
      case 'addVoluntario':
        return respond(addVoluntario(data.payload, userEmail, data.reqId));
      case 'updateVoluntario':
        return respond(updateVoluntario(data.id, data.payload, userEmail));
      case 'deleteVoluntario':
        return respond(deleteVoluntario(data.id, userEmail));
      case 'uploadVoluntarioRelatorio':
        return respond(uploadVoluntarioRelatorio(data.id, data.payload, userEmail));
      case 'getColaboradores':
        return respond(getColaboradores(data.acaoId, userEmail));
      case 'addColaborador':
        return respond(addColaborador(data.payload, userEmail, data.reqId));
      case 'updateColaborador':
        return respond(updateColaborador(data.id, data.payload, userEmail));
      case 'deleteColaborador':
        return respond(deleteColaborador(data.id, userEmail));

      // ── Seleção de bolsistas (vagas) ──
      case 'getVagas':
        return respond(getVagas(data.acaoId, userEmail));
      case 'addVaga':
        return respond(addVaga(data.payload, userEmail, data.reqId));
      case 'updateVaga':
        return respond(updateVaga(data.id, data.payload, userEmail));
      case 'deleteVaga':
        return respond(deleteVaga(data.id, userEmail));

      // ── Seleção (processo seletivo) ──
      case 'getVagasAtivas':
        return respond(getVagasAtivas(data.exceptId, userEmail));
      case 'getSelecoes':
        return respond(getSelecoes(userEmail));
      case 'getSelecao':
        return respond(getSelecao(data.id, userEmail));
      case 'addSelecao':
        return respond(addSelecao(data.payload, userEmail, data.reqId));
      case 'updateSelecao':
        return respond(updateSelecao(data.id, data.payload, userEmail));
      case 'deleteSelecao':
        return respond(deleteSelecao(data.id, userEmail));

      // ── Comissões (CGAE/CAGPPI/CAGE/CIEP) ──
      case 'getComissoes':
        return respond(getComissoes(userEmail));
      case 'addComissao':
        return respond(addComissao(data.payload, userEmail, data.reqId));
      case 'updateComissao':
        return respond(updateComissao(data.id, data.payload, userEmail));
      case 'deleteComissao':
        return respond(deleteComissao(data.id, userEmail));
      case 'setComissaoCamaras':
        return respond(setComissaoCamaras(data.id, data.camaras, userEmail));

      case 'getAcaoFinanceiro':
        return respond(getAcaoFinanceiro(data.acaoId, userEmail));
      case 'saveAcaoFinanceiro':
        return respond(saveAcaoFinanceiro(data.acaoId, data.payload, userEmail));
      case 'addDespesa':
        return respond(addDespesa(data.payload, userEmail, data.reqId));
      case 'updateDespesa':
        return respond(updateDespesa(data.id, data.payload, userEmail));
      case 'deleteDespesa':
        return respond(deleteDespesa(data.id, userEmail));
      case 'addBem':
        return respond(addBem(data.payload, userEmail, data.reqId));
      case 'updateBem':
        return respond(updateBem(data.id, data.payload, userEmail));
      case 'deleteBem':
        return respond(deleteBem(data.id, userEmail));
      case 'gerarBensDaDespesa':
        return respond(gerarBensDaDespesa(data.acaoId, userEmail));
      case 'uploadBemAnexo':
        return respond(uploadBemAnexo(data.id, data.payload, userEmail));
      case 'addAlteracao':
        return respond(addAlteracao(data.payload, userEmail, data.reqId));
      case 'updateAlteracao':
        return respond(updateAlteracao(data.id, data.payload, userEmail));
      case 'deleteAlteracao':
        return respond(deleteAlteracao(data.id, userEmail));

      // ── Certificados ──
      case 'getCertificados':
        return respond(getCertificados(userEmail));
      case 'getPessoasDaAcao':
        return respond(getPessoasDaAcao(data.acaoId, userEmail));
      case 'getCertificadosDaAcao':
        return respond(getCertificadosDaAcao(data.acaoId, userEmail));
      case 'getCertificadosDaPessoa':
        return respond(getCertificadosDaPessoa(data.tipo, data.id, userEmail));
      case 'addCertificado':
        return respond(addCertificado(data.payload, userEmail, data.reqId));
      case 'deleteCertificado':
        return respond(deleteCertificado(data.id, userEmail));

      // ── Parâmetros (só Admin) ──
      case 'getParametros':
        return respond(getParametros(userEmail));
      case 'setParametros':
        return respond(setParametros(data.payload, userEmail));

      // ── Auditoria (só Admin) ──
      case 'getAuditoria':
        return respond(getAuditoria(userEmail));

      // ── Cursos (cadastro no Admin; usado no form de Aluno) ──
      case 'getCursos':
        return respond(getCursos(userEmail));
      case 'addCurso':
        return respond(addCurso(data.payload, userEmail));
      case 'updateCurso':
        return respond(updateCurso(data.id, data.payload, userEmail));
      case 'deleteCurso':
        return respond(deleteCurso(data.id, userEmail));

      // ── Admin: perfis de acesso ──
      case 'getPerfis':
        return respond(getPerfis(userEmail));
      case 'addPerfil':
        return respond(addPerfil(data.payload, userEmail));
      case 'updatePerfil':
        return respond(updatePerfil(data.email, data.payload, userEmail));
      case 'deletePerfil':
        return respond(deletePerfil(data.email, userEmail));

      default:
        return respond({ error: 'Ação desconhecida: ' + action });
    }
  } catch (err) {
    // Erros marcados como "exibíveis" (validação/permissão) vão para o usuário.
    if (err && err.userFacing) return respond({ error: err.message });
    // Erros inesperados: registra o detalhe no log (Stackdriver) e devolve
    // uma mensagem genérica, sem vazar internals ao cliente.
    console.error(err && err.stack ? err.stack : String(err));
    return respond({ error: 'Ocorreu um erro ao processar sua solicitação. Tente novamente.' });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) {} }
  }
}
