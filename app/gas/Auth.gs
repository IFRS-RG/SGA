// ============================================================
// SGA — Autenticação e Controle de Acesso
// ============================================================

// Client ID do OAuth (o MESMO valor de GOOGLE_CLIENT_ID em app/js/config.js).
// Usado para validar o campo "aud" do id_token: garante que o token foi emitido
// para ESTE aplicativo, e não para outro app Google qualquer (evita token replay).
const OAUTH_CLIENT_ID = '417258387995-5979idejok5shddicb8skm120bv67rbj.apps.googleusercontent.com';

// Emissores válidos de um id_token do Google.
const OAUTH_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// Verifica o id_token do Google Identity Services.
function verifyGoogleToken(token) {
  if (!token) return { valid: false };
  try {
    const url  = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return { valid: false };
    const info = JSON.parse(resp.getContentText());

    // E-mail confirmado pelo Google.
    if (!info.email_verified || info.email_verified === 'false') return { valid: false };
    // Audience: o token precisa ter sido emitido para ESTE app (não para outro).
    if (info.aud !== OAUTH_CLIENT_ID) return { valid: false };
    // Emissor: precisa ser o Google.
    if (OAUTH_ISSUERS.indexOf(info.iss) === -1) return { valid: false };
    // Expiração: rejeita token vencido (exp em segundos desde epoch). Defesa extra —
    // o endpoint tokeninfo já recusa tokens expirados com status != 200.
    if (info.exp && (parseInt(info.exp, 10) * 1000) <= Date.now()) return { valid: false };

    return {
      valid: true,
      email: String(info.email || '').toLowerCase(),
      name:  info.name || '',
      picture: info.picture || ''
    };
  } catch (e) {
    return { valid: false };
  }
}

// Determina o perfil do usuário.
//   Admin        → SUPER_ADMIN, ou registro Ativo na aba Perfis com perfil "Admin"
//   Gestor       → registro Ativo na aba Perfis (gerencia um segmento)
//   Visualizador → registro Ativo na aba Perfis (leitura)
//   sem-acesso   → autenticado mas sem perfil cadastrado
function getRole(email) {
  if (!email) return { role: 'sem-acesso', reason: 'E-mail não fornecido.' };
  email = String(email).toLowerCase();

  if (email === SUPER_ADMIN) {
    return { role: 'Admin', email: email, segmento: 'Todos', superAdmin: true };
  }

  const perfis = sheetRows('Perfis');
  const rec = perfis.find(p => String(p.Email).toLowerCase() === email && p.Status === 'Ativo');
  if (rec) {
    return {
      role: rec.Perfil,
      email: email,
      nome: rec.Nome || '',
      segmento: rec.Perfil === 'Admin' ? 'Todos' : (rec.Segmento || 'Todos')
    };
  }

  return {
    role: 'sem-acesso',
    email: email,
    reason: 'Seu e-mail ainda não tem um perfil de acesso cadastrado. Contate o administrador.'
  };
}

// Lança erro se o usuário não tiver um dos perfis exigidos.
function requirePerfil(email, perfisPermitidos) {
  const info = getRole(email);
  if (perfisPermitidos.indexOf(info.role) === -1) {
    throw userError('Acesso negado. Esta ação exige perfil: ' + perfisPermitidos.join(' ou ') + '.');
  }
  return info;
}

function isAdmin(email) {
  return getRole(email).role === 'Admin';
}
