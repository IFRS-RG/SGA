// ============================================================
// SGA — Configuração do Frontend
// Preencha após o deploy do Apps Script e a criação do OAuth Client ID.
// ============================================================
const SGA_CONFIG = {
  // URL do Web App do Apps Script (Implantar → Nova implantação → App da Web).
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzg4caIsA2shh3jc7oFWKulZ1eXvbXQBoVLep-GKUrizICDi5ZuPo7j7QbdPVzXcbndRQ/exec',

  // OAuth Client ID (Google Cloud Console → Credenciais → ID do cliente OAuth).
  GOOGLE_CLIENT_ID: '417258387995-5979idejok5shddicb8skm120bv67rbj.apps.googleusercontent.com',

  // Rótulos usados na interface.
  APP_NAME: 'SGA',
  APP_FULL: 'Sistema de Gestão de Ações — IFRS Campus Rio Grande'
};

// Listas compartilhadas com o backend.
const SEGMENTOS        = ['Ensino', 'Pesquisa', 'Extensão', 'Indissociável', 'Conjunto'];
const SEGMENTOS_BASE   = ['Ensino', 'Pesquisa', 'Extensão', 'Indissociável'];
const TIPOS_DOC        = ['Edital', 'Retificação', 'Anexo', 'Demais publicações'];
const PERFIS           = ['Admin', 'Gestor', 'Visualizador'];
const SEGMENTOS_ACESSO = ['Todos', 'Ensino', 'Pesquisa', 'Extensão', 'Indissociável'];

const ORIGEM_EDITAL = ['IFRS-RG', 'PROEN', 'PROEX', 'PROPPI'];
const TIPO_FOMENTO = {
  'Ensino': ['PAIEN'], 'Pesquisa': ['AIPCTI'], 'Extensão': ['PAIEX'], 'Indissociável': ['PAIIND']
};
const TIPO_BOLSA = {
  'Ensino': ['PIBEN'],
  'Pesquisa': ['PIBIC', 'PIBIC-Af', 'PIBIC-EM', 'PROBIC', 'PIBITI', 'PROBITI'],
  'Extensão': ['PIBEX'], 'Indissociável': ['PIBIND']
};
const CH_VALOR = { '4': 175, '8': 350, '12': 525, '16': 700 };
