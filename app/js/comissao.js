// ============================================================
// SGA — Módulo Comissão (placeholder com 4 sub-abas)
// CGAE (Extensão) · CAGPPI (Pesquisa) · CAGE (Ensino) · CIEP (Indissociável)
// ============================================================
const Comissao = {
  container: null,
  role: null,
  tab: 'CGAE',
  tabs: [
    ['CGAE', 'CGAE (Extensão)'],
    ['CAGPPI', 'CAGPPI (Pesquisa)'],
    ['CAGE', 'CAGE (Ensino)'],
    ['CIEP', 'CIEP (Indissociável)']
  ],

  mount(container, role) {
    this.container = container;
    this.role = role;
    this.tab = 'CGAE';
    this.render();
  },

  switchTab(t) { this.tab = t; this.render(); },

  render() {
    const ftabs = this.tabs.map(([id, label]) =>
      `<button type="button" class="ftab ${this.tab === id ? 'active' : ''}" onclick="Comissao.switchTab('${id}')">${esc(label)}</button>`).join('');
    const cur = this.tabs.find(t => t[0] === this.tab);
    this.container.innerHTML =
      `<div class="ftabs">${ftabs}</div>` +
      emptyState('🚧 ' + esc(cur ? cur[1] : '') + ' — em construção. Em breve.');
  }
};

window.Comissao = Comissao;
