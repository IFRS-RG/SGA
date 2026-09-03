// ============================================================
// SGA — Módulo Admin (frontend)
// Por enquanto: configurações de perfil de acesso.
// ============================================================
const Admin = {
  container: null,
  role: null,
  data: null,
  cursos: [],
  auditoria: null,
  _audLoaded: false,
  parametros: null,
  tab: 'perfis',

  async mount(container, role) {
    this.container = container;
    this.role = role;
    await this.reload();
  },

  async reload() {
    try {
      this.data = await API.getPerfis();
      try { this.cursos = await API.getCursos() || []; } catch (e) { this.cursos = []; }
      try { this.parametros = await API.getParametros() || {}; } catch (e) { this.parametros = {}; }
      this.render();
    } catch (e) {
      this.container.innerHTML = emptyState('Erro ao carregar perfis: ' + (e && e.message ? e.message : e));
    }
  },

  render() {
    const panel = this.tab === 'cursos' ? this.cursosSection()
                : this.tab === 'auditoria' ? this.auditoriaSection()
                : this.tab === 'parametros' ? this.parametrosSection()
                : this.perfisSection();
    this.container.innerHTML = `
      <div class="ftabs">
        <button type="button" class="ftab ${this.tab === 'perfis' ? 'active' : ''}" onclick="Admin.switchTab('perfis')">🔑 Perfis de acesso</button>
        <button type="button" class="ftab ${this.tab === 'cursos' ? 'active' : ''}" onclick="Admin.switchTab('cursos')">🎓 Cursos</button>
        <button type="button" class="ftab ${this.tab === 'parametros' ? 'active' : ''}" onclick="Admin.switchTab('parametros')">⚙️ Parâmetros</button>
        <button type="button" class="ftab ${this.tab === 'auditoria' ? 'active' : ''}" onclick="Admin.switchTab('auditoria')">📋 Auditoria</button>
      </div>
      <div id="admin-panel">${panel}</div>`;
  },

  async switchTab(t) {
    if (this.tab === t) return;
    this.tab = t;
    if (t === 'auditoria' && !this._audLoaded) {
      this.render();   // mostra o loading
      try { this.auditoria = await API.getAuditoria() || []; }
      catch (e) { this.auditoria = []; toast(e.message, 'error'); }
      this._audLoaded = true;
    }
    this.render();
  },

  auditoriaSection() {
    if (!this._audLoaded) return `<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>`;
    const logs = this.auditoria || [];
    const rows = logs.map(l => `
      <tr>
        <td class="cell-sub" style="white-space:nowrap">${esc(new Date(l.Timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}</td>
        <td>${esc(l.Ator || '')}</td>
        <td>${esc(l.Papel || '')}</td>
        <td>${esc(l.Acao || '')}</td>
        <td class="cell-sub">${esc(l.Alvo || '')}</td>
      </tr>`).join('');
    return `
      <section class="admin-section">
        <div class="section-head">
          <div>
            <h2>Auditoria</h2>
            <p class="section-sub">Registro de acessos e alterações (dados financeiros, etc.). Não contém os valores sensíveis.</p>
          </div>
        </div>
        ${logs.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Data/hora</th><th>Ator</th><th>Papel</th><th>Ação</th><th>Alvo</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : emptyState('Nenhum registro de auditoria ainda.')}
      </section>`;
  },

  perfisSection() {
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

    return `
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

  // ── Cursos (usados no cadastro de Aluno) ─────────────────────
  cursosSection() {
    const cursos = this.cursos || [];
    const rows = cursos.map(c => `
      <tr>
        <td><strong>${esc(c.Nome)}</strong></td>
        <td>${esc(c.Modalidade || '—')}</td>
        <td>${c.Status === 'Inativo' ? '<span class="badge badge-muted">Inativo</span>' : '<span class="badge badge-ok">Ativo</span>'}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-xs" onclick="Admin.openCurso('${esc(c.ID)}')">Editar</button>
          <button class="btn btn-danger btn-xs" onclick="Admin.removeCurso('${esc(c.ID)}')">Remover</button>
        </td>
      </tr>`).join('');

    return `
      <section class="admin-section">
        <div class="section-head">
          <div>
            <h2>Cursos</h2>
            <p class="section-sub">Cursos disponíveis no cadastro de alunos.</p>
          </div>
          <button class="btn btn-primary" onclick="Admin.openCurso()">+ Adicionar curso</button>
        </div>
        ${cursos.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Nome</th><th>Modalidade</th><th>Status</th><th class="col-actions">Ações</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : emptyState('Nenhum curso cadastrado ainda.')}
      </section>`;
  },

  openCurso(id) {
    const c = id ? (this.cursos || []).find(x => String(x.ID) === String(id)) : null;
    const body = `
      <div class="fg"><label>Nome do curso *</label>
        <input class="input" id="c-nome" value="${esc(c ? c.Nome : '')}"></div>
      <div class="fg"><label>Modalidade</label>
        <select class="input" id="c-modalidade">
          <option value="">— Selecione —</option>
          ${MODALIDADES_CURSO.map(m => `<option ${c && c.Modalidade === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
        </select></div>
      ${c ? `<div class="fg"><label>Status</label><select class="input" id="c-status">${optionsHtml(['Ativo', 'Inativo'], c.Status || 'Ativo')}</select></div>` : ''}`;
    openModal(c ? 'Editar curso' : 'Adicionar curso', body,
      async () => { await this.saveCurso(c ? c.ID : null); }, { confirmLabel: c ? 'Salvar' : 'Adicionar' });
  },

  async saveCurso(id) {
    const payload = { nome: val('c-nome'), modalidade: val('c-modalidade') };
    if (!payload.nome) { toast('Nome do curso é obrigatório.', 'error'); return; }
    setBusy(true);
    try {
      if (id) { payload.status = val('c-status'); await API.updateCurso(id, payload); toast('Curso atualizado.', 'success'); }
      else { await API.addCurso(payload); toast('Curso adicionado.', 'success'); }
      closeModal();
      await this.reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeCurso(id) {
    confirmDialog('Remover curso', 'Remover este curso?', async () => {
      try { await API.deleteCurso(id); toast('Curso removido.', 'success'); await this.reload(); }
      catch (e) { toast(e.message, 'error'); }
    }, 'Remover');
  },

  parametrosSection() {
    const p = this.parametros || {};
    const lim = p.limiteOrcamentos != null ? p.limiteOrcamentos : '';
    const portalId = p.portalSheetId != null ? p.portalSheetId : '';
    return `
      <section class="admin-section">
        <div class="section-head"><div>
          <h2>Parâmetros</h2>
          <p class="section-sub">Valores ajustáveis pela gestão.</p>
        </div></div>
        <div class="upload-box" style="max-width:520px">
          <div class="fg"><label>Limite para exigir 3 orçamentos (R$)</label>
            <input class="input" id="par-limite" value="${esc(lim)}">
            <span class="field-hint">Art. 7º da IN — 5% do teto do Art. 75, II da Lei 14.133 (atualmente R$ 3.274,60). Despesas com valor unitário acima disso são sinalizadas com ⚠ nas ações.</span></div>
          <button class="btn btn-primary" id="par-btn" onclick="Admin.saveParametros()">Salvar</button>
        </div>
        <div class="upload-box" style="max-width:520px;margin-top:12px">
          <div class="seg-head">Portal do aluno</div>
          <div class="fg"><label>ID da planilha do portal</label>
            <input class="input" id="par-portal" value="${esc(portalId)}">
            <span class="field-hint">É o código da URL da planilha do portal (entre <code>/d/</code> e <code>/edit</code>). O SGA publica as vagas e lê as inscrições dessa planilha.</span></div>
          <div class="page-actions">
            <button class="btn btn-primary" id="par-portal-btn" onclick="Admin.savePortalId()">Salvar ID</button>
            <button class="btn btn-ghost" id="par-prep-btn" onclick="Admin.prepararPortal()">Preparar planilha do portal</button>
          </div>
          <span class="field-hint">"Preparar" cria as abas (Selecao, Vagas, Inscricoes) na planilha do portal. A sincronização automática roda todo dia ~07:30 (rode <code>instalarGatilhoSync()</code> uma vez no editor para ativar).</span>
        </div>
      </section>`;
  },

  async saveParametros() {
    const btn = document.getElementById('par-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
    try {
      await API.setParametros({ limiteOrcamentos: parseMoney(val('par-limite')) });
      toast('Parâmetros salvos.', 'success');
      this.parametros = await API.getParametros() || {};
      this.render();
    } catch (e) { toast(e.message, 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; } }
  },

  async savePortalId() {
    const btn = document.getElementById('par-portal-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
    try {
      await API.setParametros({ portalSheetId: val('par-portal') });
      toast('ID do portal salvo.', 'success');
      this.parametros = await API.getParametros() || {};
      this.render();
    } catch (e) { toast(e.message, 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Salvar ID'; } }
  },

  async prepararPortal() {
    const btn = document.getElementById('par-prep-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Preparando…'; }
    try {
      const r = await API.prepararPortal();
      toast('Planilha do portal preparada.', 'success');
      if (r && r.url) window.open(r.url, '_blank');
    } catch (e) { toast(e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Preparar planilha do portal'; } }
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
    if (perfil === 'Admin' || perfil === 'Financeiro') {
      segEl.value = 'Todos'; segEl.disabled = true;
      if (hint) hint.textContent = perfil === 'Financeiro'
        ? 'Financeiro tem acesso aos dados financeiros de todos os segmentos.'
        : 'Administrador tem acesso a todos os segmentos.';
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
