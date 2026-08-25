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
// Bancos nacionais (nome + código COMPE). O select mostra só o nome; o código
// preenche o campo ao lado. "Outro" (último) libera nome e código para digitar.
const BANCOS = [
  { nome: 'Banco do Brasil', codigo: '001' },
  { nome: 'Banco da Amazônia', codigo: '003' },
  { nome: 'Banco do Nordeste', codigo: '004' },
  { nome: 'Banestes', codigo: '021' },
  { nome: 'Santander', codigo: '033' },
  { nome: 'Banpará', codigo: '037' },
  { nome: 'Banrisul', codigo: '041' },
  { nome: 'Banese', codigo: '047' },
  { nome: 'BRB - Banco de Brasília', codigo: '070' },
  { nome: 'Banco Inter', codigo: '077' },
  { nome: 'Banco Topázio', codigo: '082' },
  { nome: 'Uniprime', codigo: '084' },
  { nome: 'Ailos', codigo: '085' },
  { nome: 'Credisis', codigo: '097' },
  { nome: 'Caixa Econômica Federal', codigo: '104' },
  { nome: 'Banco Agibank', codigo: '121' },
  { nome: 'Unicred', codigo: '136' },
  { nome: 'Stone', codigo: '197' },
  { nome: 'Banco BTG Pactual', codigo: '208' },
  { nome: 'Banco Original', codigo: '212' },
  { nome: 'Banco BS2', codigo: '218' },
  { nome: 'Bradesco', codigo: '237' },
  { nome: 'Banco ABC Brasil', codigo: '246' },
  { nome: 'Nubank', codigo: '260' },
  { nome: 'PagBank', codigo: '290' },
  { nome: 'Dock / BPP', codigo: '301' },
  { nome: 'Banco BMG', codigo: '318' },
  { nome: 'Mercado Pago', codigo: '323' },
  { nome: 'Banco C6', codigo: '336' },
  { nome: 'Itaú Unibanco', codigo: '341' },
  { nome: 'Banco XP', codigo: '348' },
  { nome: 'Efí (Gerencianet)', codigo: '364' },
  { nome: 'Banco J.P. Morgan', codigo: '376' },
  { nome: 'PicPay', codigo: '380' },
  { nome: 'Banco Mercantil do Brasil', codigo: '389' },
  { nome: 'Kirton Bank (HSBC)', codigo: '399' },
  { nome: 'Banco Safra', codigo: '422' },
  { nome: 'Banco Industrial do Brasil', codigo: '604' },
  { nome: 'Banco PAN', codigo: '623' },
  { nome: 'Banco Rendimento', codigo: '633' },
  { nome: 'Banco Sofisa', codigo: '637' },
  { nome: 'Banco BV (Votorantim)', codigo: '655' },
  { nome: 'Banco Daycoval', codigo: '707' },
  { nome: 'Citibank', codigo: '745' },
  { nome: 'Banco Modal', codigo: '746' },
  { nome: 'Sicredi', codigo: '748' },
  { nome: 'Sicoob', codigo: '756' },
  { nome: 'Outro', codigo: '' }
];
