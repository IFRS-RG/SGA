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
const PERFIS           = ['Admin', 'Gestor', 'Visualizador', 'Financeiro'];
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

// Participantes.
const VINCULOS_SERVIDOR = [
  'Docente Efetivo', 'Docente Substituto', 'Docente Temporário', 'Docente Visitante',
  'Docente Cedido', 'TAE Efetivo', 'TAE Cedido'
];
const STATUS_PARTICIPANTE = ['Ativo', 'Inativo'];
const MODALIDADES_CURSO = ['Integrado', 'Concomitante', 'Subsequente', 'Superior', 'Especialização', 'FIC'];

// Financeiro.
const TIPO_CONTA = ['Corrente', 'Poupança'];
const PIX_TIPO   = ['CPF', 'E-mail', 'Telefone', 'Aleatória'];
// Lista curada de bancos (código COMPE - nome). Ajuste conforme necessário.
const BANCOS = [
  '001 - Banco do Brasil', '033 - Santander', '104 - Caixa Econômica Federal',
  '237 - Bradesco', '341 - Itaú Unibanco', '260 - Nubank (Nu Pagamentos)',
  '077 - Banco Inter', '336 - Banco C6', '212 - Banco Original',
  '756 - Sicoob', '748 - Sicredi', '085 - Ailos', '655 - Banco Votorantim',
  '422 - Banco Safra', '070 - BRB', '021 - Banestes', '389 - Banco Mercantil',
  '318 - Banco BMG', '208 - Banco BTG Pactual', '323 - Mercado Pago',
  '290 - PagBank (PagSeguro)', '380 - PicPay', '000 - Outro'
];
