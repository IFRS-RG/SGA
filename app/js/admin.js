// ============================================================
// SGA — Módulo Admin (frontend)
// Por enquanto: configurações de perfil de acesso.
// ============================================================
const Admin = {
  container: null,
  role: null,
  data: null,

  async mount(container, role) {
    this.container = container;
    this.role = role;
    await this.reload();
  },

  async reload() {
    try {
      this.data = await API.getPerfis();
      this.render();
    } catch (e) {
      this.container.innerHTML = emptyState('Erro ao carregar perfis: ' + (e && e.message ? e.message : e));
    }
  },

  render() {
    const regs = this.data.registros || [];
    const rows = regs.map(r => `
      <tr>
        <td>${esc(r.Email)}</td>
        <td>${esc(r.Nome || '—')}</td>
        <td><span class="badge badge-perfil">${esc(this.perfilLabel(r.Perfil))}</span></td>
        <td>${esc(r.Segmento || 'Todos')}</td>
        <td>${r.Status === 'Ativo' ? '<span class="badge badge-ok">Ativo</span>' : '<span class="badge badge-muted">Inativo</span>'}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-xs" onclick="Admin.openForm('${esc(r.Email)}')">Editar</button>
          <button class="btn btn-danger btn-xs" onclick="Admin.remove('${esc(r.Email)}')">Remover</button>
        </td>
      </tr>`).join('');

    this.container.innerHTML = `
      <section class="admin-section">
        <div class="section-head">
          <div>
            <h2>Perfis de acesso</h2>
            <p class="section-sub">Quem pode entrar no sistema e com qual perfil.</p>
          </div>
          <button class="btn btn-primary" onclick="Admin.openForm()">+ Adicionar acesso</button>
        </div>

        <div class="super-admin-card">
          <span class="badge badge-perfil">Admin</span>
          <div>
            <strong>${esc(this.data.superAdmin)}</strong>
            <div class="cell-sub">Super administrador · acesso geral (fixo, não editável)</div>
          </div>
        </div>

        ${regs.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>E-mail</th><th>Nome</th><th>Perfil</th><th>Segmento</th><th>Status</th><th class="col-actions">Ações</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : emptyState('Nenhum perfil cadastrado além do super admin.')}
      </section>`;
  },

  perfilLabel(p) { return p === 'Gestor' ? 'Gestor de Segmento' : p; },

  openForm(email) {
    const r = email ? (this.data.registros || []).find(x => String(x.Email).toLowerCase() === email.toLowerCase()) : null;
    const perfis = this.data.perfisDisponiveis || PERFIS;
    const segs   = this.data.segmentosAcesso || SEGMENTOS_ACESSO;
    const body = `
      <div class="fg"><label>E-mail *</label>
        <input class="input" id="p-email" value="${esc(r ? r.Email : '')}" ${r ? 'disabled' : ''} placeholder="usuario@riogrande.ifrs.edu.br"></div>
      <div class="fg"><label>Nome</label><input class="input" id="p-nome" value="${esc(r ? r.Nome : '')}"></div>
      <div class="form-grid">
        <div class="fg"><label>Perfil</label>
          <select class="input" id="p-perfil" onchange="Admin.onPerfilChange()">${optionsHtml(perfis, r ? r.Perfil : 'Visualizador')}</select></div>
        <div class="fg"><label>Segmento</label>
          <select class="input" id="p-segmento">${optionsHtml(segs, r ? (r.Segmento || 'Todos') : 'Todos')}</select></div>
      </div>
      ${r ? `<div class="fg"><label>Status</label><select class="input" id="p-status"><option ${r.Status !== 'Inativo' ? 'selected' : ''}>Ativo</option><option ${r.Status === 'Inativo' ? 'selected' : ''}>Inativo</option></select></div>` : ''}
      <p class="section-sub" id="p-seg-hint" style="margin-top:2px"></p>`;
    openModal(r ? 'Editar acesso' : 'Adicionar acesso', body,
      async () => { await this.save(r ? r.Email : null); }, { confirmLabel: r ? 'Salvar' : 'Adicionar' });
    this.onPerfilChange();
  },

  // Ajusta o campo Segmento conforme o perfil escolhido.
  onPerfilChange() {
    const perfil = val('p-perfil');
    const segEl = document.getElementById('p-segmento');
    const hint = document.getElementById('p-seg-hint');
    if (!segEl) return;
    if (perfil === 'Admin') {
      segEl.value = 'Todos'; segEl.disabled = true;
      if (hint) hint.textContent = 'Administrador tem acesso a todos os segmentos.';
    } else {
      segEl.disabled = false;
      if (perfil === 'Gestor' && segEl.value === 'Todos') {
        const first = Array.from(segEl.options).find(o => o.value !== 'Todos');
        if (first) segEl.value = first.value;
      }
      if (hint) hint.textContent = perfil === 'Gestor'
        ? 'Gestor gerencia editais e ações de um segmento específico.'
        : 'Visualizador pode ver um segmento específico ou todos.';
    }
  },

  async save(email) {
    const segmento = (document.getElementById('p-segmento') || {}).value;
    setBusy(true);
    try {
      if (email) {
        await API.updatePerfil(email, { nome: val('p-nome'), perfil: val('p-perfil'), segmento, status: val('p-status') });
        toast('Acesso atualizado.', 'success');
      } else {
        const novo = val('p-email');
        if (!novo) { toast('E-mail é obrigatório.', 'error'); setBusy(false); return; }
        await API.addPerfil({ email: novo, nome: val('p-nome'), perfil: val('p-perfil'), segmento });
        toast('Acesso adicionado.', 'success');
      }
      closeModal();
      await this.reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  async remove(email) {
    confirmDialog('Remover acesso', `Remover o acesso de ${email}?`, async () => {
      try { await API.deletePerfil(email); toast('Acesso removido.', 'success'); await this.reload(); }
      catch (e) { toast(e.message, 'error'); }
    }, 'Remover');
  }
};

// Necessário: app.js chama window['Admin'].mount e os onclick inline usam Admin.*
window.Admin = Admin;
