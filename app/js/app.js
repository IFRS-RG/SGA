// ============================================================
// SGA — Shell principal (sidebar, roteamento, sessão)
// ============================================================
const App = {
  role: null,
  user: null,
  current: null,

  // Definição do menu. `roles` = perfis que enxergam o item.
  menu: [
    { id: 'editais', label: 'Editais', icon: '📄', roles: ['Admin', 'Coordenador', 'Visualizador'], module: 'Editais' },
    { id: 'admin',   label: 'Admin',   icon: '⚙️', roles: ['Admin'], module: 'Admin' }
  ],

  async init() {
    if (!requireSession()) return;
    initModalEvents();
    this.user = getUser();

    document.getElementById('menu-toggle').onclick =
      () => document.getElementById('sidebar').classList.toggle('open');

    try {
      const info = await API.getRole();
      this.role = info.role;
    } catch (e) {
      this.renderFatal('Erro ao verificar seu acesso: ' + e.message);
      return;
    }

    if (this.role === 'sem-acesso') {
      this.renderNoAccess();
      return;
    }

    this.renderSidebar();
    this.navigate('editais');
  },

  renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    const items = this.menu.filter(m => m.roles.includes(this.role));
    nav.innerHTML = items.map(m => `
      <button class="nav-item" data-id="${m.id}" onclick="App.navigate('${m.id}')">
        <span class="nav-icon">${m.icon}</span><span>${esc(m.label)}</span>
      </button>`).join('');

    document.getElementById('sidebar-user').innerHTML = `
      <div class="user-row">
        ${this.user.picture ? `<img src="${esc(this.user.picture)}" class="user-pic" alt="">` : '<div class="user-pic user-pic--ph"></div>'}
        <div class="user-info">
          <div class="user-name">${esc(this.user.name || this.user.email)}</div>
          <div class="user-email">${esc(this.user.email)}</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-block" onclick="logout()">Sair</button>`;

    document.getElementById('topbar-perfil').textContent = 'Perfil: ' + this.role;
  },

  navigate(id) {
    const item = this.menu.find(m => m.id === id);
    if (!item || !item.roles.includes(this.role)) return;
    this.current = id;

    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.id === id));
    document.getElementById('page-title').textContent = item.label;
    document.getElementById('sidebar').classList.remove('open');

    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';

    // Cada módulo expõe um método mount(containerEl, role).
    window[item.module].mount(content, this.role);
  },

  renderNoAccess() {
    document.getElementById('sidebar-nav').innerHTML = '';
    document.getElementById('sidebar-user').innerHTML =
      `<div class="user-info"><div class="user-email">${esc(this.user.email)}</div></div>
       <button class="btn btn-ghost btn-block" onclick="logout()">Sair</button>`;
    document.getElementById('content').innerHTML = emptyState(
      'Você está autenticado, mas ainda não tem um perfil de acesso no sistema. ' +
      'Peça ao administrador (projetos@riogrande.ifrs.edu.br) para liberar seu acesso.');
    document.getElementById('page-title').textContent = 'Sem acesso';
  },

  renderFatal(msg) {
    document.getElementById('content').innerHTML = emptyState(msg,
      '<button class="btn btn-ghost" onclick="logout()">Sair e tentar de novo</button>');
  }
};

// Expõe no window: handlers inline (onclick) e App.navigate → window[module] dependem disso.
window.App = App;

window.addEventListener('DOMContentLoaded', () => App.init());
