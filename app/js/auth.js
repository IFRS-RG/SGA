// ============================================================
// SGA — Autenticação (Google Identity Services)
// ============================================================
const AUTH_KEY = 'sga_session';

// Guarda a sessão (token + dados do usuário) no sessionStorage.
function saveSession(token, user) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({ token, user, ts: Date.now() }));
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)); }
  catch (e) { return null; }
}

function getIdToken() {
  const s = getSession();
  return s ? s.token : null;
}

function getUser() {
  const s = getSession();
  return s ? s.user : null;
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  try { google.accounts.id.disableAutoSelect(); } catch (e) {}
  location.href = 'index.html';
}

// Decodifica o payload do JWT (sem verificar — a verificação é no GAS).
function decodeJwt(token) {
  try {
    const base = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(base))));
  } catch (e) { return {}; }
}

// Inicializa o botão de login. onLogin(user) é chamado após sucesso.
function initLoginButton(buttonEl, onLogin) {
  google.accounts.id.initialize({
    client_id: SGA_CONFIG.GOOGLE_CLIENT_ID,
    callback: (resp) => {
      const p = decodeJwt(resp.credential);
      const user = { email: p.email, name: p.name, picture: p.picture };
      saveSession(resp.credential, user);
      if (onLogin) onLogin(user);
    },
    auto_select: false,
    cancel_on_tap_outside: true
  });
  google.accounts.id.renderButton(buttonEl, {
    theme: 'outline', size: 'large', text: 'signin_with',
    shape: 'pill', logo_alignment: 'left', width: 280
  });
}

// Protege uma página: redireciona para o login se não houver sessão.
function requireSession() {
  if (!getIdToken()) { location.href = 'index.html'; return false; }
  return true;
}
