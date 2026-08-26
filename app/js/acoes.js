// ============================================================
// SGA — Módulo Ações (frontend)
// Fatia A: lista + Dados. Fatia B: tela de detalhe com sub-abas +
// Documentos e Financeiro (uploads). Bolsistas/Voluntários = fatias C/D.
// Layout herdado de Editais.
// ============================================================
const Acoes = {
  container: null,
  role: null,
  acoes: [], editais: [], servidores: [], alunos: [],
  filter: '',
  view: 'list',          // 'list' | 'detail'
  currentId: null,
  detail: null,
  docs: [],
  detailTab: 'dados',

  async mount(container, role) {
    this.container = container;
    this.role = role;
    this.view = 'list';
    this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try {
      const [ac, ed, sv, al] = await Promise.all([
        API.getAcoes(), API.getEditais(), API.getServidores(), API.getAlunos()
      ]);
      this.acoes = ac || []; this.editais = ed || []; this.servidores = sv || []; this.alunos = al || [];
    } catch (e) {
      this.container.innerHTML = emptyState('Erro ao carregar: ' + (e && e.message ? e.message : e));
      return;
    }
    this.render();
  },

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },
  _reqId() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  onSearch(v) { this.filter = String(v || '').toLowerCase(); this.renderList(); },

  editalLabel(e) { return `${e.Numero || ''}/${e.Ano || ''} — ${e.Titulo || ''}`.trim(); },
  _editalNome(id) { const e = this.editais.find(x => String(x.ID) === String(id)); return e ? this.editalLabel(e) : '—'; },
  _pessoaNome(tipo, id) {
    if (!id) return '';
    const list = tipo === 'aluno' ? this.alunos : this.servidores;
    const r = list.find(x => String(x.ID) === String(id));
    return r ? r.Nome : '';
  },
  _br(iso) { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p[2] ? `${p[2]}/${p[1]}/${p[0]}` : iso; },
  _periodo(a) {
    if (!a.DataInicio && !a.DataFim) return '—';
    return (this._br(a.DataInicio) || '?') + ' a ' + (this._br(a.DataFim) || '?');
  },
  badge(s) { return `<span class="badge ${s === 'Ativa' ? 'badge-ok' : 'badge-muted'}">${esc(s || '—')}</span>`; },

  render() { if (this.view === 'detail') this.renderDetail(); else this.renderList(); },

  // ── Lista ───────────────────────────────────────────────────
  renderList() {
    const w = this.canWrite();
    const f = this.filter;
    const rows = !f ? this.acoes : this.acoes.filter(a =>
      String(a.Titulo || '').toLowerCase().includes(f) ||
      String(a.coordenadorNome || '').toLowerCase().includes(f) ||
      String(a.editalLabel || '').toLowerCase().includes(f));

    const menu = (id) => `<td class="col-actions">
      <details class="row-menu">
        <summary class="btn btn-ghost btn-xs">Ações ▾</summary>
        <div class="row-menu-list">
          <button onclick="Acoes.openDetail('${id}')">📂 Abrir</button>
          ${w ? `<button onclick="Acoes.openForm('${id}')">✏️ Editar dados</button>` : ''}
          ${w ? `<button class="danger" onclick="Acoes.remove('${id}')">🗑 Excluir</button>` : ''}
        </div>
      </details></td>`;

    const body = rows.map(a => `<tr>
      <td><a href="#" onclick="Acoes.openDetail('${a.ID}');return false;"><strong>${esc(a.Titulo)}</strong></a></td>
      <td>${esc(a.TipoAcao || '—')}</td>
      <td>${esc(a.coordenadorNome || '—')}</td>
      <td>${esc(a.Segmento || '—')}</td>
      <td class="cell-sub">${esc(a.editalLabel || '—')}</td>
      <td>${esc(this._periodo(a))}</td>
      <td>${this.badge(a.Status)}</td>${menu(a.ID)}
    </tr>`).join('');

    const table = rows.length ? `
      <div class="table-wrap menus">
        <table class="data-table">
          <thead><tr><th>Título</th><th>Tipo</th><th>Coordenador</th><th>Segmento</th><th>Edital</th><th>Período</th><th>Status</th><th class="col-actions">Ações</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`
      : emptyState(this.acoes.length ? 'Nenhuma ação corresponde à busca.' : 'Nenhuma ação cadastrada ainda.',
          (w && !this.acoes.length) ? `<button class="btn btn-primary" onclick="Acoes.openForm()">+ Criar a primeira ação</button>` : '');

    this.container.innerHTML = `
      <div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Acoes.openForm()">+ Nova ação</button>` : ''}</div>
      <div class="page-toolbar">
        <input class="input search" placeholder="Buscar por título, coordenador ou edital…" value="${esc(this.filter)}" oninput="Acoes.onSearch(this.value)">
      </div>
      <div class="toolbar-count">${rows.length} de ${this.acoes.length} ação(ões)</div>
      ${table}`;
  },

  // ── Detalhe (sub-abas) ──────────────────────────────────────
  async openDetail(id) {
    this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try {
      const [rec, docs] = await Promise.all([API.getAcao(id), API.getAcaoDocs(id)]);
      this.detail = rec; this.docs = docs || []; this.currentId = id; this.detailTab = 'dados'; this.view = 'detail';
    } catch (e) { toast(e.message, 'error'); this.view = 'list'; this.renderList(); return; }
    this.renderDetail();
  },

  async back() {
    this.view = 'list';
    this.renderList();
    try { this.acoes = await API.getAcoes() || []; this.renderList(); } catch (e) {}
  },

  switchDetailTab(t) { this.detailTab = t; this.renderDetail(); },

  renderDetail() {
    const d = this.detail;
    const tabs = [['dados', '📋 Dados'], ['documentos', '📎 Documentos'], ['bolsistas', '🎓 Bolsistas'], ['voluntarios', '🙌 Voluntários'], ['financeiro', '💰 Financeiro']];
    const ftabs = tabs.map(([id, label]) => `<button type="button" class="ftab ${this.detailTab === id ? 'active' : ''}" onclick="Acoes.switchDetailTab('${id}')">${label}</button>`).join('');
    this.container.innerHTML = `
      <div class="page-actions"><button class="btn btn-ghost" onclick="Acoes.back()">← Voltar</button></div>
      <h2 style="margin:6px 0 2px">${esc(d.titulo)}</h2>
      <p class="section-sub">${esc(d.tipoAcao || '')}${d.segmento ? ' · ' + esc(d.segmento) : ''}</p>
      <div class="ftabs">${ftabs}</div>
      <div id="acao-panel">${this._panel()}</div>`;
  },

  _panel() {
    switch (this.detailTab) {
      case 'documentos': return this._docsPanel('documentos');
      case 'financeiro': return this._docsPanel('financeiro');
      case 'bolsistas':  return emptyState('🚧 Bolsistas — em breve (Fatia C).');
      case 'voluntarios': return emptyState('🚧 Voluntários — em breve (Fatia D).');
      default: return this._dadosPanel();
    }
  },

  _dadosPanel() {
    const d = this.detail;
    const w = this.canWrite();
    const cell = (k, v) => `<div><span class="dk">${esc(k)}</span><span class="dv">${v}</span></div>`;
    const colabs = (d.colaboradores || []).map(c => (c.tipo === 'aluno' ? '🎓 ' : '👤 ') + esc(this._pessoaNome(c.tipo, c.id) || c.id)).join(', ') || '—';
    return `
      ${w ? `<div class="page-actions"><button class="btn btn-ghost btn-xs" onclick="Acoes.openForm('${d.ID}')">✏️ Editar dados</button></div>` : ''}
      <div class="detail-grid">
        ${cell('Tipo', esc(d.tipoAcao || '—'))}
        ${cell('Modalidade', esc(d.modalidade || '—'))}
        ${cell('Ano', esc(d.anoExecucao || '—'))}
        ${cell('Segmento', esc(d.segmento || '—'))}
        ${cell('Edital', esc(this._editalNome(d.editalId)))}
        ${cell('Status', esc(d.status || '—'))}
        ${cell('Coordenador', esc(this._pessoaNome('servidor', d.coordenadorId) || '—'))}
        ${cell('Coorientador', esc(this._pessoaNome('servidor', d.coorientadorId) || '—'))}
        ${cell('Período', esc((this._br(d.dataInicio) || '?') + ' a ' + (this._br(d.dataFim) || '?')))}
      </div>
      <div style="margin-top:12px"><span class="dk">Colaboradores</span><div class="dv">${colabs}</div></div>`;
  },

  _docsPanel(group) {
    const w = this.canWrite();
    const tipos = group === 'financeiro' ? TIPOS_FIN_ACAO : TIPOS_DOC_ACAO;
    const docs = (this.docs || []).filter(x => tipos.indexOf(x.Tipo) >= 0);
    const upBtns = w ? `<div class="page-actions" style="flex-wrap:wrap;gap:8px">
      ${tipos.map((t, i) => `<button class="btn btn-primary btn-xs" onclick="Acoes.pickFile('${group}', ${i})">⬆ ${esc(t)}</button>`).join('')}
    </div>` : '';
    const rows = docs.map(x => `<tr>
      <td>${esc(x.Tipo)}</td>
      <td><a href="${esc(x.DriveUrl)}" target="_blank" rel="noopener">${esc(x.NomeArquivo)}</a></td>
      <td class="cell-sub">${esc(x.DataUpload || '')}</td>
      ${w ? `<td class="col-actions"><button class="btn btn-danger btn-xs" onclick="Acoes.removeDoc('${x.ID}')">🗑</button></td>` : ''}
    </tr>`).join('');
    const table = docs.length
      ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Tipo</th><th>Arquivo</th><th>Enviado em</th>${w ? '<th class="col-actions"></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyState('Nenhum arquivo enviado ainda.');
    return upBtns + table;
  },

  pickFile(group, i) {
    const tipo = (group === 'financeiro' ? TIPOS_FIN_ACAO : TIPOS_DOC_ACAO)[i];
    let inp = document.getElementById('_acao-file');
    if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf'; inp.id = '_acao-file'; inp.style.display = 'none'; document.body.appendChild(inp); }
    inp.value = '';
    inp.onchange = () => this._doUpload(inp, tipo);
    inp.click();
  },

  async _doUpload(inp, tipo) {
    const file = inp.files && inp.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast('Arquivo muito grande (máx. 15 MB).', 'error'); return; }
    toast('Enviando…', 'info');
    try {
      const base64 = await fileToBase64(file);
      await API.uploadAcaoDoc({ acaoId: this.currentId, tipo: tipo, fileName: file.name, base64: base64 });
      toast('Arquivo enviado.', 'success');
      this.docs = await API.getAcaoDocs(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); }
  },

  removeDoc(id) {
    confirmDialog('Excluir arquivo', 'Excluir este arquivo? Ele vai para a lixeira do Drive.', async () => {
      try {
        await API.deleteAcaoDoc(id);
        toast('Arquivo excluído.', 'success');
        this.docs = await API.getAcaoDocs(this.currentId) || [];
        this.renderDetail();
      } catch (e) { toast(e.message, 'error'); }
    }, 'Excluir');
  },

  // ── Formulário Dados (add/edit) ─────────────────────────────
  async openForm(id) {
    if (!this.canWrite()) return;
    let rec = null;
    if (id) { try { rec = await API.getAcao(id); } catch (e) { toast(e.message, 'error'); return; } }
    openModal((id ? 'Editar ' : 'Nova ') + 'ação', this._form(rec),
      async () => { await this.save(id); }, { confirmLabel: id ? 'Salvar' : 'Criar ação' });
  },

  _form(r) {
    const optSel = (list, sel) => list.map(o => `<option ${sel === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    const tipoOpts = ['<option value="">— Selecione —</option>'].concat(TIPO_ACAO.map(t => `<option ${r && r.tipoAcao === t ? 'selected' : ''}>${esc(t)}</option>`)).join('');
    const editalOpts = ['<option value="">— Sem edital —</option>'].concat(this.editais.map(e => `<option value="${esc(e.ID)}" ${r && String(r.editalId) === String(e.ID) ? 'selected' : ''}>${esc(this.editalLabel(e))}</option>`)).join('');
    const segOpts = ['<option value="">—</option>'].concat(SEGMENTOS.map(s => `<option ${r && r.segmento === s ? 'selected' : ''}>${esc(s)}</option>`)).join('');
    const servOpt = (sel) => ['<option value="">—</option>'].concat(this.servidores.map(s => `<option value="${esc(s.ID)}" ${String(sel || '') === String(s.ID) ? 'selected' : ''}>${esc(s.Nome)}</option>`)).join('');
    const statusOpts = optSel(STATUS_ACAO, r ? r.status : 'Ativa');

    const colabSel = (r && r.colaboradores) || [];
    const isColab = (tipo, id) => colabSel.some(c => c.tipo === tipo && String(c.id) === String(id));
    const colabServ = this.servidores.map(s => `<label class="chk-item"><input type="checkbox" class="ac-colab" value="servidor|${esc(s.ID)}" ${isColab('servidor', s.ID) ? 'checked' : ''}><span>👤 ${esc(s.Nome)}</span></label>`).join('');
    const colabAlun = this.alunos.map(a => `<label class="chk-item"><input type="checkbox" class="ac-colab" value="aluno|${esc(a.ID)}" ${isColab('aluno', a.ID) ? 'checked' : ''}><span>🎓 ${esc(a.Nome)}</span></label>`).join('');

    return `
      <div class="form-grid">
        <div class="fg"><label>Tipo de ação</label><select class="input" id="ac-tipo">${tipoOpts}</select></div>
        <div class="fg"><label>Modalidade</label><input class="input" id="ac-modalidade" value="${esc(r ? r.modalidade : '')}"></div>
      </div>
      <div class="fg"><label>Título *</label><input class="input" id="ac-titulo" value="${esc(r ? r.titulo : '')}"></div>
      <div class="form-grid">
        <div class="fg"><label>Edital</label><select class="input" id="ac-edital" onchange="Acoes.onEditalChange()">${editalOpts}</select></div>
        <div class="fg"><label>Segmento</label><select class="input" id="ac-segmento">${segOpts}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Ano de execução</label><input class="input" id="ac-ano" value="${esc(r ? r.anoExecucao : new Date().getFullYear())}"></div>
        <div class="fg"><label>Status</label><select class="input" id="ac-status">${statusOpts}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Coordenador</label><select class="input" id="ac-coord">${servOpt(r ? r.coordenadorId : '')}</select></div>
        <div class="fg"><label>Coorientador</label><select class="input" id="ac-coorient">${servOpt(r ? r.coorientadorId : '')}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Data de início</label><input class="input" type="date" id="ac-inicio" value="${esc(r ? r.dataInicio : '')}"></div>
        <div class="fg"><label>Data de fim</label><input class="input" type="date" id="ac-fim" value="${esc(r ? r.dataFim : '')}"></div>
      </div>
      <div class="fg"><label>Colaboradores <span class="field-hint" style="display:inline">(servidores e alunos)</span></label>
        <div class="chk-list">${(colabServ + colabAlun) || '<span class="line-empty">Nenhum servidor/aluno cadastrado.</span>'}</div></div>`;
  },

  onEditalChange() {
    const e = this.editais.find(x => String(x.ID) === String(val('ac-edital')));
    const seg = document.getElementById('ac-segmento');
    if (e && e.Segmento && seg) seg.value = e.Segmento;
  },

  _harvest() {
    const colaboradores = Array.from(document.querySelectorAll('.ac-colab:checked')).map(el => {
      const parts = el.value.split('|');
      return { tipo: parts[0], id: parts[1] };
    });
    return {
      titulo: val('ac-titulo'), tipoAcao: val('ac-tipo'), modalidade: val('ac-modalidade'),
      anoExecucao: val('ac-ano'), segmento: val('ac-segmento'), editalId: val('ac-edital'),
      coordenadorId: val('ac-coord'), coorientadorId: val('ac-coorient'),
      colaboradores: colaboradores,
      dataInicio: val('ac-inicio'), dataFim: val('ac-fim'), status: val('ac-status')
    };
  },

  async save(id) {
    const p = this._harvest();
    setBusy(true);
    try {
      if (id) await API.updateAcao(id, p);
      else await API.addAcao(p, this._reqId());
      toast(id ? 'Ação atualizada.' : 'Ação criada.', 'success');
      closeModal();
      this.acoes = await API.getAcoes() || [];
      if (this.view === 'detail' && this.currentId) { this.detail = await API.getAcao(this.currentId); this.renderDetail(); }
      else this.renderList();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  remove(id) {
    if (!this.canWrite()) return;
    const a = this.acoes.find(x => String(x.ID) === String(id));
    confirmDialog('Excluir ação', `Excluir a ação "${a ? a.Titulo : ''}"? A pasta no Drive vai para a lixeira.`,
      async () => {
        try { await API.deleteAcao(id); toast('Ação excluída.', 'success'); this.view = 'list'; this.acoes = await API.getAcoes() || []; this.renderList(); }
        catch (e) { toast(e.message, 'error'); }
      }, 'Excluir');
  }
};

// app.js chama window['Acoes'].mount e os onclick inline usam Acoes.*
window.Acoes = Acoes;
