// ============================================================
// SGA — Módulo Seleção (processo seletivo)
// Lista de seleções + "Nova seleção": escolhe Edital → Ação (com vagas
// ofertadas ativas) → as vagas do processo. Avaliação de candidatos = depois.
// ============================================================
const Selecao = {
  container: null,
  role: null,
  selecoes: [],
  editais: [],
  _nvAcoes: [],   // ações com vagas do edital escolhido no modal

  async mount(container, role) {
    this.container = container;
    this.role = role;
    this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try {
      const [sel, ed] = await Promise.all([API.getSelecoes(), API.getEditais()]);
      this.selecoes = sel || [];
      this.editais = ed || [];
    } catch (e) {
      this.container.innerHTML = emptyState('Erro ao carregar: ' + (e && e.message ? e.message : e));
      return;
    }
    this.render();
  },

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },
  _reqId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },

  render() {
    const w = this.canWrite();
    const rows = (this.selecoes || []).map(s => {
      const vagas = (s.vagas || []).map(v => esc(v.Titulo)).join(', ') || '—';
      const menu = w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
        <button class="danger" onclick="Selecao.remove('${s.ID}')">🗑 Excluir</button>
      </div></details></td>` : '';
      return `<tr>
        <td><strong>${esc(s.acaoTitulo || '—')}</strong></td>
        <td class="cell-sub">${esc(s.editalLabel || '—')}</td>
        <td>${esc(s.segmento || '—')}</td>
        <td class="cell-sub">${vagas}</td>
        <td><span class="badge ${s.Status === 'Aberta' ? 'badge-ok' : 'badge-muted'}">${esc(s.Status || '—')}</span></td>
        ${menu}
      </tr>`;
    }).join('');

    const table = (this.selecoes || []).length ? `
      <div class="table-wrap menus"><table class="data-table">
        <thead><tr><th>Ação</th><th>Edital</th><th>Segmento</th><th>Vagas</th><th>Status</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody></table></div>`
      : emptyState('Nenhuma seleção criada ainda.');

    this.container.innerHTML = `
      <div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Selecao.openNova()">+ Nova seleção</button>` : ''}</div>
      ${table}`;
  },

  openNova() {
    if (!this.canWrite()) return;
    this._nvAcoes = [];
    const editalOpts = ['<option value="">— Selecione o edital —</option>']
      .concat(this.editais.map(e => `<option value="${esc(e.ID)}">${esc((e.Numero || '') + '/' + (e.Ano || '') + ' — ' + (e.Titulo || ''))}</option>`)).join('');
    const body = `
      <div class="fg"><label>Edital *</label><select class="input" id="sel-edital" onchange="Selecao.onEdital()">${editalOpts}</select></div>
      <div class="fg"><label>Ação (com vagas ofertadas ativas) *</label>
        <select class="input" id="sel-acao" onchange="Selecao.onAcao()" disabled><option value="">— escolha o edital primeiro —</option></select></div>
      <div class="fg"><label>Vagas ofertadas *</label><div class="chk-list" id="sel-vagas"><span class="field-hint">Escolha a ação para listar as vagas.</span></div></div>`;
    openModal('Nova seleção', body, async () => { await this.saveNova(); }, { confirmLabel: 'Criar seleção' });
  },

  async onEdital() {
    const editalId = val('sel-edital');
    const acaoSel = document.getElementById('sel-acao');
    const vagasBox = document.getElementById('sel-vagas');
    vagasBox.innerHTML = '<span class="field-hint">Escolha a ação para listar as vagas.</span>';
    if (!editalId) { acaoSel.disabled = true; acaoSel.innerHTML = '<option value="">— escolha o edital primeiro —</option>'; return; }
    acaoSel.disabled = true;
    acaoSel.innerHTML = '<option value="">carregando…</option>';
    try {
      this._nvAcoes = await API.getAcoesComVagas(editalId) || [];
    } catch (e) { toast(e.message, 'error'); this._nvAcoes = []; }
    if (!this._nvAcoes.length) {
      acaoSel.innerHTML = '<option value="">— nenhuma ação com vagas ativas —</option>';
      return;
    }
    acaoSel.innerHTML = ['<option value="">— Selecione a ação —</option>']
      .concat(this._nvAcoes.map(a => `<option value="${esc(a.acaoId)}">${esc(a.titulo)}</option>`)).join('');
    acaoSel.disabled = false;
  },

  onAcao() {
    const acaoId = val('sel-acao');
    const vagasBox = document.getElementById('sel-vagas');
    const a = (this._nvAcoes || []).find(x => String(x.acaoId) === String(acaoId));
    if (!a) { vagasBox.innerHTML = '<span class="field-hint">Escolha a ação para listar as vagas.</span>'; return; }
    vagasBox.innerHTML = a.vagas.map(v =>
      `<label class="chk-item"><input type="checkbox" class="sel-vaga" value="${esc(v.ID)}" checked> ${v.Tipo === 'Bolsista' ? '🎓' : '🙌'} ${esc(v.Titulo)}</label>`).join('')
      || '<span class="field-hint">Esta ação não tem vagas ativas.</span>';
  },

  async saveNova() {
    const editalId = val('sel-edital');
    const acaoId = val('sel-acao');
    const vagas = Array.from(document.querySelectorAll('.sel-vaga:checked')).map(i => i.value);
    if (!editalId) { toast('Escolha o edital.', 'error'); return; }
    if (!acaoId) { toast('Escolha a ação.', 'error'); return; }
    if (!vagas.length) { toast('Escolha ao menos uma vaga.', 'error'); return; }
    setBusy(true);
    try {
      await API.addSelecao({ editalId: editalId, acaoId: acaoId, vagas: vagas }, this._reqId());
      toast('Seleção criada.', 'success');
      closeModal();
      this.selecoes = await API.getSelecoes() || [];
      this.render();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  remove(id) {
    if (!window.confirm('Excluir esta seleção?')) return;
    (async () => {
      try { await API.deleteSelecao(id); toast('Seleção excluída.', 'success'); this.selecoes = await API.getSelecoes() || []; this.render(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  }
};

window.Selecao = Selecao;
