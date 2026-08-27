// ============================================================
// SGA — Sistema de Gestão de Ações · IFRS Campus Rio Grande
// Backend (Google Apps Script) — Configuração e Helpers
// ============================================================
//
// PREENCHER APÓS CRIAR A PLANILHA NOVA:
//   1. Crie uma planilha nova no Google Sheets (conta projetos@).
//   2. Copie o ID da URL (…/spreadsheets/d/<ESTE_ID>/edit) e cole abaixo.
//   3. (Opcional) Crie uma pasta no Drive para os PDFs e cole o ID dela.
//   4. Rode a função initSheets() uma vez (menu Executar) para criar as abas.
// ============================================================

const SPREADSHEET_ID = '15UBg8zHMZz5nSejT-5YMyrwbz8IAn6sizFQ4q4ZPuTk';

// Pasta raiz do Drive onde os arquivos são guardados ("SGA - ARQUIVOS", movida/renomeada).
// Deixe vazio ('') para o sistema criar uma pasta "SGA - ARQUIVOS" na raiz do My Drive.
const DRIVE_ROOT_ID  = '1HcZMS3oX6C5C8ED4E8a-9AgtqugdJjy0';

// E-mail com acesso geral (super admin). Sempre tem perfil "Admin".
const SUPER_ADMIN    = 'projetos@riogrande.ifrs.edu.br';

// Perfis de acesso disponíveis no sistema.
//   Admin       → acesso geral (todos os segmentos)
//   Gestor      → diretoria/setor: gerencia editais/ações de UM segmento
//   Visualizador→ somente leitura
//   Financeiro  → acesso geral aos dados financeiros (CPF/banco/PIX) dos participantes
const PERFIS = ['Admin', 'Gestor', 'Visualizador', 'Financeiro'];

// Segmentos das AÇÕES/EDITAIS. "Conjunto" engloba os 4 segmentos.
const SEGMENTOS = ['Ensino', 'Pesquisa', 'Extensão', 'Indissociável', 'Conjunto'];
// Os 4 segmentos "reais" (usados quando o edital é Conjunto).
const SEGMENTOS_BASE = ['Ensino', 'Pesquisa', 'Extensão', 'Indissociável'];

// Segmentos usados no PERFIL de acesso ('Todos' = geral).
const SEGMENTOS_ACESSO = ['Todos', 'Ensino', 'Pesquisa', 'Extensão', 'Indissociável'];

// Origem do edital (o form aceita "Outro" via texto livre).
const ORIGEM_EDITAL = ['IFRS-RG', 'PROEN', 'PROEX', 'PROPPI'];

// Tipos de fomento/auxílio por segmento (o form também aceita "Outro" via texto livre).
const TIPO_FOMENTO = {
  'Ensino': ['PAIEN'],
  'Pesquisa': ['AIPCTI'],
  'Extensão': ['PAIEX'],
  'Indissociável': ['PAIIND']
};
// Tipos de bolsa por segmento.
const TIPO_BOLSA = {
  'Ensino': ['PIBEN'],
  'Pesquisa': ['PIBIC', 'PIBIC-Af', 'PIBIC-EM', 'PROBIC', 'PIBITI', 'PROBITI'],
  'Extensão': ['PIBEX'],
  'Indissociável': ['PIBIND']
};
// Valor da bolsa por carga horária semanal (referência PIBEX/PIBEN).
const CH_VALOR = { '4': 175, '8': 350, '12': 525, '16': 700 };

// Tipos de documento no upload de PDF do edital.
const TIPOS_DOC = ['Edital', 'Retificação', 'Anexo', 'Demais publicações'];

// Vínculos possíveis de um servidor (pode ter mais de um: ex. Docente + TAE).
const VINCULOS_SERVIDOR = [
  'Docente Efetivo', 'Docente Substituto', 'Docente Temporário', 'Docente Visitante',
  'Docente Cedido', 'TAE Efetivo', 'TAE Cedido'
];

