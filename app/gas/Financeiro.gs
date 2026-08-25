// ============================================================
// SGA — Dados financeiros dos participantes (store SEGREGADO)
// Camadas de acesso:
//   CPF  → Admin, Gestor, Financeiro (mascarado por padrão; revelar é logado)
//   Banco/PIX → Admin, Financeiro
//   Escrita   → Admin, Financeiro
// Toda visualização/edição é registrada na trilha de Auditoria (sem o valor).
// ============================================================

const FIN_CPF_READERS  = ['Admin', 'Gestor', 'Financeiro'];
const FIN_BANK_READERS = ['Admin', 'Financeiro'];
const FIN_WRITERS      = ['Admin', 'Financeiro'];

function _finSheetName(tipo) {
  if (tipo === 'servidor') return 'ServidoresFinanceiro';
  if (tipo === 'aluno')    return 'AlunosFinanceiro';
  throw userError('Tipo inválido.');
}
function _finIdentSheet(tipo) { return tipo === 'servidor' ? 'Servidores' : 'Alunos'; }

function _finRec(tipo, refId) {
  return sheetRows(_finSheetName(tipo)).find(r => String(r.RefID) === String(refId));
}
function _identExists(tipo, refId) {
  return sheetRows(_finIdentSheet(tipo)).some(r => String(r.ID) === String(refId));
}

// ── Máscaras (server-side; o cliente nunca recebe o valor cheio sem revelar) ──
function _maskTail(s, keep) {
  s = String(s || '');
  if (!s) return '';
  if (s.length <= keep) return s;
  return '•'.repeat(Math.min(s.length - keep, 8)) + s.slice(-keep);
}
function _maskCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (!d) return '';
  return '•••.•••.•••-' + (d.length >= 2 ? d.slice(-2) : d);
}
function _maskPix(chave, tipo) {
  const s = String(chave || '');
  if (!s) return '';
  if (tipo === 'E-mail') {
    const at = s.indexOf('@');
    if (at > 0) return s[0] + '•••' + s.slice(at);
  }
  return _maskTail(s, 4);
}

// ── Validações ────────────────────────────────────────────────
function _cpfValido(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += (+d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r >= 10) r = 0;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += (+d[i]) * (11 - i);
  r = (s * 10) % 11; if (r >= 10) r = 0;
  return r === +d[10];
}
function _pixValido(tipo, chave) {
  const s = String(chave || '').trim();
  if (!s) return true;   // PIX é opcional
  if (tipo === 'CPF')      return s.replace(/\D/g, '').length === 11;
  if (tipo === 'E-mail')   return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
  if (tipo === 'Telefone') { const d = s.replace(/\D/g, ''); return d.length >= 10 && d.length <= 13; }
  if (tipo === 'Aleatória') return s.length >= 8;
  return false;
}

// ── Leitura mascarada (registra a visualização) ───────────────
function getFinanceiro(tipo, refId, email) {
  const info = requirePerfil(email, FIN_CPF_READERS);
  if (!_identExists(tipo, refId)) throw userError('Participante não encontrado.');
  const role = info.role;
  const bank = FIN_BANK_READERS.indexOf(role) >= 0;
  const rec  = _finRec(tipo, refId);
  audit(email, role, 'Visualizar financeiro', tipo + ':' + refId, '');

  const out = {
    tipo: tipo, refId: refId,
    temRegistro: !!rec,
    cpf: rec ? _maskCpf(rec.CPF) : '',
    temCpf: !!(rec && rec.CPF),
    canBank: bank,
    canWrite: FIN_WRITERS.indexOf(role) >= 0,
    atualizadoEm: rec ? rec.AtualizadoEm : '',
    atualizadoPor: rec ? rec.AtualizadoPor : ''
  };
  if (bank && rec) {
    out.banco       = rec.Banco || '';
    out.agencia     = rec.Agencia || '';
    out.tipoConta   = rec.TipoConta || '';
    out.numeroConta = _maskTail(rec.NumeroConta, 2);
    out.temConta    = !!rec.NumeroConta;
    out.pixTipo     = rec.PixTipo || '';
    out.pixChave    = _maskPix(rec.PixChave, rec.PixTipo);
    out.temPix      = !!rec.PixChave;
  }
  return out;
}

// ── Revelar valores cheios (registra o acesso) ────────────────
function revealFinanceiro(tipo, refId, email) {
  const info = requirePerfil(email, FIN_CPF_READERS);
  const role = info.role;
  const bank = FIN_BANK_READERS.indexOf(role) >= 0;
  const rec  = _finRec(tipo, refId);
  audit(email, role, 'Revelar financeiro', tipo + ':' + refId, '');
  if (!rec) return { cpf: '' };
  const out = { cpf: rec.CPF || '' };
  if (bank) {
    out.numeroConta = rec.NumeroConta || '';
    out.pixChave    = rec.PixChave || '';
  }
  return out;
}

// ── Gravar (upsert; registra a edição) ────────────────────────
function saveFinanceiro(tipo, refId, p, email) {
  const info = requirePerfil(email, FIN_WRITERS);
  if (!_identExists(tipo, refId)) throw userError('Participante não encontrado.');

  const cpf = String(p.cpf || '').replace(/\D/g, '');
  if (cpf && !_cpfValido(cpf)) throw userError('CPF inválido.');
  if (p.tipoConta && TIPO_CONTA.indexOf(p.tipoConta) === -1) throw userError('Tipo de conta inválido.');
  if (p.pixTipo && PIX_TIPO.indexOf(p.pixTipo) === -1) throw userError('Tipo de chave PIX inválido.');
  if (p.pixChave && !p.pixTipo) throw userError('Selecione o tipo da chave PIX.');
  if (!_pixValido(p.pixTipo, p.pixChave)) throw userError('A chave PIX não confere com o tipo selecionado.');

  const row = [
    refId, cpf,
    String(p.banco || '').trim(),
    String(p.agencia || '').trim(),
    p.tipoConta || '',
    String(p.numeroConta || '').trim(),
    p.pixTipo || '',
    String(p.pixChave || '').trim(),
    nowBR(), email
  ];
  const sheetName = _finSheetName(tipo);
  const idx = findRowIndex(sheetName, refId);
  if (idx === -1) getSheet(sheetName).appendRow(row);
  else getSheet(sheetName).getRange(idx, 1, 1, row.length).setValues([row]);

  audit(email, info.role, 'Editar financeiro', tipo + ':' + refId, '');
  return { ok: true };
}
