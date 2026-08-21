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
    } catch (e) {
      this.container.innerHTML = emptyState('Erro ao carregar perfis: ' + e.message);
      return;
    }
    this.render();
  },

  render() {
    const regs = this.data.registros || [];
    const rows = regs.map(r => `
      <tr>
        <td>${esc(r.Email)}</td>
        <td>${esc(r.Nome || '—')}</td>
        <td><span class="badge badge-perfil">${esc(r.Perfil)}</span></td>
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
            <thead><tr><th>E-mail</th><th>Nome</th><th>Perfil</th><th>Status</th><th class="col-actions">Ações</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : emptyState('Nenhum perfil cadastrado além do super admin.')}
      </section>`;
  },

  openForm(email) {
    const r = email ? (this.data.registros || []).find(x => String(x.Email).toLowerCase() === email.toLowerCase()) : null;
    const perfis = this.data.perfisDisponiveis || PERFIS;
    const body = `
      <div class="fg"><label>E-mail *</label>
        <input class="input" id="p-email" value="${esc(r ? r.Email : '')}" ${r ? 'disabled' : ''} placeholder="usuario@riogrande.ifrs.edu.br"></div>
      <div class="fg"><label>Nome</label><input class="input" id="p-nome" value="${esc(r ? r.Nome : '')}"></div>
      <div class="form-grid">
        <div class="fg"><label>Perfil</label><select class="input" id="p-perfil">${optionsHtml(perfis, r ? r.Perfil : 'Visualizador')}</select></div>
        ${r ? `<div class="fg"><label>Status</label><select class="input" id="p-status"><option ${r.Status !== 'Inativo' ? 'selected' : ''}>Ativo</option><option ${r.Status === 'Inativo' ? 'selected' : ''}>Inativo</option></select></div>` : ''}
      </div>`;
    openModal(r ? 'Editar acesso' : 'Adicionar acesso', body,
      async () => { await this.save(r ? r.Email : null); }, { confirmLabel: r ? 'Salvar' : 'Adicionar' });
  },

  async save(email) {
    setBusy(true);
    try {
      if (email) {
        await API.updatePerfil(email, { nome: val('p-nome'), perfil: val('p-perfil'), status: val('p-status') });
        toast('Acesso atualizado.', 'success');
      } else {
        const novo = val('p-email');
        if (!novo) { toast('E-mail é obrigatório.', 'error'); setBusy(false); return; }
        await API.addPerfil({ email: novo, nome: val('p-nome'), perfil: val('p-perfil') });
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