// Status de um participante.
const STATUS_PARTICIPANTE = ['Ativo', 'Inativo'];

// Dados financeiros.
const TIPO_CONTA = ['Corrente', 'Poupança'];
const PIX_TIPO   = ['CPF', 'E-mail', 'Telefone', 'Aleatória'];

// Ações.
const TIPO_ACAO = ['Projeto', 'Programa', 'Evento', 'Prestação institucional de Serviços', 'Curso FIC', 'Curso MOOC'];
const STATUS_ACAO = ['Ativa', 'Encerrada', 'Suspensa'];
// Documentos da ação (aba Documentos) e da aba Financeiro (aberto, sem LGPD).
const TIPOS_DOC_ACAO = ['Ação (SIGAA)', 'Relatório final da ação', 'Demais'];
const TIPOS_FIN_ACAO = ['Plano de aplicação de recursos', 'Prestação de contas',
                        'Relatório de execução (Anexo V)', 'Orçamentos',
                        'Comprovante de devolução (Pag Tesouro)', 'Documentos comprobatórios/fiscais'];
// Despesas (Anexo III). Classificação custeio/capital (Art. 3º da IN).
const TIPO_DESPESA = ['Material de consumo', 'Material permanente', 'Serviços de terceiros (PF)',
                      'Serviços de terceiros (PJ)', 'Hospedagem', 'Passagens', 'Alimentação de estudantes'];
const CLASSIF_DESPESA = ['Custeio', 'Capital'];
// Situação do bem doado (Anexo IV): B/O/R/A/I.
const SITUACAO_BEM = ['Bom (B)', 'Ocioso (O)', 'Recuperável (R)', 'Antieconômico (A)', 'Irrecuperável (I)'];
// Status da solicitação de alteração de despesas (Anexo II).
const STATUS_ALTERACAO = ['Pendente', 'Autorizada', 'Negada'];
const STATUS_VINCULO = ['Ativo', 'Desligado', 'Concluído'];   // bolsista/voluntário
const STATUS_SIGAA = ['Cadastrado', 'Não cadastrado', 'Cadastro incorreto'];
const STATUS_RELATORIO = ['Não entregue', 'Entregue', 'Em análise', 'Aprovado', 'Reprovado'];

