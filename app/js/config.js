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

// Ações.
const TIPO_ACAO = ['Projeto', 'Programa', 'Evento', 'Prestação institucional de Serviços', 'Curso FIC', 'Curso MOOC'];
const STATUS_ACAO = ['Ativa', 'Encerrada', 'Suspensa'];
const FUNCAO_COLABORADOR = ['Apresentador de trabalho', 'Bolsista', 'Colaborador', 'Coordenador da ação',
  'Coordenador pedagógico', 'Expositor', 'Membro da comissão organizadora', 'Ministrante', 'Orientador',
  'Ouvinte', 'Palestrante/conferencista', 'Presidente da comissão organizadora', 'Voluntário'];
const TIPOS_DOC_ACAO = ['Ação (SIGAA)', 'Relatório final da ação', 'Demais'];
const TIPOS_FIN_ACAO = ['Plano de aplicação de recursos', 'Prestação de contas',
                        'Relatório de execução (Anexo V)', 'Orçamentos',
                        'Comprovante de devolução (Pag Tesouro)', 'Documentos comprobatórios/fiscais'];
// Fallback do limite dos 3 orçamentos (Art. 7º) — o valor vigente vem da gestão
// (Admin › Parâmetros) via getAcaoFinanceiro.limiteOrcamentos. Padrão: R$ 3.274,60.
const LIMITE_TRES_ORCAMENTOS = 3274.60;
const CH_BOLSA = ['4', '8', '12', '16'];
// Seleção de bolsistas (vagas).
const TIPO_VAGA = ['Bolsista', 'Voluntário'];
const STATUS_VAGA = ['Aberta', 'Encerrada'];
const MODALIDADE_VAGA = ['Integrado', 'Subsequente', 'Superior'];
const CATEGORIA_CRITERIO = ['Entrevista', 'Análise documental', 'Conhecimentos e competências',
  'Experiência e trajetória', 'Formação complementar', 'Disponibilidade', 'Avaliação prática', 'Outros'];
const STATUS_VINCULO = ['Ativo', 'Desligado', 'Concluído'];
const STATUS_SIGAA = ['Cadastrado', 'Não cadastrado', 'Cadastro incorreto'];
const STATUS_RELATORIO = ['Não entregue', 'Entregue', 'Em análise', 'Aprovado', 'Reprovado'];
const TIPO_DESPESA = ['Material de consumo', 'Material permanente', 'Serviços de terceiros (PF)',
                      'Serviços de terceiros (PJ)', 'Hospedagem', 'Passagens', 'Alimentação de estudantes'];
const CLASSIF_DESPESA = ['Custeio', 'Capital'];
const SITUACAO_BEM = ['Bom (B)', 'Ocioso (O)', 'Recuperável (R)', 'Antieconômico (A)', 'Irrecuperável (I)'];
const STATUS_ALTERACAO = ['Pendente', 'Autorizada', 'Negada'];
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
