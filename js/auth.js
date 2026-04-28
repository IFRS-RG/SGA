// ============================================================
// SGA — Autenticação Google OAuth
// ============================================================

let _credential = null;
let _userInfo   = null;
let _roleInfo   = null;

function getCredential()  { return _credential; }
function getUserInfo()    { return _userInfo; }
function getRoleInfo()    { return _roleInfo; }
function getIdToken()     { return _credential; }

// ── Init Google Identity Services ────────────────────────────
function initGoogleAuth(callback) {
  google.accounts.id.initialize({
    client_id: SGA_CONFIG.GOOGLE_CLIENT_ID,
    callback: (response) => handleGoogleCredential(response, callback),
    auto_select: false,
    cancel_on_tap_outside: true
  });
}

// ── Handle credential response ────────────────────────────────
async function handleGoogleCredential(response, callback) {
  const token = response.credential;
  _credential = token;

  // Decode JWT payload (unverified — verification happens on GAS)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    _userInfo = {
      email:   payload.email,
      name:    payload.name,
      picture: payload.picture
    };
  } catch (e) {
    _userInfo = {};
  }

  if (callback) callback(token, _userInfo);
}

// ── Sign in via popup ─────────────────────────────────────────
function signInWithPopup() {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: SGA_CONFIG.GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: () => {}
    });
    // Use the prompt-based flow instead
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error('Login cancelado ou não suportado. Tente o botão de login.'));
      }
    });
  });
}

// ── Renderizar botão Google ───────────────────────────────────
function renderGoogleButton(elementId) {
  google.accounts.id.renderButton(
    document.getElementById(elementId),
    {
      type: 'standard',
      shape: 'rectangular',
      theme: 'outline',
      text: 'signin_with',
      size: 'large',
      locale: 'pt-BR',
      width: 280
    }
  );
}

// ── Logout ────────────────────────────────────────────────────
function signOut() {
  google.accounts.id.disableAutoSelect();
  _credential = null;
  _userInfo   = null;
  _roleInfo   = null;
  sessionStorage.removeItem('sga_session');
  window.location.href = 'index.html';
}

// ── Session persistence (tab session only) ────────────────────
function saveSession(credential, userInfo, roleInfo) {
  sessionStorage.setItem('sga_session', JSON.stringify({ credential, userInfo, roleInfo }));
  _credential = credential;
  _userInfo   = userInfo;
  _roleInfo   = roleInfo;
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem('sga_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    _credential = s.credential;
    _userInfo   = s.userInfo;
    _roleInfo   = s.roleInfo;
    return s;
  } catch (e) {
    return null;
  }
}

// ── Populate topbar ───────────────────────────────────────────
function populateTopbar(userInfo, roleLabel) {
  const nameEl  = document.getElementById('user-name');
  const photoEl = document.getElementById('user-photo');
  const roleEl  = document.getElementById('user-role');
  if (nameEl)  nameEl.textContent  = userInfo.name || userInfo.email;
  if (photoEl && userInfo.picture) { photoEl.src = userInfo.picture; photoEl.style.display = 'inline'; }
  if (roleEl)  roleEl.textContent  = roleLabel || '';
}

// ── Guard: redirect if no session ────────────────────────────
function requireAuth(expectedRole) {
  const session = loadSession();
  if (!session || !session.roleInfo) {
    window.location.href = 'index.html';
    return false;
  }
  if (expectedRole && session.roleInfo.role !== expectedRole) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