// ── Índices de coluna (0-based) ──────────────────────────────
const COL = {
  Editais: {
    ID: 0, Numero: 1, Ano: 2, Titulo: 3, Resumo: 4, Segmento: 5, Origem: 6,
    LinkPublicacao: 7, Fomento: 8, Bolsa: 9, RecursoJSON: 10,
    Custeio: 11, Capital: 12, Total: 13, ValorTotalBolsa: 14, BolsasJSON: 15,
    DataPublicacao: 16, CronogramaJSON: 17, EditaisPaiJSON: 18, DriveFolderId: 19,
    AnoPasta: 20, StatusManual: 21, CriadoEm: 22, CriadoPor: 23
  },
  EditalDocumentos: {
    ID: 0, EditalID: 1, Tipo: 2, NomeArquivo: 3, DriveFileId: 4, DriveUrl: 5,
    DataUpload: 6, EnviadoPor: 7
  },
  Perfis: {
    Email: 0, Nome: 1, Perfil: 2, Segmento: 3, Status: 4, AtualizadoEm: 5, AtualizadoPor: 6
  },
  // Identidade/contato do servidor (dados financeiros ficam em ServidoresFinanceiro — F3).
  Servidores: {
    ID: 0, Nome: 1, NomeSocial: 2, UsarNomeSocialDocs: 3, SIAPE: 4, VinculoJSON: 5,
    Email: 6, Telefone: 7, WhatsApp: 8, Status: 9, CriadoEm: 10, CriadoPor: 11
  },
  // Identidade/contato do aluno (CPF/financeiro ficam em AlunosFinanceiro — F3).
  Alunos: {
    ID: 0, Nome: 1, NomeSocial: 2, UsarNomeSocialDocs: 3, Matricula: 4, CursoID: 5,
    DataNascimento: 6, Email: 7, Telefone: 8, WhatsApp: 9, Status: 10,
    Endereco: 11, AnoSemestreIngresso: 12, AnoSemestreAtual: 13, CriadoEm: 14, CriadoPor: 15
  },
  Cursos: { ID: 0, Nome: 1, Modalidade: 2, Status: 3 },
  // Store financeiro SEGREGADO (sensível) — chave RefID = ID do servidor/aluno.
  ServidoresFinanceiro: { RefID: 0, CPF: 1, Banco: 2, BancoCodigo: 3, Agencia: 4, TipoConta: 5, NumeroConta: 6, PixTipo: 7, PixChave: 8, AtualizadoEm: 9, AtualizadoPor: 10 },
  AlunosFinanceiro:     { RefID: 0, CPF: 1, Banco: 2, BancoCodigo: 3, Agencia: 4, TipoConta: 5, NumeroConta: 6, PixTipo: 7, PixChave: 8, AtualizadoEm: 9, AtualizadoPor: 10 },
  // Trilha de auditoria — NÃO grava valores sensíveis, só a ação e o alvo.
  Auditoria: { Timestamp: 0, Ator: 1, Papel: 2, Acao: 3, Alvo: 4, Detalhe: 5 },
  // Ações — aba Dados (Documentos/Bolsistas/Voluntários vêm nas fatias B/C/D).
  Acoes: {
    ID: 0, Titulo: 1, TipoAcao: 2, Modalidade: 3, AnoExecucao: 4, Segmento: 5, EditalID: 6,
    CoordenadorID: 7, CoorientadorID: 8, ColaboradoresJSON: 9, DataInicio: 10, DataFim: 11,
    Status: 12, DriveFolderId: 13, CriadoEm: 14, CriadoPor: 15
  },
  AcaoDocumentos: {
    ID: 0, AcaoID: 1, Tipo: 2, NomeArquivo: 3, DriveFileId: 4, DriveUrl: 5, DataUpload: 6, EnviadoPor: 7
  },
  AcaoBolsistas: {
    ID: 0, AcaoID: 1, AlunoID: 2, EditalBolsaID: 3, CHBolsa: 4, ValorBolsa: 5, DataInicio: 6, DataFim: 7,
    TotalSemanas: 8, CHTotal: 9, StatusSIGAA: 10, StatusRelatorio: 11, RelatorioFileId: 12, RelatorioUrl: 13,
    Observacoes: 14, Status: 15, CriadoEm: 16, CriadoPor: 17
  },
  AcaoVoluntarios: {
    ID: 0, AcaoID: 1, AlunoID: 2, CHVoluntariado: 3, DataInicio: 4, DataFim: 5, TotalSemanas: 6, CHTotal: 7,
    StatusSIGAA: 8, StatusRelatorio: 9, RelatorioFileId: 10, RelatorioUrl: 11, Observacoes: 12, Status: 13,
    CriadoEm: 14, CriadoPor: 15
  },
  // Financeiro estruturado da ação (aberto, sem LGPD). Cabeçalho: 1 linha por ação (chave = AcaoID).
  AcaoFinanceiro: {
    AcaoID: 0, UnidadeExecucao: 1, CusteioPrevisto: 2, CapitalPrevisto: 3, ValorRecebido: 4, ValorDevolvido: 5,
    CriadoEm: 6, CriadoPor: 7
  },
  // Itens de despesa (Anexo III).
  AcaoDespesas: {
    ID: 0, AcaoID: 1, Descricao: 2, Tipo: 3, Classificacao: 4, DataCompra: 5, Fornecedor: 6, NumDocFiscal: 7,
    ValorUnitario: 8, Qtd: 9, ValorTotal: 10, CriadoEm: 11, CriadoPor: 12
  },
  // Bens permanentes doados (Anexo IV). DespesaID liga à despesa de origem (quando gerado dela).
  AcaoBensDoados: {
    ID: 0, AcaoID: 1, DespesaID: 2, MaterialPermanente: 3, Qtd: 4, MarcaModelo: 5, Situacao: 6,
    NumDocFiscal: 7, NumTombamento: 8, Descricao: 9, AnexoFileId: 10, AnexoUrl: 11, CriadoEm: 12, CriadoPor: 13
  },
  // Alterações de despesa (Anexo II).
  AcaoAlteracoes: {
    ID: 0, AcaoID: 1, CusteioOriginal: 2, CapitalOriginal: 3, CusteioNovo: 4, CapitalNovo: 5,
    Justificativa: 6, StatusAutorizacao: 7, Observacao: 8, Data: 9, CriadoEm: 10, CriadoPor: 11
  },
  // Parâmetros ajustáveis pela gestão (chave/valor).
  Parametros: { Chave: 0, Valor: 1 },
  // Certificados (upload de PDF; arquivo em {Segmento}/Certificados + atalho na ação).
  Certificados: {
    ID: 0, NomeDocumento: 1, Categoria: 2, EditalID: 3, AcaoID: 4, Papel: 5, PessoaTipo: 6, PessoaID: 7,
    NomeCivil: 8, NomeSocial: 9, CPF: 10, ArquivoFileId: 11, ArquivoUrl: 12, CriadoEm: 13, CriadoPor: 14
  }
};

