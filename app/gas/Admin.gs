// ============================================================
// SGA — Módulo Admin
// Configurações de perfil de acesso (aba Perfis)
// ============================================================

function getPerfis(email) {
  requirePerfil(email, ['Admin']);
  const perfis = sheetRows('Perfis');
  // Injeta o super admin no topo (sempre presente, não editável).
  return {
    perfisDisponiveis: PERFIS,
    segmentosAcesso: SEGMENTOS_ACESSO,
    superAdmin: SUPER_ADMIN,
    registros: perfis
  };
}

// Valida/normaliza o segmento conforme o perfil.
function _resolveSegmento(perfil, segmento) {
  if (perfil === 'Admin' || perfil === 'Financeiro') return 'Todos';   // acesso geral
  const seg = segmento || '';
  if (SEGMENTOS_ACESSO.indexOf(seg) === -1) throw userError('Segmento inválido.');
  if (perfil === 'Gestor' && seg === 'Todos') {
    throw userError('Gestor de Segmento precisa de um segmento específico (não "Todos").');
  }
  return seg;
}

// payload: { email, nome, perfil }
function addPerfil(payload, adminEmail) {
  requirePerfil(adminEmail, ['Admin']);
  const alvo = String(payload.email || '').toLowerCase().trim();
  if (!alvo) throw userError('E-mail é obrigatório.');
  if (alvo === SUPER_ADMIN) throw userError('O super admin já tem acesso geral e não pode ser editado.');
  if (PERFIS.indexOf(payload.perfil) === -1) throw userError('Perfil inválido.');
  const segmento = _resolveSegmento(payload.perfil, payload.segmento);

  const existe = sheetRows('Perfis').some(p => String(p.Email).toLowerCase() === alvo);
  if (existe) throw userError('Este e-mail já tem um perfil cadastrado. Edite o registro existente.');

  getSheet('Perfis').appendRow([
    alvo, payload.nome || '', payload.perfil, segmento, 'Ativo', nowBR(), adminEmail
  ]);
  grantEditalAccess(alvo);   // SEC-002: dá acesso aos arquivos de edital
  return { ok: true };
}

// payload: { nome, perfil, status } — email identifica o registro (não muda)
function updatePerfil(email, payload, adminEmail) {
  requirePerfil(adminEmail, ['Admin']);
  const alvo = String(email).toLowerCase();
  const sh = getSheet('Perfis');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.Perfis.Email]).toLowerCase() === alvo) {
      const row = data[i];
      if (payload.nome !== undefined) row[COL.Perfis.Nome] = payload.nome;
      if (payload.perfil !== undefined) {
        if (PERFIS.indexOf(payload.perfil) === -1) throw userError('Perfil inválido.');
        row[COL.Perfis.Perfil] = payload.perfil;
      }
      // Segmento depende do perfil final; usa o novo valor ou mantém o existente.
      const perfilFinal = row[COL.Perfis.Perfil];
      const segIn = payload.segmento !== undefined ? payload.segmento : row[COL.Perfis.Segmento];
      row[COL.Perfis.Segmento] = _resolveSegmento(perfilFinal, segIn);
      if (payload.status !== undefined) row[COL.Perfis.Status] = payload.status;
      row[COL.Perfis.AtualizadoEm]  = nowBR();
      row[COL.Perfis.AtualizadoPor] = adminEmail;
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      // SEC-002: acesso aos arquivos acompanha o status do perfil.
      if (String(row[COL.Perfis.Status]) === 'Ativo') grantEditalAccess(alvo);
      else revokeEditalAccess(alvo);
      return { ok: true };
    }
  }
  throw userError('Registro não encontrado.');
}

function deletePerfil(email, adminEmail) {
  requirePerfil(adminEmail, ['Admin']);
  const alvo = String(email).toLowerCase();
  const sh = getSheet('Perfis');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.Perfis.Email]).toLowerCase() === alvo) {
      sh.deleteRow(i + 1);
      revokeEditalAccess(alvo);   // SEC-002: remove acesso aos arquivos
      return { ok: true };
    }
  }
  throw userError('Registro não encontrado.');
}
