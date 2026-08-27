// ============================================================
// SGA — Certificados (upload de PDF)
// Arquivo real em {Segmento}/Certificados (todos juntos) + atalho na
// subpasta "Certificados" da pasta da ação. Emissão: Admin/Gestor.
// ============================================================

const CERT_CATEGORIAS = ['Equipe', 'Público'];

// Pasta única de certificados do segmento: raiz/{Segmento}/Certificados.
function _certFolderSegmento(segmento) {
  const seg = String(segmento || 'Sem segmento');
  return _childFolder(_childFolder(_editaisRootFolder(), seg), 'Certificados');
}

// Pessoas vinculadas à ação (equipe) + CPF do financeiro. Registra acesso a CPF.
function getPessoasDaAcao(acaoId, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);

  const finServ = {}; sheetRows('ServidoresFinanceiro').forEach(f => { finServ[String(f.RefID)] = f.CPF; });
  const finAlun = {}; sheetRows('AlunosFinanceiro').forEach(f => { finAlun[String(f.RefID)] = f.CPF; });
  const servidores = sheetRows('Servidores');
  const alunos = sheetRows('Alunos');

  const out = [];
  const seen = {};
  const push = (tipo, id, papel) => {
    if (!id) return;
    const k = tipo + ':' + id;
    if (seen[k]) return;
    const r = (tipo === 'servidor' ? servidores : alunos).find(x => String(x.ID) === String(id));
    if (!r) return;
    seen[k] = true;
    const cpf = tipo === 'servidor' ? (finServ[String(id)] || '') : (finAlun[String(id)] || '');
    out.push({ tipo: tipo, id: id, papel: papel, nomeCivil: r.Nome, nomeSocial: r.NomeSocial || '', cpf: cpf });
  };

  push('servidor', acao.CoordenadorID, 'Coordenador');
  push('servidor', acao.CoorientadorID, 'Coorientador');
  _acaoColabs(acao.ColaboradoresJSON).forEach(c => push(c.tipo, c.id, 'Colaborador'));
  sheetRows('AcaoBolsistas').filter(b => String(b.AcaoID) === String(acaoId)).forEach(b => push('aluno', b.AlunoID, 'Bolsista'));
  sheetRows('AcaoVoluntarios').filter(v => String(v.AcaoID) === String(acaoId)).forEach(v => push('aluno', v.AlunoID, 'Voluntário'));

  audit(email, info.role, 'Consultar CPF (certificados)', 'acao:' + acaoId, '');
  return out;
}

// ── Listar (Admin vê tudo; Gestor só do seu segmento) ─────────
function getCertificados(email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acoes = sheetRows('Acoes');
  const editais = sheetRows('Editais');
  return sheetRows('Certificados').map(c => {
    const acao = acoes.find(a => String(a.ID) === String(c.AcaoID));
    const ed = editais.find(e => String(e.ID) === String(c.EditalID));
    return {
      ID: c.ID, NomeDocumento: c.NomeDocumento, Categoria: c.Categoria,
      Papel: c.Papel, NomeCivil: c.NomeCivil, NomeSocial: c.NomeSocial, CPF: c.CPF,
      ArquivoUrl: c.ArquivoUrl, AcaoID: c.AcaoID, EditalID: c.EditalID,
      segmento: acao ? acao.Segmento : '', acaoTitulo: acao ? acao.Titulo : '',
      editalLabel: ed ? _editalLabel(ed) : ''
    };
  }).filter(c => info.role === 'Admin' || info.segmento === 'Todos' || String(c.segmento) === String(info.segmento));
}

// Certificados de uma ação (sem CPF — visível a leitores; para a aba na ação).
function getCertificadosDaAcao(acaoId, email) {
  requirePerfil(email, ACAO_READERS);
  return sheetRows('Certificados').filter(c => String(c.AcaoID) === String(acaoId)).map(c => ({
    ID: c.ID, NomeDocumento: c.NomeDocumento, Categoria: c.Categoria, Papel: c.Papel,
    NomeCivil: c.NomeCivil, NomeSocial: c.NomeSocial, ArquivoUrl: c.ArquivoUrl
  }));
}

