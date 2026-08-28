// ============================================================
// SGA — Cliente da API (chama o Web App do Apps Script)
// ============================================================
async function gasCall(action, extra = {}) {
  const token = getIdToken();
  const body  = JSON.stringify({ action, token, ...extra });
  if (typeof progressStart === 'function') progressStart();

  let resp;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    try {
      resp = await fetch(SGA_CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS no GAS
        body,
        signal: ctrl.signal
      });
    } catch (e) {
      throw new Error(e.name === 'AbortError'
        ? 'O servidor demorou demais para responder (timeout).'
        : 'Falha de conexão com o servidor.');
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data && data.error) {
      // Sessão expirada → volta pro login.
      if (/sess[aã]o inv[aá]lida|expirada/i.test(data.error)) { logout(); }
      throw new Error(data.error);
    }
    return data;
  } finally {
    if (typeof progressDone === 'function') progressDone();
  }
}

const API = {
  getRole: () => gasCall('getRole'),

  // Editais
  getEditais:   ()            => gasCall('getEditais'),
  addEdital:    (payload, reqId) => gasCall('addEdital',   { payload, reqId }),
  updateEdital: (id, payload)    => gasCall('updateEdital', { id, payload }),
  deleteEdital: (id)             => gasCall('deleteEdital', { id }),
  cloneEdital:  (id, reqId)      => gasCall('cloneEdital',  { id, reqId }),

  // Documentos de edital
  getEditalDocs:      (editalId) => gasCall('getEditalDocs',      { editalId }),
  getEditalFolderUrl: (editalId) => gasCall('getEditalFolderUrl', { editalId }),
  uploadEditalDoc: (payload)     => gasCall('uploadEditalDoc', { payload }),
  deleteEditalDoc: (docId)       => gasCall('deleteEditalDoc', { docId }),
  renameEditalDoc: (docId, nome) => gasCall('renameEditalDoc', { docId, nome }),

  // Participantes — Servidores
  getServidores:  ()                => gasCall('getServidores'),
  getServidor:    (id)              => gasCall('getServidor', { id }),
  addServidor:    (payload, reqId)  => gasCall('addServidor', { payload, reqId }),
  updateServidor: (id, payload)     => gasCall('updateServidor', { id, payload }),
  deleteServidor: (id)              => gasCall('deleteServidor', { id }),

  // Participantes — Alunos
  getAlunos:  ()                => gasCall('getAlunos'),
  getAluno:   (id)              => gasCall('getAluno', { id }),
  addAluno:   (payload, reqId)  => gasCall('addAluno', { payload, reqId }),
  updateAluno:(id, payload)     => gasCall('updateAluno', { id, payload }),
  deleteAluno:(id)              => gasCall('deleteAluno', { id }),

  // Ações
  getAcoes:   ()               => gasCall('getAcoes'),
  getAcao:    (id)             => gasCall('getAcao', { id }),
  addAcao:    (payload, reqId) => gasCall('addAcao', { payload, reqId }),
  updateAcao: (id, payload)    => gasCall('updateAcao', { id, payload }),
  deleteAcao: (id)             => gasCall('deleteAcao', { id }),
  getAcaoDocs:   (acaoId)      => gasCall('getAcaoDocs', { acaoId }),
  uploadAcaoDoc: (payload)     => gasCall('uploadAcaoDoc', { payload }),
  deleteAcaoDoc: (docId)       => gasCall('deleteAcaoDoc', { docId }),
  renameAcaoDoc: (docId, nome) => gasCall('renameAcaoDoc', { docId, nome }),
  getBolsistas:   (acaoId)        => gasCall('getBolsistas', { acaoId }),
  addBolsista:    (payload, reqId) => gasCall('addBolsista', { payload, reqId }),
  updateBolsista: (id, payload)    => gasCall('updateBolsista', { id, payload }),
  deleteBolsista: (id)             => gasCall('deleteBolsista', { id }),
  uploadBolsistaRelatorio: (id, payload) => gasCall('uploadBolsistaRelatorio', { id, payload }),
  getVoluntarios:   (acaoId)        => gasCall('getVoluntarios', { acaoId }),
  addVoluntario:    (payload, reqId) => gasCall('addVoluntario', { payload, reqId }),
  updateVoluntario: (id, payload)    => gasCall('updateVoluntario', { id, payload }),
  deleteVoluntario: (id)             => gasCall('deleteVoluntario', { id }),
  uploadVoluntarioRelatorio: (id, payload) => gasCall('uploadVoluntarioRelatorio', { id, payload }),
  getColaboradores:   (acaoId)          => gasCall('getColaboradores', { acaoId }),
  addColaborador:     (payload, reqId)  => gasCall('addColaborador', { payload, reqId }),
  updateColaborador:  (id, payload)     => gasCall('updateColaborador', { id, payload }),
  deleteColaborador:  (id)              => gasCall('deleteColaborador', { id }),

  getAcaoFinanceiro:  (acaoId)          => gasCall('getAcaoFinanceiro', { acaoId }),
  saveAcaoFinanceiro: (acaoId, payload) => gasCall('saveAcaoFinanceiro', { acaoId, payload }),
  addDespesa:    (payload, reqId) => gasCall('addDespesa', { payload, reqId }),
  updateDespesa: (id, payload)    => gasCall('updateDespesa', { id, payload }),
  deleteDespesa: (id)             => gasCall('deleteDespesa', { id }),
  addBem:    (payload, reqId) => gasCall('addBem', { payload, reqId }),
  updateBem: (id, payload)    => gasCall('updateBem', { id, payload }),
  deleteBem: (id)             => gasCall('deleteBem', { id }),
  gerarBensDaDespesa: (acaoId) => gasCall('gerarBensDaDespesa', { acaoId }),
  uploadBemAnexo: (id, payload) => gasCall('uploadBemAnexo', { id, payload }),
  addAlteracao:    (payload, reqId) => gasCall('addAlteracao', { payload, reqId }),
  updateAlteracao: (id, payload)    => gasCall('updateAlteracao', { id, payload }),
  deleteAlteracao: (id)             => gasCall('deleteAlteracao', { id }),

  // Financeiro
  getFinanceiro:    (tipo, refId)          => gasCall('getFinanceiro', { tipo, refId }),
  revealFinanceiro: (tipo, refId)          => gasCall('revealFinanceiro', { tipo, refId }),
  saveFinanceiro:   (tipo, refId, payload) => gasCall('saveFinanceiro', { tipo, refId, payload }),

  // Certificados
  getCertificados:  ()               => gasCall('getCertificados'),
  getPessoasDaAcao: (acaoId)         => gasCall('getPessoasDaAcao', { acaoId }),
  getCertificadosDaAcao:   (acaoId)  => gasCall('getCertificadosDaAcao', { acaoId }),
  getCertificadosDaPessoa: (tipo, id) => gasCall('getCertificadosDaPessoa', { tipo, id }),
  addCertificado:   (payload, reqId) => gasCall('addCertificado', { payload, reqId }),
  deleteCertificado:(id)             => gasCall('deleteCertificado', { id }),

  // Parâmetros (gestão)
  getParametros: ()        => gasCall('getParametros'),
  setParametros: (payload) => gasCall('setParametros', { payload }),

  // Auditoria
  getAuditoria: () => gasCall('getAuditoria'),

  // Cursos
  getCursos:   ()               => gasCall('getCursos'),
  addCurso:    (payload)        => gasCall('addCurso', { payload }),
  updateCurso: (id, payload)    => gasCall('updateCurso', { id, payload }),
  deleteCurso: (id)             => gasCall('deleteCurso', { id }),

  // Admin — perfis de acesso
  getPerfis:    ()               => gasCall('getPerfis'),
  addPerfil:    (payload)        => gasCall('addPerfil',    { payload }),
  updatePerfil: (email, payload) => gasCall('updatePerfil', { email, payload }),
  deletePerfil: (email)          => gasCall('deletePerfil', { email })
};
