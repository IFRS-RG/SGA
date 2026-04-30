// ============================================================
// SGA — API Client (chama o GAS Web App)
// ============================================================

async function gasCall(action, extra = {}) {
  const token = getIdToken();
  const body  = JSON.stringify({ action, token, ...extra });

  const resp = await fetch(SGA_CONFIG.GAS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' }, // avoids CORS preflight on GAS
    body
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

const API = {
  getRole: () => gasCall('getRole'),

  // Coordenadores
  getCoordenadores:        ()            => gasCall('getCoordenadores'),
  addCoordenador:          (payload)     => gasCall('addCoordenador', { payload }),
  updateCoordenador:       (payload)     => gasCall('updateCoordenador', { payload }),
  toggleCoordenador:       (id, status)  => gasCall('toggleCoordenador', { id, status }),
  deleteCoordenador:       (id)          => gasCall('deleteCoordenador', { id }),
  updatePerfilCoordenador: (payload)     => gasCall('updatePerfilCoordenador', { payload }),

  // Editais
  getEditais:    ()            => gasCall('getEditais'),
  addEdital:     (payload)     => gasCall('addEdital', { payload }),
  updateEdital:  (id, payload) => gasCall('updateEdital', { id, payload }),
  toggleEdital:  (id, status)  => gasCall('toggleEdital', { id, status }),
  deleteEdital:  (id)          => gasCall('deleteEdital', { id }),

  // Ações
  getAcoes:    ()            => gasCall('getAcoes'),
  addAcao:     (payload)     => gasCall('addAcao', { payload }),
  updateAcao:  (id, payload) => gasCall('updateAcao', { id, payload }),
  toggleAcao:  (id, status)  => gasCall('toggleAcao', { id, status }),
  deleteAcao:  (id)          => gasCall('deleteAcao', { id }),

  // Membros
  getMembros:         ()            => gasCall('getMembros'),
  addMembro:          (payload)     => gasCall('addMembro', { payload }),
  updateMembro:       (id, payload) => gasCall('updateMembro', { id, payload }),
  toggleMembro:       (id, status)  => gasCall('toggleMembro', { id, status }),
  deleteMembro:       (id)          => gasCall('deleteMembro', { id }),
  getPerfilMembro:    ()            => gasCall('getPerfilMembro'),
  updatePerfilMembro: (payload)     => gasCall('updatePerfilMembro', { payload }),

  // Bolsistas
  getBolsistas:   ()            => gasCall('getBolsistas'),
  addBolsista:    (payload)     => gasCall('addBolsista', { payload }),
  updateBolsista: (id, payload) => gasCall('updateBolsista', { id, payload }),
  toggleBolsista: (id, status)  => gasCall('toggleBolsista', { id, status }),
  deleteBolsista: (id)          => gasCall('deleteBolsista', { id }),

  // Voluntários
  getVoluntarios:   ()            => gasCall('getVoluntarios'),
  addVoluntario:    (payload)     => gasCall('addVoluntario', { payload }),
  updateVoluntario: (id, payload) => gasCall('updateVoluntario', { id, payload }),
  toggleVoluntario: (id, status)  => gasCall('toggleVoluntario', { id, status }),
  deleteVoluntario: (id)          => gasCall('deleteVoluntario', { id }),

  // Cursos
  getCursos:    ()            => gasCall('getCursos'),
  addCurso:     (payload)     => gasCall('addCurso', { payload }),
  updateCurso:  (id, payload) => gasCall('updateCurso', { id, payload }),
  toggleCurso:  (id, status)  => gasCall('toggleCurso', { id, status }),
  deleteCurso:  (id)          => gasCall('deleteCurso', { id }),

  // Assiduidade
  enviarAssiduidade:  (payload) => gasCall('enviarAssiduidade', { payload }),
  getAssiduidades:    (filters) => gasCall('getAssiduidades', { filters }),
  validarAssiduidade: (id)      => gasCall('validarAssiduidade', { id }),

  // Período
  getPeriodo:  ()        => gasCall('getPeriodo'),
  setPeriodo:  (payload) => gasCall('setPeriodo', { payload }),

  // Notificações
  getNotificacoes:   ()            => gasCall('getNotificacoes'),
  addNotificacao:    (payload)     => gasCall('addNotificacao', { payload }),
  updateNotificacao: (id, payload) => gasCall('updateNotificacao', { id, payload }),
  deleteNotificacao: (id)          => gasCall('deleteNotificacao', { id }),
  sendLembrete:      (payload)     => gasCall('sendLembrete', { payload }),

  // Documentos
  uploadDocumento: (payload)          => gasCall('uploadDocumento', { payload }),
  uploadSIGAA:     (acaoId, payload)  => gasCall('uploadSIGAA', { acaoId, payload }),

  // Desligamento / Substituição / Aprovação
  desligarParticipante:   (tipo, id, obs)                       => gasCall('desligarParticipante',   { tipo, id, obs }),
  substituirParticipante: (tipo, id, obs, novoNome, novoEmail)  => gasCall('substituirParticipante', { tipo, id, obs, novoNome, novoEmail }),
  aprovarMembro:          (membroId)                            => gasCall('aprovarMembro',          { membroId }),

  // Auditoria
  getAuditoria: () => gasCall('getAuditoria')
};
