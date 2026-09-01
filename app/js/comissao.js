// ============================================================
// SGA — Módulo Comissão (CGAE/CAGPPI/CAGE/CIEP)
// Cada aba = uma comissão, com 2 sub-abas: "Comissão" (cadastros:
// portaria + período + membros) e "Câmaras" (câmaras que escolhem
// membros do cadastro). Layout herdado de Editais.
// ============================================================
const Comissao = {
  container: null,
  role: null,
  comissoes: [],
  tab: 'CGAE',
  subtab: 'comissao',
  camaraCadastroId: '',
  tabs: [
    ['CGAE', 'CGAE (Extensão)'],
    ['CAGPPI', 'CAGPPI (Pesquisa)'],
    ['CAGE', 'CAGE (Ensino)'],
    ['CIEP', 'CIEP (Indissociável)']
  ],

  async mount(container, role) {
    this.container = container;
    this.role = role;
    this.tab = 'CGAE';
    this.subtab = 'comissao';
    await this.reload(true);
  },

  async reload(showLoading) {
    if (showLoading) this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try { this.comissoes = await API.getComissoes() || []; }
    catch (e) { this.container.innerHTML = emptyState('Erro ao carregar: ' + (e && e.message ? e.message : e)); return; }
    this.render();
  },

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },
  _reqId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  _br(iso) { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p[2] ? `${p[2]}/${p[1]}/${p[0]}` : iso; },
  _doTipo() { return (this.comissoes || []).filter(c => c.Tipo === this.tab); },

  switchTab(t) { this.tab = t; this.subtab = 'comissao'; this.camaraCadastroId = ''; this.render(); },
  switchSub(s) { this.subtab = s; this.render(); },

  render() {
    const ftabs = this.tabs.map(([id, label]) =>
      `<button type="button" class="ftab ${this.tab === id ? 'active' : ''}" onclick="Comissao.switchTab('${id}')">${esc(label)}</button>`).join('');
    const subs = [['comissao', 'Comissão'], ['camaras', 'Câmaras']].map(([id, label]) =>
      `<button type="button" class="ftab ${this.subtab === id ? 'active' : ''}" onclick="Comissao.switchSub('${id}')">${esc(label)}</button>`).join('');
    const panel = this.subtab === 'camaras' ? this._camarasPanel() : this._comissaoPanel();
    this.container.innerHTML = `
      <div class="ftabs">${ftabs}</div>
      <div class="ftabs" style="margin-top:8px">${subs}</div>
      <div style="margin-top:12px">${panel}</div>`;
  },

  // ── Sub-aba: Comissão (cadastros) ──────────────────────────
  _comissaoPanel() {
    const w = this.canWrite();
    const cads = this._doTipo();
    const rows = cads.map(c => {
      const menu = w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
        <button onclick="Comissao.openCadastro('${c.ID}')">✏️ Editar</button>
        <button class="danger" onclick="Comissao.removeCadastro('${c.ID}')">🗑 Excluir</button>
      </div></details></td>` : '';
      return `<tr>
        <td>${c.PortariaUrl ? `<a href="${esc(c.PortariaUrl)}" target="_blank" rel="noopener">Portaria</a>` : '<span class="cell-sub">sem portaria</span>'}</td>
        <td>${esc((this._br(c.DataInicio) || '?') + ' a ' + (this._br(c.DataFim) || '?'))}</td>
        <td>${(c.membros || []).length} membro(s)</td>
        <td>${(c.camaras || []).length} câmara(s)</td>
        ${menu}
      </tr>`;
    }).join('');
    const table = cads.length ? `<div class="table-wrap menus"><table class="data-table">
      <thead><tr><th>Portaria</th><th>Vigência</th><th>Membros</th><th>Câmaras</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>` : emptyState('Nenhum cadastro desta comissão ainda.');
    return `<div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Comissao.openCadastro()">+ Novo cadastro</button>` : ''}</div>${table}`;
  },

  _membroRowHtml(m) {
    m = m || {};
    const catOpts = CATEGORIA_MEMBRO.map(o => `<option ${m.categoria === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<tr class="mb-row" data-id="${esc(m.id || '')}">
      <td><input class="input mb-nome" value="${esc(m.nome || '')}" placeholder="Nome"></td>
      <td><input class="input mb-doc" value="${esc(m.doc || '')}" placeholder="SIAPE ou matrícula"></td>
      <td><input class="input mb-email" value="${esc(m.email || '')}" placeholder="e-mail"></td>
      <td style="width:120px"><select class="input mb-cat">${catOpts}</select></td>
      <td style="width:36px"><button type="button" class="btn btn-ghost btn-xs danger" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`;
  },

  addMembroRow() {
    const tb = document.getElementById('cad-membros');
    if (tb) tb.insertAdjacentHTML('beforeend', this._membroRowHtml());
  },

  openCadastro(id) {
    if (!this.canWrite()) return;
    const c = id ? this._doTipo().find(x => String(x.ID) === String(id)) : null;
    const membros = (c && c.membros && c.membros.length ? c.membros : [{}]).map(m => this._membroRowHtml(m)).join('');
    const body = `
      <div class="fg"><label>Portaria (PDF)</label>
        ${c && c.PortariaUrl ? `<div class="field-hint"><a href="${esc(c.PortariaUrl)}" target="_blank" rel="noopener">Portaria atual</a> · <label class="chk-item" style="display:inline-flex"><input type="checkbox" id="cad-port-remove"> remover</label></div>` : ''}
        <input type="file" accept="application/pdf,.pdf" class="input" id="cad-portaria">
        <span class="field-hint">PDF.</span></div>
      <div class="form-grid">
        <div class="fg"><label>Início da portaria</label><input class="input" type="date" id="cad-inicio" value="${esc(c ? c.DataInicio : '')}"></div>
        <div class="fg"><label>Fim da portaria</label><input class="input" type="date" id="cad-fim" value="${esc(c ? c.DataFim : '')}"></div>
      </div>
      <div class="seg-head" style="margin-top:12px">Membros</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Nome</th><th>SIAPE / matrícula</th><th>E-mail</th><th>Categoria</th><th></th></tr></thead>
        <tbody id="cad-membros">${membros}</tbody></table></div>
      <div class="page-actions"><button type="button" class="btn btn-ghost btn-xs" onclick="Comissao.addMembroRow()">+ Adicionar membro</button></div>`;
    openModal((id ? 'Editar ' : 'Novo ') + 'cadastro — ' + this.tab, body, async () => { await this.saveCadastro(id); }, { confirmLabel: id ? 'Salvar' : 'Cadastrar' });
  },

  _harvestMembros() {
    return Array.from(document.querySelectorAll('#cad-membros .mb-row')).map(tr => ({
      id: tr.getAttribute('data-id') || '',
      nome: tr.querySelector('.mb-nome').value.trim(),
      doc: tr.querySelector('.mb-doc').value.trim(),
      email: tr.querySelector('.mb-email').value.trim(),
      categoria: tr.querySelector('.mb-cat').value
    })).filter(m => m.nome);
  },

  async saveCadastro(id) {
    const p = {
      tipo: this.tab,
      dataInicio: val('cad-inicio'),
      dataFim: val('cad-fim'),
      membros: this._harvestMembros()
    };
    const fileEl = document.getElementById('cad-portaria');
    const file = fileEl && fileEl.files[0];
    if (file) {
      if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) { toast('A portaria deve ser um PDF.', 'error'); return; }
      p.portariaBase64 = await fileToBase64(file);
      p.portariaFileName = file.name;
    }
    if (id && document.getElementById('cad-port-remove') && document.getElementById('cad-port-remove').checked && !file) p.portariaRemove = true;
    setBusy(true);
    try {
      if (id) await API.updateComissao(id, p);
      else await API.addComissao(p, this._reqId());
      toast(id ? 'Cadastro atualizado.' : 'Cadastro criado.', 'success');
      closeModal();
      await this.reload(false);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeCadastro(id) {
    if (!window.confirm('Excluir este cadastro da comissão?')) return;
    (async () => {
      try { await API.deleteComissao(id); toast('Cadastro excluído.', 'success'); await this.reload(false); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  // ── Sub-aba: Câmaras ────────────────────────────────────────
  _camarasPanel() {
    const w = this.canWrite();
    const cads = this._doTipo();
    if (!cads.length) return emptyState('Cadastre a comissão (sub-aba "Comissão") antes de criar câmaras.');
    if (!this.camaraCadastroId || !cads.find(c => String(c.ID) === String(this.camaraCadastroId))) {
      this.camaraCadastroId = cads[0].ID;
    }
    const cad = cads.find(c => String(c.ID) === String(this.camaraCadastroId));
    const cadOpts = cads.map(c => `<option value="${esc(c.ID)}" ${String(c.ID) === String(this.camaraCadastroId) ? 'selected' : ''}>Portaria ${esc((this._br(c.DataInicio) || '?'))} — ${(c.membros || []).length} membro(s)</option>`).join('');
    const membros = cad.membros || [];
    if (!membros.length) return `<div class="fg"><label>Cadastro</label><select class="input" onchange="Comissao.pickCadastro(this.value)">${cadOpts}</select></div>
      ${emptyState('Este cadastro não tem membros. Adicione membros na sub-aba "Comissão".')}`;

    const camaras = cad.camaras || [];
    const cards = camaras.map((cam, i) => this._camaraCardHtml(cam, i, membros, w)).join('');
    return `
      <div class="fg"><label>Cadastro (portaria)</label><select class="input" onchange="Comissao.pickCadastro(this.value)">${cadOpts}</select></div>
      <div id="cam-cards">${cards || `<p class="field-hint">Nenhuma câmara ainda.</p>`}</div>
      ${w ? `<div class="page-actions">
        <button class="btn btn-ghost btn-xs" onclick="Comissao.addCamaraCard()">+ Adicionar câmara</button>
        <button class="btn btn-primary" onclick="Comissao.saveCamaras()">Salvar câmaras</button></div>` : ''}`;
  },

  pickCadastro(id) { this.camaraCadastroId = id; this.render(); },

  _camaraCardHtml(cam, i, membros, w) {
    cam = cam || { membros: [] };
    const chosen = (cam.membros || []).map(String);
    const chks = membros.map(m =>
      `<label class="chk-item"><input type="checkbox" class="cam-mb" value="${esc(m.id)}" ${chosen.indexOf(String(m.id)) !== -1 ? 'checked' : ''} ${w ? '' : 'disabled'}> ${esc(m.nome)} <span class="cell-sub">${esc(m.categoria || '')}</span></label>`).join('');
    return `<div class="upload-box cam-card" style="margin-bottom:12px">
      <div class="seg-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <input class="input cam-nome" value="${esc(cam.nome || ('Câmara ' + (i + 1)))}" style="max-width:260px" ${w ? '' : 'readonly'}>
        ${w ? `<button type="button" class="btn btn-ghost btn-xs danger" onclick="this.closest('.cam-card').remove()">Remover</button>` : ''}
      </div>
      <div class="chk-list" style="margin-top:8px">${chks}</div>
    </div>`;
  },

  addCamaraCard() {
    const cads = this._doTipo();
    const cad = cads.find(c => String(c.ID) === String(this.camaraCadastroId));
    if (!cad) return;
    const box = document.getElementById('cam-cards');
    const hint = box.querySelector('.field-hint'); if (hint) hint.remove();
    const n = box.querySelectorAll('.cam-card').length;
    box.insertAdjacentHTML('beforeend', this._camaraCardHtml({ nome: 'Câmara ' + (n + 1), membros: [] }, n, cad.membros || [], true));
  },

  async saveCamaras() {
    const cads = this._doTipo();
    const cad = cads.find(c => String(c.ID) === String(this.camaraCadastroId));
    if (!cad) return;
    const camaras = Array.from(document.querySelectorAll('#cam-cards .cam-card')).map(card => ({
      nome: card.querySelector('.cam-nome').value.trim(),
      membros: Array.from(card.querySelectorAll('.cam-mb:checked')).map(i => i.value)
    })).filter(c => c.nome);
    setBusy(true);
    try {
      await API.setComissaoCamaras(cad.ID, camaras);
      toast('Câmaras salvas.', 'success');
      await this.reload(false);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
};

window.Comissao = Comissao;