// Valor padrão do limite dos 3 orçamentos (Art. 7º) — 5% do teto do Art. 75, II da Lei 14.133.
const LIMITE_ORCAMENTOS_PADRAO = 3274.60;

const HEADERS = {
  Editais: ['ID', 'Numero', 'Ano', 'Titulo', 'Resumo', 'Segmento', 'Origem',
            'LinkPublicacao', 'Fomento', 'Bolsa', 'RecursoJSON',
            'Custeio', 'Capital', 'Total', 'ValorTotalBolsa', 'BolsasJSON',
            'DataPublicacao', 'CronogramaJSON', 'EditaisPaiJSON', 'DriveFolderId',
            'AnoPasta', 'StatusManual', 'CriadoEm', 'CriadoPor'],
  EditalDocumentos: ['ID', 'EditalID', 'Tipo', 'NomeArquivo', 'DriveFileId',
                     'DriveUrl', 'DataUpload', 'EnviadoPor'],
  Perfis: ['Email', 'Nome', 'Perfil', 'Segmento', 'Status', 'AtualizadoEm', 'AtualizadoPor'],
  Servidores: ['ID', 'Nome', 'NomeSocial', 'UsarNomeSocialDocs', 'SIAPE', 'VinculoJSON',
               'Email', 'Telefone', 'WhatsApp', 'Status', 'CriadoEm', 'CriadoPor'],
  Alunos: ['ID', 'Nome', 'NomeSocial', 'UsarNomeSocialDocs', 'Matricula', 'CursoID',
           'DataNascimento', 'Email', 'Telefone', 'WhatsApp', 'Status',
           'Endereco', 'AnoSemestreIngresso', 'AnoSemestreAtual', 'CriadoEm', 'CriadoPor'],
  Cursos: ['ID', 'Nome', 'Modalidade', 'Status'],
  ServidoresFinanceiro: ['RefID', 'CPF', 'Banco', 'BancoCodigo', 'Agencia', 'TipoConta', 'NumeroConta', 'PixTipo', 'PixChave', 'AtualizadoEm', 'AtualizadoPor'],
  AlunosFinanceiro:     ['RefID', 'CPF', 'Banco', 'BancoCodigo', 'Agencia', 'TipoConta', 'NumeroConta', 'PixTipo', 'PixChave', 'AtualizadoEm', 'AtualizadoPor'],
  Auditoria: ['Timestamp', 'Ator', 'Papel', 'Acao', 'Alvo', 'Detalhe'],
  Acoes: ['ID', 'Titulo', 'TipoAcao', 'Modalidade', 'AnoExecucao', 'Segmento', 'EditalID',
          'CoordenadorID', 'CoorientadorID', 'ColaboradoresJSON', 'DataInicio', 'DataFim',
          'Status', 'DriveFolderId', 'CriadoEm', 'CriadoPor'],
  AcaoDocumentos: ['ID', 'AcaoID', 'Tipo', 'NomeArquivo', 'DriveFileId', 'DriveUrl', 'DataUpload', 'EnviadoPor'],
  AcaoBolsistas: ['ID', 'AcaoID', 'AlunoID', 'EditalBolsaID', 'CHBolsa', 'ValorBolsa', 'DataInicio', 'DataFim',
                  'TotalSemanas', 'CHTotal', 'StatusSIGAA', 'StatusRelatorio', 'RelatorioFileId', 'RelatorioUrl',
                  'Observacoes', 'Status', 'CriadoEm', 'CriadoPor'],
  AcaoVoluntarios: ['ID', 'AcaoID', 'AlunoID', 'CHVoluntariado', 'DataInicio', 'DataFim', 'TotalSemanas', 'CHTotal',
                    'StatusSIGAA', 'StatusRelatorio', 'RelatorioFileId', 'RelatorioUrl', 'Observacoes', 'Status',
                    'CriadoEm', 'CriadoPor'],
  AcaoFinanceiro: ['AcaoID', 'UnidadeExecucao', 'CusteioPrevisto', 'CapitalPrevisto', 'ValorRecebido',
                   'ValorDevolvido', 'CriadoEm', 'CriadoPor'],
  AcaoDespesas: ['ID', 'AcaoID', 'Descricao', 'Tipo', 'Classificacao', 'DataCompra', 'Fornecedor', 'NumDocFiscal',
                 'ValorUnitario', 'Qtd', 'ValorTotal', 'CriadoEm', 'CriadoPor'],
  AcaoBensDoados: ['ID', 'AcaoID', 'DespesaID', 'MaterialPermanente', 'Qtd', 'MarcaModelo', 'Situacao',
                   'NumDocFiscal', 'NumTombamento', 'Descricao', 'AnexoFileId', 'AnexoUrl', 'CriadoEm', 'CriadoPor'],
  AcaoAlteracoes: ['ID', 'AcaoID', 'CusteioOriginal', 'CapitalOriginal', 'CusteioNovo', 'CapitalNovo',
                   'Justificativa', 'StatusAutorizacao', 'Observacao', 'Data', 'CriadoEm', 'CriadoPor'],
  Parametros: ['Chave', 'Valor'],
  Certificados: ['ID', 'NomeDocumento', 'Categoria', 'EditalID', 'AcaoID', 'Papel', 'PessoaTipo', 'PessoaID',
                 'NomeCivil', 'NomeSocial', 'CPF', 'ArquivoFileId', 'ArquivoUrl', 'CriadoEm', 'CriadoPor']
};

// ── Helpers genéricos ────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function respond(payload) {
  const out = ContentService.createTextOutput(JSON.stringify(payload));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

// Erro "exibível": a mensagem pode ser mostrada ao usuário (validação, permissão,
// etc.). Erros NÃO criados por aqui são tratados como internos pelo Router, que
// devolve uma mensagem genérica e registra o detalhe no log (sem vazar ao cliente).
function userError(msg) {
  const e = new Error(msg);
  e.userFacing = true;
  return e;
}

function ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function getSheet(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw userError('Aba "' + name + '" não existe. Rode initSheets().');
  return sh;
}

// Lê uma aba como array de objetos {Header: valor}.
function sheetRows(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// Retorna o número da linha (1-based) cuja 1ª coluna == id, ou -1.
function findRowIndex(sheetName, id) {
  const data = getSheet(sheetName).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function isoNow() { return new Date().toISOString(); }

function nowBR() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
}
