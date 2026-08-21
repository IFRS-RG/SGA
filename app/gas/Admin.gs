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
    superAdmin: SUPER_ADMIN,
    registros: perfis
  };
}

// payload: { email, nome, perfil }
function addPerfil(payload, adminEmail) {
  requirePerfil(adminEmail, ['Admin']);
  const alvo = String(payload.email || '').toLowerCase().trim();
  if (!alvo) throw new Error('E-mail é obrigatório.');
  if (alvo === SUPER_ADMIN) throw new Error('O super admin já tem acesso geral e não pode ser editado.');
  if (PERFIS.indexOf(payload.perfil) === -1) throw new Error('Perfil inválido.');

  const existe = sheetRows('Perfis').some(p => String(p.Email).toLowerCase() === alvo);
  if (existe) throw new Error('Este e-mail já tem um perfil cadastrado. Edite o registro existente.');

  getSheet('Perfis').appendRow([
    alvo, payload.nome || '', payload.perfil, 'Ativo', nowBR(), adminEmail
  ]);
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
      if (payload.nome   !== undefined) row[COL.Perfis.Nome]   = payload.nome;
      if (payload.perfil !== undefined) {
        if (PERFIS.indexOf(payload.perfil) === -1) throw new Error('Perfil inválido.');
        row[COL.Perfis.Perfil] = payload.perfil;
      }
      if (payload.status !== undefined) row[COL.Perfis.Status] = payload.status;
      row[COL.Perfis.AtualizadoEm]  = nowBR();
      row[COL.Perfis.AtualizadoPor] = adminEmail;
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { ok: true };
    }
  }
  throw new Error('Registro não encontrado.');
}

function deletePerfil(email, adminEmail) {
  requirePerfil(adminEmail, ['Admin']);
  const alvo = String(email).toLowerCase();
  const sh = getSheet('Perfis');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.Perfis.Email]).toLowerCase() === alvo) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  throw new Error('Registro não encontrado.');
}
