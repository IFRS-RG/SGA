// ============================================================
// Portal do Aluno — Autenticação (valida o id_token do Google)
// Só aceita conta @aluno.riogrande.ifrs.edu.br.
// ============================================================

function verifyAlunoToken(token) {
  if (!token) return { valid: false };
  try {
    const r = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
      { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return { valid: false };
    const d = JSON.parse(r.getContentText());

    if (String(d.aud) !== String(OAUTH_CLIENT_ID)) return { valid: false };
    const iss = String(d.iss || '').replace(/^https:\/\//, '');
    if (iss !== 'accounts.google.com') return { valid: false };
    if (Number(d.exp) * 1000 < Date.now()) return { valid: false };
    if (!(d.email_verified === true || d.email_verified === 'true')) return { valid: false };

    const email = String(d.email || '').toLowerCase();
    if (email.slice(-ALUNO_DOMAIN.length) !== ALUNO_DOMAIN) {
      return { valid: false, notAluno: true };
    }
    return { valid: true, email: email, nome: d.name || d.email };
  } catch (e) {
    return { valid: false };
  }
}
