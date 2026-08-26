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
  bolsistas: [],
  voluntarios: [],
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
      const [rec, docs, bols, vols] = await Promise.all([API.getAcao(id), API.getAcaoDocs(id), API.getBolsistas(id), API.getVoluntarios(id)]);
      this.detail = rec; this.docs = docs || []; this.bolsistas = bols || []; this.voluntarios = vols || []; this.currentId = id; this.detailTab = 'dados'; this.view = 'detail';
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
      case 'bolsistas':  return this._bolsistasPanel();
      case 'voluntarios': return this._voluntariosPanel();
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

  // group define o conjunto de tipos e é lido pelo upload para saber o Tipo.
  _docsPanel(group) {
    const w = this.canWrite();
    const tipos = group === 'financeiro' ? TIPOS_FIN_ACAO : TIPOS_DOC_ACAO;
    const docs = (this.docs || []).filter(x => tipos.indexOf(x.Tipo) >= 0);
    const uploader = w ? `
      <div class="upload-box">
        <div class="fg"><label>Nome do documento</label>
          <input class="input" id="acdoc-nome" placeholder="ex.: Relatório final — ${esc(this.detail ? this.detail.titulo : '')}"></div>
        <div class="fg"><label>Tipo</label><select class="input" id="acdoc-tipo">${optionsHtml(tipos)}</select></div>
        <div class="fg"><label>Arquivo PDF</label>
          <input type="file" accept="application/pdf,.pdf" class="input" id="acdoc-file" onchange="Acoes.onDocFile()">
          <span class="field-hint" id="acdoc-file-name"></span></div>
        <button class="btn btn-primary" id="acdoc-btn" onclick="Acoes.uploadDoc()">Enviar PDF</button>
      </div>` : '';
    const list = docs.length ? `
      <ul class="doc-list">
        ${docs.map(d => `
          <li class="doc-item">
            <span class="doc-type doc-type--demais">${esc(d.Tipo)}</span>
            <a class="doc-name" href="${esc(d.DriveUrl)}" target="_blank" rel="noopener">${esc(d.NomeArquivo)}</a>
            <span class="doc-date">${esc(d.DataUpload || '')}</span>
            ${w ? `<button class="btn btn-ghost btn-xs" onclick="Acoes.renameDoc('${d.ID}')">Renomear</button>` : ''}
            ${w ? `<button class="btn btn-danger btn-xs" onclick="Acoes.removeDoc('${d.ID}')">Remover</button>` : ''}
          </li>`).join('')}
      </ul>` : emptyState('Nenhum arquivo enviado ainda.');
    return uploader + list;
  },

  onDocFile() {
    const f = document.getElementById('acdoc-file');
    const n = document.getElementById('acdoc-nome');
    const fn = document.getElementById('acdoc-file-name');
    const file = f && f.files[0];
    if (file && n && !n.value) n.value = file.name.replace(/\.pdf$/i, '');
    if (fn) fn.textContent = file ? 'Arquivo escolhido: ' + file.name : '';
  },

  async uploadDoc() {
    const fileEl = document.getElementById('acdoc-file');
    const tipo = val('acdoc-tipo');
    const nome = val('acdoc-nome');
    const file = fileEl && fileEl.files[0];
    if (!file) { toast('Selecione um arquivo PDF.', 'error'); return; }
    if (!/\.pdf$/i.test(file.name)) { toast('O arquivo precisa ter extensão .pdf.', 'error'); return; }
    if (file.type && file.type !== 'application/pdf') { toast('O arquivo precisa ser um PDF.', 'error'); return; }
    const btn = document.getElementById('acdoc-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
    try {
      const base64 = await fileToBase64(file);
      await API.uploadAcaoDoc({ acaoId: this.currentId, tipo: tipo, nome: nome, fileName: file.name, base64: base64 });
      toast('PDF enviado.', 'success');
      this.docs = await API.getAcaoDocs(this.currentId) || [];
      this.renderDetail();
    } catch (e) {
      toast(e.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar PDF'; }
    }
  },

  async renameDoc(docId) {
    const d = (this.docs || []).find(x => String(x.ID) === String(docId));
    const atual = d ? String(d.NomeArquivo || '').replace(/\.pdf$/i, '') : '';
    const novo = window.prompt('Novo nome do documento:', atual);
    if (novo == null) return;
    if (!novo.trim()) { toast('Informe um nome.', 'error'); return; }
    try {
      await API.renameAcaoDoc(docId, novo);
      toast('Documento renomeado.', 'success');
      this.docs = await API.getAcaoDocs(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); }
  },

  removeDoc(id) {
    if (!window.confirm('Remover este arquivo? Ele vai para a lixeira do Drive.')) return;
    (async () => {
      try {
        await API.deleteAcaoDoc(id);
        toast('Arquivo removido.', 'success');
        this.docs = await API.getAcaoDocs(this.currentId) || [];
        this.renderDetail();
      } catch (e) { toast(e.message, 'error'); }
    })();
  },

  // ── Bolsistas ───────────────────────────────────────────────
  _vbadge(s) { return `<span class="badge ${s === 'Ativo' ? 'badge-ok' : 'badge-muted'}">${esc(s || '—')}</span>`; },
  _semanasFront(ini, fim) {
    if (!ini || !fim) return 0;
    const d1 = new Date(ini + 'T00:00:00'), d2 = new Date(fim + 'T00:00:00');
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return 0;
    return Math.floor((d2 - d1) / (7 * 24 * 3600 * 1000));
  },
  // Valor da bolsa a partir das linhas de bolsa do edital (casando pela CH e, se houver, pelo segmento).
  _valorBolsaDoEdital(editalId, ch) {
    const e = this.editais.find(x => String(x.ID) === String(editalId));
    if (!e || !e.bolsas) return '';
    const seg = this.detail ? this.detail.segmento : '';
    let line = e.bolsas.find(b => String(b.ch) === String(ch) && b.segmento && b.segmento === seg);
    if (!line) line = e.bolsas.find(b => String(b.ch) === String(ch));
    return line ? line.valor : '';
  },

  _bolsistasPanel() {
    const w = this.canWrite();
    const bs = this.bolsistas || [];
    const menu = (id) => w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
      <button onclick="Acoes.openBolsista('${id}')">✏️ Editar</button>
      <button onclick="Acoes.pickRelatorio('${id}')">📄 Enviar relatório</button>
      <button class="danger" onclick="Acoes.removeBolsista('${id}')">🗑 Excluir</button>
    </div></details></td>` : '';
    const rows = bs.map(b => `<tr>
      <td><strong>${esc(b.alunoNome || '—')}</strong></td>
      <td>${esc(b.CHBolsa || '—')}h</td>
      <td>${b.ValorBolsa !== '' && b.ValorBolsa != null ? fmtMoney(b.ValorBolsa) : '—'}</td>
      <td>${esc((this._br(b.DataInicio) || '?') + ' a ' + (this._br(b.DataFim) || '?'))}</td>
      <td class="cell-sub">${esc(String(b.TotalSemanas || 0))} sem · ${esc(String(b.CHTotal || 0))}h</td>
      <td>${esc(b.StatusSIGAA || '—')}</td>
      <td>${b.temRelatorio ? `<a href="${esc(b.relatorioUrl)}" target="_blank" rel="noopener">${esc(b.StatusRelatorio || 'ver')}</a>` : esc(b.StatusRelatorio || '—')}</td>
      <td>${this._vbadge(b.Status)}</td>${menu(b.ID)}
    </tr>`).join('');
    const table = bs.length ? `<div class="table-wrap menus"><table class="data-table">
      <thead><tr><th>Aluno</th><th>CH</th><th>Valor</th><th>Período</th><th>Semanas · CH total</th><th>SIGAA</th><th>Relatório</th><th>Status</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>` : emptyState('Nenhum bolsista cadastrado nesta ação.');
    return `<div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Acoes.openBolsista()">+ Adicionar bolsista</button>` : ''}</div>${table}`;
  },

  openBolsista(id) {
    if (!this.canWrite()) return;
    const b = id ? (this.bolsistas || []).find(x => String(x.ID) === String(id)) : null;
    openModal((id ? 'Editar ' : 'Novo ') + 'bolsista', this._bolsistaForm(b),
      async () => { await this.saveBolsista(id); }, { confirmLabel: id ? 'Salvar' : 'Adicionar' });
    setTimeout(() => this.recalcBolsista(), 50);
  },

  _bolsistaForm(b) {
    const alunoOpts = ['<option value="">— Selecione —</option>'].concat(this.alunos.map(a => `<option value="${esc(a.ID)}" ${b && String(b.AlunoID) === String(a.ID) ? 'selected' : ''}>${esc(a.Nome)}</option>`)).join('');
    const editalOpts = ['<option value="">— Selecione —</option>'].concat(this.editais.map(e => `<option value="${esc(e.ID)}" ${b && String(b.EditalBolsaID) === String(e.ID) ? 'selected' : ''}>${esc(this.editalLabel(e))}</option>`)).join('');
    const chOpts = ['<option value="">—</option>'].concat(CH_BOLSA.map(c => `<option ${b && String(b.CHBolsa) === String(c) ? 'selected' : ''}>${esc(c)}</option>`)).join('');
    const menuOpts = (list, sel) => ['<option value="">—</option>'].concat(list.map(o => `<option ${sel === o ? 'selected' : ''}>${esc(o)}</option>`)).join('');
    const statusOpts = STATUS_VINCULO.map(o => `<option ${(b ? b.Status : 'Ativo') === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `
      <div class="fg"><label>Aluno *</label><select class="input" id="bo-aluno">${alunoOpts}</select></div>
      <div class="form-grid">
        <div class="fg"><label>Edital da bolsa</label><select class="input" id="bo-edital" onchange="Acoes.onBolsaEditalOrCh()">${editalOpts}</select></div>
        <div class="fg"><label>CH semanal</label><select class="input" id="bo-ch" onchange="Acoes.onBolsaEditalOrCh()">${chOpts}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Valor da bolsa (R$)</label><input class="input" id="bo-valor" value="${esc(b ? b.ValorBolsa : '')}"></div>
        <div class="fg"><label>Status</label><select class="input" id="bo-status">${statusOpts}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Data de início</label><input class="input" type="date" id="bo-inicio" value="${esc(b ? b.DataInicio : '')}" oninput="Acoes.recalcBolsista()"></div>
        <div class="fg"><label>Data de término</label><input class="input" type="date" id="bo-fim" value="${esc(b ? b.DataFim : '')}" oninput="Acoes.recalcBolsista()"></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Total de semanas</label><input class="input" id="bo-semanas" disabled value="${esc(b ? b.TotalSemanas : '')}"></div>
        <div class="fg"><label>CH total</label><input class="input" id="bo-chtotal" disabled value="${esc(b ? b.CHTotal : '')}"></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Status no SIGAA</label><select class="input" id="bo-sigaa">${menuOpts(STATUS_SIGAA, b ? b.StatusSIGAA : '')}</select></div>
        <div class="fg"><label>Relatório final</label><select class="input" id="bo-rel">${menuOpts(STATUS_RELATORIO, b ? b.StatusRelatorio : '')}</select></div>
      </div>
      <div class="fg"><label>Observações</label><textarea class="input" id="bo-obs" rows="2">${esc(b ? b.Observacoes : '')}</textarea></div>`;
  },

  onBolsaEditalOrCh() {
    const v = this._valorBolsaDoEdital(val('bo-edital'), val('bo-ch'));
    const el = document.getElementById('bo-valor');
    if (el && v !== '' && v != null) el.value = v;
    this.recalcBolsista();
  },

  recalcBolsista() {
    const sem = this._semanasFront(val('bo-inicio'), val('bo-fim'));
    const ch = Number(val('bo-ch')) || 0;
    const s = document.getElementById('bo-semanas'); if (s) s.value = sem;
    const ct = document.getElementById('bo-chtotal'); if (ct) ct.value = ch * sem;
  },

  async saveBolsista(id) {
    const p = {
      alunoId: val('bo-aluno'), editalBolsaId: val('bo-edital'), chBolsa: val('bo-ch'),
      valorBolsa: val('bo-valor'), dataInicio: val('bo-inicio'), dataFim: val('bo-fim'),
      statusSigaa: val('bo-sigaa'), statusRelatorio: val('bo-rel'),
      observacoes: val('bo-obs'), status: val('bo-status')
    };
    if (!p.alunoId) { toast('Selecione o aluno.', 'error'); return; }
    setBusy(true);
    try {
      if (id) await API.updateBolsista(id, p);
      else { p.acaoId = this.currentId; await API.addBolsista(p, this._reqId()); }
      toast(id ? 'Bolsista atualizado.' : 'Bolsista adicionado.', 'success');
      closeModal();
      this.bolsistas = await API.getBolsistas(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeBolsista(id) {
    if (!window.confirm('Excluir este bolsista da ação?')) return;
    (async () => {
      try { await API.deleteBolsista(id); toast('Bolsista excluído.', 'success'); this.bolsistas = await API.getBolsistas(this.currentId) || []; this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  pickRelatorio(id) {
    let inp = document.getElementById('_bo-rel-file');
    if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf'; inp.id = '_bo-rel-file'; inp.style.display = 'none'; document.body.appendChild(inp); }
    inp.value = '';
    inp.onchange = () => this._doRelatorio(inp, id);
    inp.click();
  },

  async _doRelatorio(inp, id) {
    const file = inp.files && inp.files[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { toast('O relatório precisa ser um PDF.', 'error'); return; }
    toast('Enviando relatório…', 'info');
    try {
      const base64 = await fileToBase64(file);
      await API.uploadBolsistaRelatorio(id, { fileName: file.name, base64: base64 });
      toast('Relatório enviado.', 'success');
      this.bolsistas = await API.getBolsistas(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); }
  },

  // ── Voluntários ─────────────────────────────────────────────
  _voluntariosPanel() {
    const w = this.canWrite();
    const vs = this.voluntarios || [];
    const menu = (id) => w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
      <button onclick="Acoes.openVoluntario('${id}')">✏️ Editar</button>
      <button onclick="Acoes.pickRelatorioVol('${id}')">📄 Enviar relatório</button>
      <button class="danger" onclick="Acoes.removeVoluntario('${id}')">🗑 Excluir</button>
    </div></details></td>` : '';
    const rows = vs.map(v => `<tr>
      <td><strong>${esc(v.alunoNome || '—')}</strong></td>
      <td>${esc(v.CHVoluntariado || '—')}h</td>
      <td>${esc((this._br(v.DataInicio) || '?') + ' a ' + (this._br(v.DataFim) || '?'))}</td>
      <td class="cell-sub">${esc(String(v.TotalSemanas || 0))} sem · ${esc(String(v.CHTotal || 0))}h</td>
      <td>${esc(v.StatusSIGAA || '—')}</td>
      <td>${v.temRelatorio ? `<a href="${esc(v.relatorioUrl)}" target="_blank" rel="noopener">${esc(v.StatusRelatorio || 'ver')}</a>` : esc(v.StatusRelatorio || '—')}</td>
      <td>${this._vbadge(v.Status)}</td>${menu(v.ID)}
    </tr>`).join('');
    const table = vs.length ? `<div class="table-wrap menus"><table class="data-table">
      <thead><tr><th>Aluno</th><th>CH</th><th>Período</th><th>Semanas · CH total</th><th>SIGAA</th><th>Relatório</th><th>Status</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>` : emptyState('Nenhum voluntário cadastrado nesta ação.');
    return `<div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Acoes.openVoluntario()">+ Adicionar voluntário</button>` : ''}</div>${table}`;
  },

  openVoluntario(id) {
    if (!this.canWrite()) return;
    const v = id ? (this.voluntarios || []).find(x => String(x.ID) === String(id)) : null;
    openModal((id ? 'Editar ' : 'Novo ') + 'voluntário', this._voluntarioForm(v),
      async () => { await this.saveVoluntario(id); }, { confirmLabel: id ? 'Salvar' : 'Adicionar' });
    setTimeout(() => this.recalcVoluntario(), 50);
  },

  _voluntarioForm(v) {
    const alunoOpts = ['<option value="">— Selecione —</option>'].concat(this.alunos.map(a => `<option value="${esc(a.ID)}" ${v && String(v.AlunoID) === String(a.ID) ? 'selected' : ''}>${esc(a.Nome)}</option>`)).join('');
    const chOpts = ['<option value="">—</option>'].concat(CH_BOLSA.map(c => `<option ${v && String(v.CHVoluntariado) === String(c) ? 'selected' : ''}>${esc(c)}</option>`)).join('');
    const menuOpts = (list, sel) => ['<option value="">—</option>'].concat(list.map(o => `<option ${sel === o ? 'selected' : ''}>${esc(o)}</option>`)).join('');
    const statusOpts = STATUS_VINCULO.map(o => `<option ${(v ? v.Status : 'Ativo') === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `
      <div class="fg"><label>Aluno *</label><select class="input" id="vo-aluno">${alunoOpts}</select></div>
      <div class="form-grid">
        <div class="fg"><label>CH semanal</label><select class="input" id="vo-ch" onchange="Acoes.recalcVoluntario()">${chOpts}</select></div>
        <div class="fg"><label>Status</label><select class="input" id="vo-status">${statusOpts}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Data de início</label><input class="input" type="date" id="vo-inicio" value="${esc(v ? v.DataInicio : '')}" oninput="Acoes.recalcVoluntario()"></div>
        <div class="fg"><label>Data de término</label><input class="input" type="date" id="vo-fim" value="${esc(v ? v.DataFim : '')}" oninput="Acoes.recalcVoluntario()"></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Total de semanas</label><input class="input" id="vo-semanas" disabled value="${esc(v ? v.TotalSemanas : '')}"></div>
        <div class="fg"><label>CH total</label><input class="input" id="vo-chtotal" disabled value="${esc(v ? v.CHTotal : '')}"></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Status no SIGAA</label><select class="input" id="vo-sigaa">${menuOpts(STATUS_SIGAA, v ? v.StatusSIGAA : '')}</select></div>
        <div class="fg"><label>Relatório final</label><select class="input" id="vo-rel">${menuOpts(STATUS_RELATORIO, v ? v.StatusRelatorio : '')}</select></div>
      </div>
      <div class="fg"><label>Observações</label><textarea class="input" id="vo-obs" rows="2">${esc(v ? v.Observacoes : '')}</textarea></div>`;
  },

  recalcVoluntario() {
    const sem = this._semanasFront(val('vo-inicio'), val('vo-fim'));
    const ch = Number(val('vo-ch')) || 0;
    const s = document.getElementById('vo-semanas'); if (s) s.value = sem;
    const ct = document.getElementById('vo-chtotal'); if (ct) ct.value = ch * sem;
  },

  async saveVoluntario(id) {
    const p = {
      alunoId: val('vo-aluno'), chVoluntariado: val('vo-ch'),
      dataInicio: val('vo-inicio'), dataFim: val('vo-fim'),
      statusSigaa: val('vo-sigaa'), statusRelatorio: val('vo-rel'),
      observacoes: val('vo-obs'), status: val('vo-status')
    };
    if (!p.alunoId) { toast('Selecione o aluno.', 'error'); return; }
    setBusy(true);
    try {
      if (id) await API.updateVoluntario(id, p);
      else { p.acaoId = this.currentId; await API.addVoluntario(p, this._reqId()); }
      toast(id ? 'Voluntário atualizado.' : 'Voluntário adicionado.', 'success');
      closeModal();
      this.voluntarios = await API.getVoluntarios(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeVoluntario(id) {
    if (!window.confirm('Excluir este voluntário da ação?')) return;
    (async () => {
      try { await API.deleteVoluntario(id); toast('Voluntário excluído.', 'success'); this.voluntarios = await API.getVoluntarios(this.currentId) || []; this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  pickRelatorioVol(id) {
    let inp = document.getElementById('_vo-rel-file');
    if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf'; inp.id = '_vo-rel-file'; inp.style.display = 'none'; document.body.appendChild(inp); }
    inp.value = '';
    inp.onchange = () => this._doRelatorioVol(inp, id);
    inp.click();
  },

  async _doRelatorioVol(inp, id) {
    const file = inp.files && inp.files[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { toast('O relatório precisa ser um PDF.', 'error'); return; }
    toast('Enviando relatório…', 'info');
    try {
      const base64 = await fileToBase64(file);
      await API.uploadVoluntarioRelatorio(id, { fileName: file.name, base64: base64 });
      toast('Relatório enviado.', 'success');
      this.voluntarios = await API.getVoluntarios(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); }
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