// Certificados de uma pessoa (para o botão em Participantes).
function getCertificadosDaPessoa(tipo, id, email) {
  requirePerfil(email, ACAO_READERS);
  const acoes = sheetRows('Acoes');
  const editais = sheetRows('Editais');
  return sheetRows('Certificados')
    .filter(c => String(c.PessoaTipo) === String(tipo) && String(c.PessoaID) === String(id))
    .map(c => {
      const acao = acoes.find(a => String(a.ID) === String(c.AcaoID));
      const ed = editais.find(e => String(e.ID) === String(c.EditalID));
      return {
        ID: c.ID, NomeDocumento: c.NomeDocumento, Categoria: c.Categoria, Papel: c.Papel,
        ArquivoUrl: c.ArquivoUrl, acaoTitulo: acao ? acao.Titulo : '', editalLabel: ed ? _editalLabel(ed) : ''
      };
    });
}

function addCertificado(p, email, reqId) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(p.acaoId));
  if (!acao) throw userError('Ação não encontrada.');
  _assertSegmentoAcao(info, acao.Segmento);
  if (CERT_CATEGORIAS.indexOf(p.categoria) === -1) throw userError('Categoria inválida.');
  if (!p.editalId) throw userError('Selecione o edital.');

  const nomeCivil = String(p.nomeCivil || '').trim();
  if (!nomeCivil) throw userError('Informe o nome.');
  const cpf = String(p.cpf || '').replace(/\D/g, '');
  if (p.categoria === 'Público') {
    if (!cpf) throw userError('Informe o CPF do público-alvo.');
    if (!_cpfValido(cpf)) throw userError('CPF inválido.');
  }

  const bytes = Utilities.base64Decode(p.base64);
  if (!_isPdf(bytes)) throw userError('O arquivo enviado não é um PDF válido.');

  const dup = _idempotentId(reqId);
  if (dup) return { ok: true, id: dup, duplicate: true };

  const edital = sheetRows('Editais').find(e => String(e.ID) === String(p.editalId));
  const segmento = acao.Segmento || '';
  const codigo = 'CERT-' + String(sheetRows('Certificados').length + 1).padStart(6, '0');
  const nomeDoc = codigo + ' · Ed ' + (edital ? edital.Numero : '') + '/' + (edital ? edital.Ano : '') +
                  ' · ' + segmento + ' · A' + p.acaoId;

  // Arquivo real na pasta única do segmento.
  const fileName = (codigo + ' - ' + nomeCivil).replace(/[\\/:*?"<>|]/g, '-') + '.pdf';
  const file = _certFolderSegmento(segmento).createFile(Utilities.newBlob(bytes, 'application/pdf', fileName));

  // Atalho na subpasta "Certificados" da ação.
  try {
    const acaoCert = _childFolder(_acaoFolder(acao), 'Certificados');
    Drive.Files.insert({ title: fileName, mimeType: 'application/vnd.google-apps.shortcut',
      parents: [{ id: acaoCert.getId() }], shortcutDetails: { targetId: file.getId() } });
  } catch (e) { /* Drive indisponível — não bloqueia */ }

  const id = genId();
  getSheet('Certificados').appendRow([
    id, nomeDoc, p.categoria, p.editalId, p.acaoId, p.papel || '',
    p.pessoaTipo || (p.categoria === 'Público' ? 'publico' : ''), p.pessoaId || '',
    nomeCivil, String(p.nomeSocial || '').trim(), cpf, file.getId(), file.getUrl(), nowBR(), email
  ]);
  _idempotentStore(reqId, id);
  return { ok: true, id: id, nomeDocumento: nomeDoc };
}

function deleteCertificado(id, email) {
  const info = requirePerfil(email, ACAO_WRITERS);
  const c = sheetRows('Certificados').find(x => String(x.ID) === String(id));
  if (!c) throw userError('Certificado não encontrado.');
  const acao = sheetRows('Acoes').find(a => String(a.ID) === String(c.AcaoID));
  if (acao) _assertSegmentoAcao(info, acao.Segmento);
  // Atalho na ação → lixeira.
  try {
    if (acao && acao.DriveFolderId) {
      const acaoCert = _childFolder(DriveApp.getFolderById(acao.DriveFolderId), 'Certificados');
      _findShortcuts(acaoCert.getId(), c.ArquivoFileId).forEach(sc => { try { Drive.Files.trash(sc.id); } catch (e) {} });
    }
  } catch (e) {}
  if (c.ArquivoFileId) { try { DriveApp.getFileById(c.ArquivoFileId).setTrashed(true); } catch (e) {} }
  getSheet('Certificados').deleteRow(findRowIndex('Certificados', id));
  return { ok: true };
}
