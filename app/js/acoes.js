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
  colaboradores: [],
  vagas: [],
  cursos: [],
  financeiro: null,
  certificados: [],
  certPessoas: [],
  detailTab: 'dados',
  finTab: 'plano',
  selTab: 'requisitos',

  async mount(container, role) {
    this.container = container;
    this.role = role;
    this.view = 'list';
    this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try {
      const [ac, ed, sv, al, cu] = await Promise.all([
        API.getAcoes(), API.getEditais(), API.getServidores(), API.getAlunos(), API.getCursos()
      ]);
      this.acoes = ac || []; this.editais = ed || []; this.servidores = sv || []; this.alunos = al || []; this.cursos = cu || [];
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
      const [rec, docs, bols, vols, fin, certs, colabs, vagas] = await Promise.all([API.getAcao(id), API.getAcaoDocs(id), API.getBolsistas(id), API.getVoluntarios(id), API.getAcaoFinanceiro(id), API.getCertificadosDaAcao(id), API.getColaboradores(id), API.getVagas(id)]);
      this.detail = rec; this.docs = docs || []; this.bolsistas = bols || []; this.voluntarios = vols || []; this.financeiro = fin || {}; this.certificados = certs || []; this.colaboradores = colabs || []; this.vagas = vagas || []; this.currentId = id; this.detailTab = 'dados'; this.selTab = 'requisitos'; this.view = 'detail';
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
    const tabs = [['dados', '📋 Dados'], ['colaboradores', '🤝 Colaboradores'], ['selecao', '🎯 Seleção de bolsistas'], ['bolsistas', '🎓 Bolsistas'], ['voluntarios', '🙌 Voluntários'], ['documentos', '📎 Documentos'], ['financeiro', '💰 Financeiro'], ['certificados', '📜 Certificados']];
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
      case 'financeiro': return this._financeiroPanel();
      case 'colaboradores': return this._colaboradoresPanel();
      case 'selecao': return this._selecaoPanel();
      case 'bolsistas':  return this._bolsistasPanel();
      case 'voluntarios': return this._voluntariosPanel();
      case 'certificados': return this._certificadosPanel();
      default: return this._dadosPanel();
    }
  },

  _dadosPanel() {
    const d = this.detail;
    const w = this.canWrite();
    const cell = (k, v) => `<div><span class="dk">${esc(k)}</span><span class="dv">${v}</span></div>`;
    const resumo = d.resumo ? `<div class="upload-box" style="margin-top:12px"><div class="seg-head">Resumo da ação</div>
      <p style="white-space:pre-wrap;margin:6px 0 0">${esc(d.resumo)}</p></div>` : '';
    const logoBox = d.logoUrl ? `<div class="upload-box" style="margin-top:12px"><div class="seg-head">Imagem / logo da ação</div>
      <img src="${esc(d.logoUrl)}" alt="Logo da ação" style="max-width:220px;max-height:160px;border-radius:8px;display:block;margin:6px 0"></div>` : '';
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
        ${cell('Coordenador adjunto', esc(this._pessoaNome('servidor', d.coorientadorId) || '—'))}
        ${cell('Código SIGAA', esc(d.codigoSIGAA || '—'))}
        ${cell('Período', esc((this._br(d.dataInicio) || '?') + ' a ' + (this._br(d.dataFim) || '?')))}
      </div>
      ${resumo}${logoBox}`;
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

  // ── Financeiro estruturado (Plano + Despesas + Documentos) ──
  _financeiroPanel() {
    const tabs = [['plano', 'Plano de aplicação (Anexo I)'], ['prestacao', 'Prestação de contas (Anexo III)'], ['bens', 'Bens doados (Anexo IV)']];
    const ft = this.finTab || 'plano';
    const ftabs = tabs.map(([id, label]) => `<button type="button" class="ftab ${ft === id ? 'active' : ''}" onclick="Acoes.switchFinTab('${id}')">${label}</button>`).join('');
    const panel = ft === 'prestacao' ? this._finPrestacaoPanel() : ft === 'bens' ? this._finBensPanel() : this._finPlanoPanel();
    return `<div class="ftabs">${ftabs}</div>${panel}`;
  },

  switchFinTab(t) { this.finTab = t; this.renderDetail(); },

  // Sub-aba: Plano de aplicação (Anexo I) + Alterações de despesa (Anexo II)
  _finPlanoPanel() {
    const w = this.canWrite();
    const f = this.financeiro || {};
    const dis = w ? '' : 'disabled';
    const totalPrev = parseMoney(f.custeioPrevisto) + parseMoney(f.capitalPrevisto);
    const plano = `<div class="upload-box">
      <div class="seg-head">Plano de aplicação (Anexo I)</div>
      <div class="form-grid">
        <div class="fg"><label>Unidade de execução</label><input class="input" id="fin-unidade" value="${esc(f.unidadeExecucao || '')}" ${dis}></div>
        <div class="fg"><label>Custeio previsto (R$)</label><input class="input" id="fin-custeio" value="${esc(f.custeioPrevisto)}" ${dis}></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Capital previsto (R$)</label><input class="input" id="fin-capital" value="${esc(f.capitalPrevisto)}" ${dis}></div>
        <div class="fg"><label>Total previsto</label><input class="input" disabled value="${fmtMoney(totalPrev)}"></div>
      </div>
      ${w ? `<button class="btn btn-primary" id="fin-plano-btn" onclick="Acoes.savePlano()">Salvar plano</button>` : ''}
    </div>`;

    const alts = f.alteracoes || [];
    const amenu = (id) => w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
      <button onclick="Acoes.openAlteracao('${id}')">✏️ Editar</button>
      <button class="danger" onclick="Acoes.removeAlteracao('${id}')">🗑 Excluir</button>
    </div></details></td>` : '';
    const arows = alts.map(a => `<tr>
      <td>${esc(this._br(a.Data) || '—')}</td>
      <td>${fmtMoney(a.CusteioOriginal)} → <strong>${fmtMoney(a.CusteioNovo)}</strong></td>
      <td>${fmtMoney(a.CapitalOriginal)} → <strong>${fmtMoney(a.CapitalNovo)}</strong></td>
      <td class="cell-sub">${esc(a.Justificativa || '—')}</td>
      <td><span class="badge ${a.StatusAutorizacao === 'Autorizada' ? 'badge-ok' : 'badge-muted'}">${esc(a.StatusAutorizacao || '—')}</span></td>
      ${amenu(a.ID)}
    </tr>`).join('');
    const aTable = alts.length ? `<div class="table-wrap menus"><table class="data-table">
      <thead><tr><th>Data</th><th>Custeio (orig → novo)</th><th>Capital (orig → novo)</th><th>Justificativa</th><th>Autorização</th>${w ? '<th class="col-actions"></th>' : ''}</tr></thead>
      <tbody>${arows}</tbody></table></div>` : emptyState('Nenhuma alteração de despesa registrada.');
    const altSection = `<div class="seg-head" style="margin-top:18px">Alterações de despesa (Anexo II)</div>
      <div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Acoes.openAlteracao()">+ Registrar alteração</button>` : ''}</div>
      ${aTable}`;
    return plano + altSection;
  },

  // Sub-aba: Prestação de contas — totais (Anexo III) + Despesas + Documentos
  _finPrestacaoPanel() {
    const w = this.canWrite();
    const f = this.financeiro || {};
    const desp = f.despesas || [];
    const dis = w ? '' : 'disabled';
    const limite = Number(f.limiteOrcamentos) || LIMITE_TRES_ORCAMENTOS;
    const utilizado = Number(f.valorUtilizado) || 0;
    const saldo = parseMoney(f.valorRecebido) - utilizado;
    const totais = `<div class="upload-box">
      <div class="seg-head">Prestação de contas — totais (Anexo III)</div>
      <div class="form-grid">
        <div class="fg"><label>Valor recebido (R$)</label><input class="input" id="fin-recebido" value="${esc(f.valorRecebido)}" ${dis}></div>
        <div class="fg"><label>Valor utilizado (auto)</label><input class="input" disabled value="${fmtMoney(utilizado)}"></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Valor devolvido (R$)</label><input class="input" id="fin-devolvido" value="${esc(f.valorDevolvido)}" ${dis}></div>
        <div class="fg"><label>Saldo (recebido − utilizado)</label><input class="input" disabled value="${fmtMoney(saldo)}"></div>
      </div>
      ${w ? `<button class="btn btn-primary" id="fin-prest-btn" onclick="Acoes.savePrestacao()">Salvar totais</button>` : ''}
    </div>`;

    const receb = parseMoney(f.valorRecebido);
    const devol = parseMoney(f.valorDevolvido);
    const avisoDev = (receb > 0 && devol / receb > 0.7)
      ? this._avisoBox('Devolução acima de 70% do recurso recebido (' + Math.round(devol / receb * 100) + '%): impede solicitar recursos no ano seguinte (Art. 14, §7º da IN).')
      : '';

    const menu = (id) => w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
      <button onclick="Acoes.openDespesa('${id}')">✏️ Editar</button>
      <button class="danger" onclick="Acoes.removeDespesa('${id}')">🗑 Excluir</button>
    </div></details></td>` : '';
    let temOrcamento = false;
    const rows = desp.map(d => {
      const over = parseMoney(d.ValorUnitario) > limite;
      if (over) temOrcamento = true;
      return `<tr>
      <td>${over ? '<span title="Item pode exigir 3 orçamentos (Art. 7º)">⚠ </span>' : ''}${esc(d.Descricao)}</td>
      <td>${esc(d.Tipo || '—')}</td>
      <td>${esc(d.Classificacao || '—')}</td>
      <td>${esc(this._br(d.DataCompra) || '—')}</td>
      <td class="cell-sub">${esc(d.Fornecedor || '—')}</td>
      <td>${esc(d.NumDocFiscal || '—')}</td>
      <td>${d.ValorUnitario !== '' && d.ValorUnitario != null ? fmtMoney(d.ValorUnitario) : '—'}</td>
      <td>${esc(String(d.Qtd || ''))}</td>
      <td><strong>${d.ValorTotal !== '' && d.ValorTotal != null ? fmtMoney(d.ValorTotal) : '—'}</strong></td>
      ${menu(d.ID)}
    </tr>`;
    }).join('');
    const despTable = desp.length ? `<div class="table-wrap menus"><table class="data-table">
      <thead><tr><th>Descrição</th><th>Tipo</th><th>Classif.</th><th>Data</th><th>Fornecedor</th><th>Doc fiscal</th><th>Unit.</th><th>Qtd</th><th>Total</th>${w ? '<th class="col-actions"></th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>` : emptyState('Nenhuma despesa lançada ainda.');
    const avisoOrc = temOrcamento ? this._avisoBox('Há itens com valor unitário acima de ' + fmtMoney(limite) + ' (marcados com ⚠) que podem exigir 3 orçamentos (Art. 7º da IN).') : '';
    const despSection = `<div class="seg-head" style="margin-top:18px">Despesas (Anexo III)</div>
      <div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Acoes.openDespesa()">+ Adicionar despesa</button>` : ''}</div>
      ${avisoOrc}${despTable}`;

    const docsSection = `<div class="seg-head" style="margin-top:18px">Documentos financeiros</div>${this._docsPanel('financeiro')}`;
    return totais + avisoDev + despSection + docsSection;
  },

  // Sub-aba: Bens doados (Anexo IV) — anexo (PDF/imagem) por linha
  _finBensPanel() {
    const w = this.canWrite();
    const f = this.financeiro || {};
    const bens = f.bens || [];
    const bmenu = (id) => w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
      <button onclick="Acoes.openBem('${id}')">✏️ Editar</button>
      <button onclick="Acoes.pickBemAnexo('${id}')">📎 Anexo (PDF/imagem)</button>
      <button class="danger" onclick="Acoes.removeBem('${id}')">🗑 Excluir</button>
    </div></details></td>` : '';
    const brows = bens.map(b => `<tr>
      <td>${esc(b.MaterialPermanente || '—')}</td>
      <td>${esc(String(b.Qtd || ''))}</td>
      <td>${esc(b.MarcaModelo || '—')}</td>
      <td>${esc(b.Situacao || '—')}</td>
      <td>${esc(b.NumDocFiscal || '—')}</td>
      <td>${esc(b.NumTombamento || '—')}</td>
      <td>${b.temAnexo ? `<a href="${esc(b.anexoUrl)}" target="_blank" rel="noopener">ver</a>` : '—'}</td>
      ${bmenu(b.ID)}
    </tr>`).join('');
    const bTable = bens.length ? `<div class="table-wrap menus"><table class="data-table">
      <thead><tr><th>Material permanente</th><th>Qtd</th><th>Marca/modelo</th><th>Situação</th><th>Doc fiscal</th><th>Tombamento</th><th>Anexo</th>${w ? '<th class="col-actions"></th>' : ''}</tr></thead>
      <tbody>${brows}</tbody></table></div>` : emptyState('Nenhum bem doado cadastrado.');
    const gerarBtn = (w && f.bensPendentes > 0) ? `<button class="btn btn-ghost" onclick="Acoes.gerarBens()">↧ Gerar ${f.bensPendentes} das despesas de capital</button>` : '';
    return `<div class="seg-head">Bens doados (Anexo IV)</div>
      <div class="page-actions" style="flex-wrap:wrap;gap:8px">${w ? `<button class="btn btn-primary" onclick="Acoes.openBem()">+ Adicionar bem</button>` : ''}${gerarBtn}</div>
      ${bTable}`;
  },

  pickBemAnexo(id) {
    let inp = document.getElementById('_bem-anexo-file');
    if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'; inp.id = '_bem-anexo-file'; inp.style.display = 'none'; document.body.appendChild(inp); }
    inp.value = '';
    inp.onchange = () => this._doBemAnexo(inp, id);
    inp.click();
  },

  async _doBemAnexo(inp, id) {
    const file = inp.files && inp.files[0];
    if (!file) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) { toast('Envie um PDF, JPG ou PNG.', 'error'); return; }
    toast('Enviando anexo…', 'info');
    try {
      const base64 = await fileToBase64(file);
      await API.uploadBemAnexo(id, { fileName: file.name, mimeType: file.type || '', base64: base64 });
      toast('Anexo enviado.', 'success');
      this.financeiro = await API.getAcaoFinanceiro(this.currentId);
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); }
  },

  _avisoBox(texto) {
    return `<div style="background:#fff7e6;border:1px solid #f0c36d;border-radius:8px;padding:8px 12px;margin:10px 0;font-size:13px;color:#7a5b12">⚠ ${esc(texto)}</div>`;
  },

  openAlteracao(id) {
    if (!this.canWrite()) return;
    const a = id ? ((this.financeiro && this.financeiro.alteracoes) || []).find(x => String(x.ID) === String(id)) : null;
    openModal((id ? 'Editar ' : 'Registrar ') + 'alteração de despesa', this._alteracaoForm(a),
      async () => { await this.saveAlteracao(id); }, { confirmLabel: id ? 'Salvar' : 'Registrar' });
  },

  _alteracaoForm(a) {
    const f = this.financeiro || {};
    const co = a ? a.CusteioOriginal : f.custeioPrevisto;
    const cap = a ? a.CapitalOriginal : f.capitalPrevisto;
    const statusOpts = STATUS_ALTERACAO.map(s => `<option ${(a ? a.StatusAutorizacao : 'Pendente') === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
    return `
      <div class="seg-head">Previsão original</div>
      <div class="form-grid">
        <div class="fg"><label>Custeio (R$)</label><input class="input" id="al-co" value="${esc(co)}"></div>
        <div class="fg"><label>Capital (R$)</label><input class="input" id="al-cao" value="${esc(cap)}"></div>
      </div>
      <div class="seg-head">Nova previsão</div>
      <div class="form-grid">
        <div class="fg"><label>Custeio (R$)</label><input class="input" id="al-cn" value="${esc(a ? a.CusteioNovo : '')}"></div>
        <div class="fg"><label>Capital (R$)</label><input class="input" id="al-can" value="${esc(a ? a.CapitalNovo : '')}"></div>
      </div>
      <div class="fg"><label>Justificativa *</label><textarea class="input" id="al-just" rows="2">${esc(a ? a.Justificativa : '')}</textarea></div>
      <div class="form-grid">
        <div class="fg"><label>Status da autorização</label><select class="input" id="al-status">${statusOpts}</select></div>
        <div class="fg"><label>Data</label><input class="input" type="date" id="al-data" value="${esc(a ? a.Data : '')}"></div>
      </div>
      <div class="fg"><label>Observação (motivo, se negada)</label><input class="input" id="al-obs" value="${esc(a ? a.Observacao : '')}"></div>`;
  },

  async saveAlteracao(id) {
    const p = {
      custeioOriginal: parseMoney(val('al-co')), capitalOriginal: parseMoney(val('al-cao')),
      custeioNovo: parseMoney(val('al-cn')), capitalNovo: parseMoney(val('al-can')),
      justificativa: val('al-just'), statusAutorizacao: val('al-status'),
      data: val('al-data'), observacao: val('al-obs')
    };
    if (!p.justificativa) { toast('Informe a justificativa.', 'error'); return; }
    setBusy(true);
    try {
      if (id) await API.updateAlteracao(id, p);
      else { p.acaoId = this.currentId; await API.addAlteracao(p, this._reqId()); }
      toast(id ? 'Alteração atualizada.' : 'Alteração registrada.', 'success');
      closeModal();
      this.financeiro = await API.getAcaoFinanceiro(this.currentId);
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeAlteracao(id) {
    if (!window.confirm('Excluir esta alteração de despesa?')) return;
    (async () => {
      try { await API.deleteAlteracao(id); toast('Alteração excluída.', 'success'); this.financeiro = await API.getAcaoFinanceiro(this.currentId); this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  openBem(id) {
    if (!this.canWrite()) return;
    const b = id ? ((this.financeiro && this.financeiro.bens) || []).find(x => String(x.ID) === String(id)) : null;
    openModal((id ? 'Editar ' : 'Novo ') + 'bem doado', this._bemForm(b),
      async () => { await this.saveBem(id); }, { confirmLabel: id ? 'Salvar' : 'Adicionar' });
  },

  _bemForm(b) {
    const sitOpts = ['<option value="">—</option>'].concat(SITUACAO_BEM.map(s => `<option ${b && b.Situacao === s ? 'selected' : ''}>${esc(s)}</option>`)).join('');
    return `
      <div class="fg"><label>Material permanente *</label><input class="input" id="bm-mat" value="${esc(b ? b.MaterialPermanente : '')}"></div>
      <div class="form-grid">
        <div class="fg"><label>Qtd</label><input class="input" id="bm-qtd" value="${esc(b ? b.Qtd : '')}"></div>
        <div class="fg"><label>Marca/modelo</label><input class="input" id="bm-marca" value="${esc(b ? b.MarcaModelo : '')}"></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Situação</label><select class="input" id="bm-sit">${sitOpts}</select></div>
        <div class="fg"><label>Nº documento fiscal</label><input class="input" id="bm-doc" value="${esc(b ? b.NumDocFiscal : '')}"></div>
      </div>
      <div class="fg"><label>Nº de tombamento</label><input class="input" id="bm-tomb" value="${esc(b ? b.NumTombamento : '')}"></div>
      <div class="fg"><label>Descrição (características)</label><textarea class="input" id="bm-desc" rows="2">${esc(b ? b.Descricao : '')}</textarea></div>`;
  },

  async saveBem(id) {
    const p = {
      materialPermanente: val('bm-mat'), qtd: Number(val('bm-qtd')) || 0, marcaModelo: val('bm-marca'),
      situacao: val('bm-sit'), numDocFiscal: val('bm-doc'), numTombamento: val('bm-tomb'), descricao: val('bm-desc')
    };
    if (!p.materialPermanente) { toast('Informe o material permanente.', 'error'); return; }
    setBusy(true);
    try {
      if (id) await API.updateBem(id, p);
      else { p.acaoId = this.currentId; await API.addBem(p, this._reqId()); }
      toast(id ? 'Bem atualizado.' : 'Bem adicionado.', 'success');
      closeModal();
      this.financeiro = await API.getAcaoFinanceiro(this.currentId);
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeBem(id) {
    if (!window.confirm('Excluir este bem doado?')) return;
    (async () => {
      try { await API.deleteBem(id); toast('Bem excluído.', 'success'); this.financeiro = await API.getAcaoFinanceiro(this.currentId); this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  async gerarBens() {
    try {
      const r = await API.gerarBensDaDespesa(this.currentId);
      toast('Gerados ' + (r.gerados || 0) + ' bem(ns) das despesas de capital.', 'success');
      this.financeiro = await API.getAcaoFinanceiro(this.currentId);
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); }
  },

  // Salva o cabeçalho financeiro mesclando os campos da sub-aba ativa com o resto (em cache),
  // já que Plano e Totais vivem em sub-abas diferentes (só uma está no DOM por vez).
  async _saveFin(campos, btnId, restaura) {
    const f = this.financeiro || {};
    const p = {
      unidadeExecucao: campos.unidadeExecucao !== undefined ? campos.unidadeExecucao : (f.unidadeExecucao || ''),
      custeioPrevisto: campos.custeioPrevisto !== undefined ? campos.custeioPrevisto : parseMoney(f.custeioPrevisto),
      capitalPrevisto: campos.capitalPrevisto !== undefined ? campos.capitalPrevisto : parseMoney(f.capitalPrevisto),
      valorRecebido: campos.valorRecebido !== undefined ? campos.valorRecebido : parseMoney(f.valorRecebido),
      valorDevolvido: campos.valorDevolvido !== undefined ? campos.valorDevolvido : parseMoney(f.valorDevolvido)
    };
    const btn = document.getElementById(btnId);
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
    try {
      await API.saveAcaoFinanceiro(this.currentId, p);
      toast('Salvo.', 'success');
      this.financeiro = await API.getAcaoFinanceiro(this.currentId);
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); if (btn) { btn.disabled = false; btn.textContent = restaura; } }
  },

  savePlano() {
    return this._saveFin({
      unidadeExecucao: val('fin-unidade'), custeioPrevisto: parseMoney(val('fin-custeio')), capitalPrevisto: parseMoney(val('fin-capital'))
    }, 'fin-plano-btn', 'Salvar plano');
  },

  savePrestacao() {
    return this._saveFin({
      valorRecebido: parseMoney(val('fin-recebido')), valorDevolvido: parseMoney(val('fin-devolvido'))
    }, 'fin-prest-btn', 'Salvar totais');
  },

  openDespesa(id) {
    if (!this.canWrite()) return;
    const d = id ? ((this.financeiro && this.financeiro.despesas) || []).find(x => String(x.ID) === String(id)) : null;
    openModal((id ? 'Editar ' : 'Nova ') + 'despesa', this._despesaForm(d),
      async () => { await this.saveDespesa(id); }, { confirmLabel: id ? 'Salvar' : 'Adicionar' });
    setTimeout(() => this.recalcDespesa(), 50);
  },

  _despesaForm(d) {
    const tipoOpts = ['<option value="">—</option>'].concat(TIPO_DESPESA.map(t => `<option ${d && d.Tipo === t ? 'selected' : ''}>${esc(t)}</option>`)).join('');
    const classifOpts = CLASSIF_DESPESA.map(c => `<option ${d && d.Classificacao === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
    return `
      <div class="fg"><label>Descrição *</label><input class="input" id="dp-desc" value="${esc(d ? d.Descricao : '')}"></div>
      <div class="form-grid">
        <div class="fg"><label>Tipo</label><select class="input" id="dp-tipo" onchange="Acoes.onDespesaTipo()">${tipoOpts}</select></div>
        <div class="fg"><label>Classificação</label><select class="input" id="dp-classif">${classifOpts}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Data da compra</label><input class="input" type="date" id="dp-data" value="${esc(d ? d.DataCompra : '')}"></div>
        <div class="fg"><label>Fornecedor</label><input class="input" id="dp-forn" value="${esc(d ? d.Fornecedor : '')}"></div>
      </div>
      <div class="fg"><label>Nº documento fiscal</label><input class="input" id="dp-doc" value="${esc(d ? d.NumDocFiscal : '')}"></div>
      <div class="form-grid">
        <div class="fg"><label>Valor unitário (R$)</label><input class="input" id="dp-unit" value="${esc(d ? d.ValorUnitario : '')}" oninput="Acoes.recalcDespesa()"></div>
        <div class="fg"><label>Qtd</label><input class="input" id="dp-qtd" value="${esc(d ? d.Qtd : '')}" oninput="Acoes.recalcDespesa()"></div>
      </div>
      <div class="fg"><label>Valor total</label><input class="input" id="dp-total" disabled value="${d && d.ValorTotal != null ? fmtMoney(d.ValorTotal) : ''}"></div>`;
  },

  onDespesaTipo() {
    const c = document.getElementById('dp-classif');
    if (c) c.value = val('dp-tipo') === 'Material permanente' ? 'Capital' : 'Custeio';
  },
  recalcDespesa() {
    const total = parseMoney(val('dp-unit')) * (Number(val('dp-qtd')) || 0);
    const el = document.getElementById('dp-total'); if (el) el.value = fmtMoney(total);
  },

  async saveDespesa(id) {
    const p = {
      descricao: val('dp-desc'), tipo: val('dp-tipo'), classificacao: val('dp-classif'),
      dataCompra: val('dp-data'), fornecedor: val('dp-forn'), numDocFiscal: val('dp-doc'),
      valorUnitario: parseMoney(val('dp-unit')), qtd: Number(val('dp-qtd')) || 0
    };
    if (!p.descricao) { toast('Informe a descrição.', 'error'); return; }
    setBusy(true);
    try {
      if (id) await API.updateDespesa(id, p);
      else { p.acaoId = this.currentId; await API.addDespesa(p, this._reqId()); }
      toast(id ? 'Despesa atualizada.' : 'Despesa adicionada.', 'success');
      closeModal();
      this.financeiro = await API.getAcaoFinanceiro(this.currentId);
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeDespesa(id) {
    if (!window.confirm('Excluir esta despesa?')) return;
    (async () => {
      try { await API.deleteDespesa(id); toast('Despesa excluída.', 'success'); this.financeiro = await API.getAcaoFinanceiro(this.currentId); this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  // ── Colaboradores ───────────────────────────────────────────
  _colaboradoresPanel() {
    const w = this.canWrite();
    const cs = this.colaboradores || [];
    const menu = (id) => w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
      <button onclick="Acoes.openColab('${id}')">✏️ Editar</button>
      <button class="danger" onclick="Acoes.removeColab('${id}')">🗑 Excluir</button>
    </div></details></td>` : '';
    const rows = cs.map(c => `<tr>
      <td><strong>${esc(c.nome || '—')}</strong> <span class="cell-sub">${c.PessoaTipo === 'aluno' ? '🎓 aluno' : '👤 servidor'}</span></td>
      <td>${esc(c.Funcao || '—')}</td>
      <td>${c.CHTotal !== '' && c.CHTotal != null ? esc(String(c.CHTotal)) + 'h' : '—'}</td>
      ${menu(c.ID)}
    </tr>`).join('');
    const table = cs.length ? `<div class="table-wrap menus"><table class="data-table">
      <thead><tr><th>Nome</th><th>Função</th><th>CH total</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>` : emptyState('Nenhum colaborador cadastrado.');
    return `<div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Acoes.openColab()">+ Adicionar colaborador</button>` : ''}</div>${table}`;
  },

  openColab(id) {
    if (!this.canWrite()) return;
    const c = id ? (this.colaboradores || []).find(x => String(x.ID) === String(id)) : null;
    const pessoaOpts = ['<option value="">— Selecione —</option>']
      .concat(this.servidores.map(s => `<option value="servidor|${esc(s.ID)}" ${c && c.PessoaTipo === 'servidor' && String(c.PessoaID) === String(s.ID) ? 'selected' : ''}>👤 ${esc(s.Nome)}</option>`))
      .concat(this.alunos.map(a => `<option value="aluno|${esc(a.ID)}" ${c && c.PessoaTipo === 'aluno' && String(c.PessoaID) === String(a.ID) ? 'selected' : ''}>🎓 ${esc(a.Nome)}</option>`)).join('');
    const funcaoOpts = ['<option value="">—</option>'].concat(FUNCAO_COLABORADOR.map(f => `<option ${c && c.Funcao === f ? 'selected' : ''}>${esc(f)}</option>`)).join('');
    const body = `
      <div class="fg"><label>Pessoa *</label><select class="input" id="co-pessoa">${pessoaOpts}</select></div>
      <div class="form-grid">
        <div class="fg"><label>Função</label><select class="input" id="co-funcao">${funcaoOpts}</select></div>
        <div class="fg"><label>CH total</label><input class="input" id="co-ch" value="${esc(c ? c.CHTotal : '')}"></div>
      </div>`;
    openModal((id ? 'Editar ' : 'Novo ') + 'colaborador', body, async () => { await this.saveColab(id); }, { confirmLabel: id ? 'Salvar' : 'Adicionar' });
  },

  async saveColab(id) {
    const pv = val('co-pessoa');
    if (!pv) { toast('Selecione a pessoa.', 'error'); return; }
    const parts = pv.split('|');
    const p = { pessoaTipo: parts[0], pessoaId: parts[1], funcao: val('co-funcao'), chTotal: val('co-ch') };
    setBusy(true);
    try {
      if (id) await API.updateColaborador(id, p);
      else { p.acaoId = this.currentId; await API.addColaborador(p, this._reqId()); }
      toast(id ? 'Colaborador atualizado.' : 'Colaborador adicionado.', 'success');
      closeModal();
      this.colaboradores = await API.getColaboradores(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeColab(id) {
    if (!window.confirm('Excluir este colaborador?')) return;
    (async () => {
      try { await API.deleteColaborador(id); toast('Colaborador excluído.', 'success'); this.colaboradores = await API.getColaboradores(this.currentId) || []; this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  // ── Seleção de bolsistas (VAGAS) ────────────────────────────
  _selecaoPanel() {
    const tabs = [['requisitos', 'Requisitos e critérios'], ['selecao', 'Seleção']];
    const st = this.selTab || 'requisitos';
    const ftabs = tabs.map(([id, label]) => `<button type="button" class="ftab ${st === id ? 'active' : ''}" onclick="Acoes.switchSelTab('${id}')">${label}</button>`).join('');
    const panel = st === 'selecao' ? this._selCandPanel() : this._selReqPanel();
    return `<div class="ftabs">${ftabs}</div>${panel}`;
  },

  switchSelTab(t) { this.selTab = t; this.renderDetail(); },

  _cursoNome(id) { const c = (this.cursos || []).find(x => String(x.ID) === String(id)); return c ? c.Nome : id; },

  // Resumo legível dos requisitos de uma vaga.
  _reqResumo(r) {
    r = r || {};
    const parts = [];
    if (r.modalidade && r.modalidade.length) parts.push('Modalidade: ' + r.modalidade.join(', '));
    if (r.cursos === 'todos') parts.push('Cursos: todos');
    else if (Array.isArray(r.cursos) && r.cursos.length) parts.push('Cursos: ' + r.cursos.map(id => this._cursoNome(id)).join(', '));
    if (r.periodoMin) parts.push('Período/semestre mín.: ' + r.periodoMin);
    if (r.assistencia) parts.push('Beneficiário de assistência estudantil');
    (r.demais || []).forEach(d => {
      if (d.requisito || d.comprovacao) parts.push((d.requisito || '—') + (d.comprovacao ? ' (comprovação: ' + d.comprovacao + ')' : ''));
    });
    return parts;
  },

  // Resumo textual das faixas de uma vaga (ex.: "4h R$ 175,00 (2), 8h R$ 350,00 (1)").
  _faixasResumo(v) {
    const fx = (v.faixas && v.faixas.length) ? v.faixas
      : ((v.CH !== '' && v.CH != null) ? [{ ch: v.CH, quantidade: v.Quantidade }] : []);
    if (!fx.length) return '—';
    return fx.map(f => {
      let s = f.ch + 'h';
      if (v.Tipo === 'Bolsista') {
        const val = this._valorBolsaDoEdital(this.detail ? this.detail.editalId : '', f.ch);
        if (val !== '' && val != null) s += ' ' + fmtMoney(val);
      }
      return s + ' (' + (Number(f.quantidade) || 0) + ')';
    }).join(', ');
  },

  // Sub-aba: Requisitos e critérios = criação/edição das VAGAS.
  _selReqPanel() {
    const w = this.canWrite();
    const vs = this.vagas || [];
    const cards = vs.map(v => {
      const req = this._reqResumo(v.requisitos);
      const crit = (v.criterios || []);
      const critRows = crit.length ? `<table class="data-table"><thead><tr><th>Categoria</th><th>Critério</th><th>Forma de avaliação</th><th>Peso</th></tr></thead>
        <tbody>${crit.map(c => `<tr><td>${esc(c.categoria)}</td><td>${esc(c.criterio || '—')}</td><td>${esc(c.forma || '—')}</td><td>${esc(String(c.peso ?? ''))}</td></tr>`).join('')}</tbody></table>`
        : '<p class="field-hint">Nenhum critério classificatório definido.</p>';
      const reqHtml = req.length ? '<ul style="margin:4px 0 0 18px">' + req.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'
        : '<p class="field-hint">Sem requisitos eliminatórios definidos.</p>';
      const faixasTxt = this._faixasResumo(v);
      const totalVagas = (v.faixas || []).reduce((s, f) => s + (Number(f.quantidade) || 0), 0) || Number(v.Quantidade) || 0;
      return `<div class="upload-box" style="margin-bottom:12px">
        <div class="seg-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>${v.Tipo === 'Bolsista' ? '🎓' : '🙌'} ${esc(v.Titulo)}
            <span class="badge ${v.Status === 'Aberta' ? 'badge-ok' : 'badge-muted'}">${esc(v.Status)}</span></span>
          ${w ? `<details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
            <button onclick="Acoes.viewVaga('${v.ID}')">👁 Ver</button>
            <button onclick="Acoes.openVaga('${v.ID}')">✏️ Editar</button>
            <button onclick="Acoes.cloneVaga('${v.ID}')">📄 Clonar</button>
            <button class="danger" onclick="Acoes.removeVaga('${v.ID}')">🗑 Excluir</button>
          </div></details>` : ''}
        </div>
        <p class="section-sub" style="margin:4px 0">${esc(v.Tipo)} · ${esc(faixasTxt)} · ${esc(String(totalVagas))} vaga(s)</p>
        <details><summary style="cursor:pointer">Requisitos eliminatórios</summary>${reqHtml}</details>
        <details style="margin-top:6px"><summary style="cursor:pointer">Critérios classificatórios (com peso)</summary><div class="table-wrap">${critRows}</div></details>
      </div>`;
    }).join('');
    const list = vs.length ? cards : emptyState('Nenhuma vaga criada. Cada vaga tem seus próprios requisitos e critérios.');
    return `<p class="field-hint" style="margin:2px 0 10px">Crie as vagas do processo seletivo. Cada vaga carrega seus <strong>requisitos</strong> (eliminatórios, sem pontuação) e seus <strong>critérios</strong> (classificatórios, com peso).</p>
      <div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Acoes.openVaga()">+ Adicionar vaga</button>` : ''}</div>${list}`;
  },

  // Sub-aba: Seleção = avaliação dos candidatos (etapa posterior).
  _selCandPanel() {
    const vs = this.vagas || [];
    const resumo = vs.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Vaga</th><th>Tipo</th><th>Vagas</th><th>Candidatos</th></tr></thead>
      <tbody>${vs.map(v => `<tr><td><strong>${esc(v.Titulo)}</strong></td><td>${esc(v.Tipo)}</td><td>${esc(String((v.faixas || []).reduce((s, f) => s + (Number(f.quantidade) || 0), 0) || v.Quantidade || 0))}</td><td class="cell-sub">— aguardando importação —</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('Crie ao menos uma vaga na aba "Requisitos e critérios".');
    return `<div class="upload-box"><div class="seg-head">Seleção de candidatos</div>
      <p class="field-hint">A lista de candidatos será <strong>importada automaticamente</strong> de outra planilha. Aqui será feita a avaliação por critério (soma ponderada), com o sistema <strong>indicando</strong> os classificados — a decisão final permanece com o coordenador. Etapa em construção.</p></div>
      ${resumo}`;
  },

  switchVagaTab(t) {
    ['req', 'crit', 'hab'].forEach(k => {
      const pane = document.getElementById('vg-pane-' + k);
      if (pane) pane.style.display = (k === t) ? '' : 'none';
      const b = document.getElementById('vg-tabbtn-' + k);
      if (b) b.classList.toggle('active', k === t);
    });
  },

  // Ao trocar o tipo, reconstrói as faixas preservando as quantidades.
  _vagaTipoChange(tipo) {
    const atuais = this._harvestFaixas();
    const valorHead = document.getElementById('vg-fx-valorhead');
    if (valorHead) valorHead.textContent = tipo === 'Bolsista' ? 'Valor da bolsa' : 'Horas';
    this._renderFaixas(tipo, atuais.length ? atuais : [{}]);
  },

  _harvestFaixas() {
    return Array.from(document.querySelectorAll('#vg-faixas .fx-row')).map(tr => ({
      ch: tr.querySelector('.fx-ch').value,
      quantidade: tr.querySelector('.fx-qtd').value
    }));
  },

  _faixaRowHtml(tipo, f) {
    f = f || {};
    let chCell;
    if (tipo === 'Bolsista') {
      const opts = CH_BOLSA.map(h => `<option value="${h}" ${String(f.ch) === h ? 'selected' : ''}>${h}h/sem</option>`).join('');
      chCell = `<select class="input fx-ch" onchange="Acoes._fxValor(this)">${opts}</select>`;
    } else {
      chCell = `<input class="input fx-ch" type="number" min="1" value="${esc(f.ch != null ? String(f.ch) : '')}" placeholder="horas">`;
    }
    const valTxt = tipo === 'Bolsista'
      ? (() => { const val = this._valorBolsaDoEdital(this.detail ? this.detail.editalId : '', f.ch != null ? f.ch : CH_BOLSA[0]); return (val !== '' && val != null) ? fmtMoney(val) : '—'; })()
      : '—';
    return `<tr class="fx-row">
      <td style="width:120px">${chCell}</td>
      <td class="fx-valor" style="white-space:nowrap">${valTxt}</td>
      <td style="width:80px"><input class="input fx-qtd" type="number" min="1" value="${esc(f.quantidade != null && f.quantidade !== '' ? String(f.quantidade) : '1')}"></td>
      <td style="width:36px"><button type="button" class="btn btn-ghost btn-xs danger" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`;
  },

  _renderFaixas(tipo, faixas) {
    const tb = document.getElementById('vg-faixas');
    if (tb) tb.innerHTML = (faixas && faixas.length ? faixas : [{}]).map(f => this._faixaRowHtml(tipo, f)).join('');
  },

  addFaixaRow() {
    const tb = document.getElementById('vg-faixas');
    if (tb) tb.insertAdjacentHTML('beforeend', this._faixaRowHtml(val('vg-tipo'), {}));
  },

  // Atualiza a célula de valor da faixa (bolsista) conforme a CH escolhida.
  _fxValor(sel) {
    const cell = sel.closest('tr').querySelector('.fx-valor');
    if (!cell) return;
    const v = this._valorBolsaDoEdital(this.detail ? this.detail.editalId : '', sel.value);
    cell.textContent = (v !== '' && v != null) ? fmtMoney(v) : '—';
  },

  _vagaCursosToggle(todos) {
    const box = document.getElementById('vg-cursos-list');
    if (box) { box.style.opacity = todos ? '0.4' : '1'; box.querySelectorAll('input').forEach(i => { i.disabled = todos; }); }
  },

  _critRowHtml(c) {
    c = c || {};
    const opts = CATEGORIA_CRITERIO.map(o => `<option ${c.categoria === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<tr class="crit-row">
      <td><select class="input crit-cat">${opts}</select></td>
      <td><input class="input crit-desc" value="${esc(c.criterio || '')}" placeholder="descrição"></td>
      <td><input class="input crit-forma" value="${esc(c.forma || '')}" placeholder="ex.: entrevista, análise"></td>
      <td style="width:80px"><input class="input crit-peso" type="number" min="0" step="0.5" value="${esc(c.peso != null ? String(c.peso) : '')}" oninput="Acoes._updateCritSum()"></td>
      <td style="width:36px"><button type="button" class="btn btn-ghost btn-xs danger" onclick="this.closest('tr').remove();Acoes._updateCritSum()">✕</button></td>
    </tr>`;
  },

  addCritRow() {
    const tb = document.getElementById('vg-crits');
    if (tb) { tb.insertAdjacentHTML('beforeend', this._critRowHtml()); this._updateCritSum(); }
  },

  _updateCritSum() {
    const el = document.getElementById('vg-crit-sum');
    if (!el) return;
    let s = 0;
    document.querySelectorAll('#vg-crits .crit-peso').forEach(i => { s += parseFloat(i.value) || 0; });
    s = Math.round(s * 100) / 100;
    const over = s > 10.0001;
    el.textContent = s.toString().replace('.', ',') + ' / 10,0';
    el.style.color = over ? 'var(--danger, #c0392b)' : '';
    const warn = document.getElementById('vg-crit-warn');
    if (warn) warn.style.display = over ? '' : 'none';
  },

  _demaisRowHtml(d) {
    d = d || {};
    return `<tr class="dem-row">
      <td><input class="input dem-req" value="${esc(d.requisito || '')}" placeholder="Requisito"></td>
      <td><input class="input dem-comp" value="${esc(d.comprovacao || '')}" placeholder="Forma de comprovação"></td>
      <td style="width:36px"><button type="button" class="btn btn-ghost btn-xs danger" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`;
  },

  addDemaisRow() {
    const tb = document.getElementById('vg-demais');
    if (tb) tb.insertAdjacentHTML('beforeend', this._demaisRowHtml());
  },

  openVaga(id, prefill) {
    if (!this.canWrite()) return;
    const v = id ? (this.vagas || []).find(x => String(x.ID) === String(id)) : (prefill || null);
    const req = (v && v.requisitos) || {};
    const tipo = v ? v.Tipo : 'Bolsista';
    const tipoOpts = TIPO_VAGA.map(t => `<option ${tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('');
    const statusOpts = STATUS_VAGA.map(s => `<option ${v && v.Status === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
    const modalChk = MODALIDADE_VAGA.map(m => `<label class="chk-item"><input type="checkbox" class="vg-modal" value="${esc(m)}" ${req.modalidade && req.modalidade.indexOf(m) !== -1 ? 'checked' : ''}> ${esc(m)}</label>`).join('');
    const todos = req.cursos === 'todos';
    const cursosChk = (this.cursos || []).filter(c => c.Status !== 'Inativo').map(c =>
      `<label class="chk-item"><input type="checkbox" class="vg-curso" value="${esc(c.ID)}" ${!todos && Array.isArray(req.cursos) && req.cursos.map(String).indexOf(String(c.ID)) !== -1 ? 'checked' : ''} ${todos ? 'disabled' : ''}> ${esc(c.Nome)}</label>`).join('') || '<span class="field-hint">Nenhum curso cadastrado.</span>';
    const crits = (v && v.criterios && v.criterios.length ? v.criterios : [{}]).map(c => this._critRowHtml(c)).join('');
    const demais = (req.demais && req.demais.length ? req.demais : [{}]).map(d => this._demaisRowHtml(d)).join('');
    const periodoOpts = ['<option value="">— sem exigência —</option>']
      .concat(PERIODO_MINIMO.map(pp => `<option ${req.periodoMin === pp ? 'selected' : ''}>${esc(pp)}</option>`)).join('');
    const faixasIni = (v && v.faixas && v.faixas.length) ? v.faixas : [{}];
    const hab = (v && v.habilidades) || {};

    const body = `
      <div class="ftabs" style="margin-bottom:12px">
        <button type="button" class="ftab active" id="vg-tabbtn-req" onclick="Acoes.switchVagaTab('req')">Requisitos</button>
        <button type="button" class="ftab" id="vg-tabbtn-crit" onclick="Acoes.switchVagaTab('crit')">Critérios</button>
        <button type="button" class="ftab" id="vg-tabbtn-hab" onclick="Acoes.switchVagaTab('hab')">Habilidades</button>
      </div>

      <div id="vg-pane-req">
        <div class="form-grid">
          <div class="fg"><label>Tipo *</label><select class="input" id="vg-tipo" onchange="Acoes._vagaTipoChange(this.value)">${tipoOpts}</select></div>
          <div class="fg"><label>Status</label><select class="input" id="vg-status">${statusOpts}</select></div>
        </div>
        <div class="fg"><label>Título da vaga *</label><input class="input" id="vg-titulo" value="${esc(v ? v.Titulo : '')}" placeholder="ex.: Bolsista de desenvolvimento web"></div>

        <div class="fg"><label>Faixas de CH / vagas <span class="field-hint">(ex.: uma de 4h e outra de 8h)</span></label>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>CH</th><th id="vg-fx-valorhead">${tipo === 'Bolsista' ? 'Valor da bolsa' : 'Horas'}</th><th>Vagas</th><th></th></tr></thead>
            <tbody id="vg-faixas">${faixasIni.map(f => this._faixaRowHtml(tipo, f)).join('')}</tbody></table></div>
          <div class="page-actions"><button type="button" class="btn btn-ghost btn-xs" onclick="Acoes.addFaixaRow()">+ Adicionar faixa</button></div>
        </div>

        <div class="seg-head" style="margin-top:12px">Requisitos de participação <span class="field-hint">(eliminatórios — não pontuam)</span></div>
        <div class="fg"><label>Modalidade / nível de ensino</label><div class="chk-list">${modalChk}</div></div>
        <div class="fg"><label><input type="checkbox" id="vg-cursos-todos" onchange="Acoes._vagaCursosToggle(this.checked)" ${todos ? 'checked' : ''}> Todos os cursos</label>
          <div class="chk-list" id="vg-cursos-list" style="${todos ? 'opacity:0.4' : ''}">${cursosChk}</div></div>
        <div class="form-grid">
          <div class="fg"><label>Período / semestre mínimo</label><select class="input" id="vg-periodo">${periodoOpts}</select></div>
          <div class="fg" style="display:flex;align-items:flex-end"><label class="chk-item"><input type="checkbox" id="vg-assist" ${req.assistencia ? 'checked' : ''}> Beneficiário(a) de assistência estudantil</label></div>
        </div>

        <div class="seg-head" style="margin-top:12px">Demais requisitos</div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Requisito</th><th>Forma de comprovação</th><th></th></tr></thead>
          <tbody id="vg-demais">${demais}</tbody></table></div>
        <div class="page-actions"><button type="button" class="btn btn-ghost btn-xs" onclick="Acoes.addDemaisRow()">+ Adicionar requisito</button></div>
      </div>

      <div id="vg-pane-crit" style="display:none">
        <div class="seg-head">Critérios de seleção e classificação <span class="field-hint">(classificatórios — com peso)</span></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Categoria</th><th>Critério</th><th>Forma de avaliação</th><th>Peso</th><th></th></tr></thead>
          <tbody id="vg-crits">${crits}</tbody>
          <tfoot><tr><td colspan="3" style="text-align:right"><strong>Somatório dos pesos</strong></td><td colspan="2"><strong id="vg-crit-sum">0 / 10,0</strong></td></tr></tfoot></table></div>
        <p class="field-hint" id="vg-crit-warn" style="display:none;color:var(--danger,#c0392b)">O somatório dos pesos não pode passar de 10,0.</p>
        <div class="page-actions"><button type="button" class="btn btn-ghost btn-xs" onclick="Acoes.addCritRow()">+ Adicionar critério</button></div>
      </div>

      <div id="vg-pane-hab" style="display:none">
        <div class="seg-head">Habilidades desejadas <span class="field-hint">(informativo — aparece para o aluno)</span></div>
        <div class="fg"><label>Soft skills desejadas</label><textarea class="input" id="vg-soft" rows="3" placeholder="ex.: comunicação, trabalho em equipe, proatividade">${esc(hab.soft || '')}</textarea></div>
        <div class="fg"><label>Hard skills desejadas</label><textarea class="input" id="vg-hard" rows="3" placeholder="ex.: HTML/CSS/JS, Python, edição de vídeo">${esc(hab.hard || '')}</textarea></div>
      </div>`;

    openModal((id ? 'Editar ' : 'Nova ') + 'vaga', body, async () => { await this.saveVaga(id); }, { confirmLabel: id ? 'Salvar' : 'Adicionar' });
    setTimeout(() => this._updateCritSum(), 60);
  },

  viewVaga(id) {
    const v = (this.vagas || []).find(x => String(x.ID) === String(id));
    if (!v) return;
    const req = this._reqResumo(v.requisitos);
    const reqHtml = req.length ? '<ul style="margin:4px 0 0 18px">' + req.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'
      : '<p class="field-hint">Sem requisitos eliminatórios.</p>';
    const crit = v.criterios || [];
    const soma = crit.reduce((s, c) => s + (Number(c.peso) || 0), 0);
    const critHtml = crit.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Categoria</th><th>Critério</th><th>Forma</th><th>Peso</th></tr></thead>
      <tbody>${crit.map(c => `<tr><td>${esc(c.categoria)}</td><td>${esc(c.criterio || '—')}</td><td>${esc(c.forma || '—')}</td><td>${esc(String(c.peso))}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3" style="text-align:right"><strong>Somatório</strong></td><td><strong>${esc((Math.round(soma * 100) / 100).toString().replace('.', ','))} / 10,0</strong></td></tr></tfoot></table></div>`
      : '<p class="field-hint">Sem critérios classificatórios.</p>';
    const body = `
      <p class="section-sub"><strong>${esc(v.Tipo)}</strong> · ${esc(this._faixasResumo(v))} · <span class="badge ${v.Status === 'Aberta' ? 'badge-ok' : 'badge-muted'}">${esc(v.Status)}</span></p>
      <div class="seg-head">Requisitos de participação</div>${reqHtml}
      <div class="seg-head" style="margin-top:10px">Critérios de seleção e classificação</div>${critHtml}`;
    openModal(v.Titulo, body, null, { hideConfirm: true, cancelLabel: 'Fechar' });
  },

  cloneVaga(id) {
    const v = (this.vagas || []).find(x => String(x.ID) === String(id));
    if (!v) return;
    const copy = JSON.parse(JSON.stringify(v));
    copy.Titulo = (v.Titulo || 'Vaga') + ' (cópia)';
    copy.Status = 'Aberta';
    this.openVaga(null, copy);
  },

  _harvestVaga() {
    const tipo = val('vg-tipo');
    const modalidade = Array.from(document.querySelectorAll('.vg-modal:checked')).map(i => i.value);
    const todos = document.getElementById('vg-cursos-todos') && document.getElementById('vg-cursos-todos').checked;
    const cursos = todos ? 'todos' : Array.from(document.querySelectorAll('.vg-curso:checked')).map(i => i.value);
    const criterios = Array.from(document.querySelectorAll('#vg-crits .crit-row')).map(tr => ({
      categoria: tr.querySelector('.crit-cat').value,
      criterio: tr.querySelector('.crit-desc').value.trim(),
      forma: tr.querySelector('.crit-forma').value.trim(),
      peso: parseFloat(tr.querySelector('.crit-peso').value) || 0
    })).filter(c => c.criterio || c.forma || c.peso);
    const demais = Array.from(document.querySelectorAll('#vg-demais .dem-row')).map(tr => ({
      requisito: tr.querySelector('.dem-req').value.trim(),
      comprovacao: tr.querySelector('.dem-comp').value.trim()
    })).filter(d => d.requisito || d.comprovacao);
    const faixas = this._harvestFaixas().map(f => ({ ch: f.ch, quantidade: f.quantidade }))
      .filter(f => String(f.ch).trim() !== '' && Number(f.quantidade) >= 1);
    return {
      tipo: tipo,
      titulo: val('vg-titulo'),
      faixas: faixas,
      status: val('vg-status'),
      requisitos: {
        modalidade: modalidade, cursos: cursos,
        periodoMin: val('vg-periodo'),
        assistencia: document.getElementById('vg-assist') && document.getElementById('vg-assist').checked,
        demais: demais
      },
      criterios: criterios,
      habilidades: { soft: val('vg-soft'), hard: val('vg-hard') }
    };
  },

  async saveVaga(id) {
    const p = this._harvestVaga();
    if (!p.titulo.trim()) { toast('Informe o título da vaga.', 'error'); return; }
    if (!p.faixas.length) { toast('Adicione ao menos uma faixa de CH/vagas.', 'error'); return; }
    const soma = p.criterios.reduce((s, c) => s + (Number(c.peso) || 0), 0);
    if (soma > 10.0001) { toast('O somatório dos pesos dos critérios não pode passar de 10,0.', 'error'); this.switchVagaTab('crit'); return; }
    setBusy(true);
    try {
      if (id) await API.updateVaga(id, p);
      else { p.acaoId = this.currentId; await API.addVaga(p, this._reqId()); }
      toast(id ? 'Vaga atualizada.' : 'Vaga adicionada.', 'success');
      closeModal();
      this.vagas = await API.getVagas(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeVaga(id) {
    if (!window.confirm('Excluir esta vaga?')) return;
    (async () => {
      try { await API.deleteVaga(id); toast('Vaga excluída.', 'success'); this.vagas = await API.getVagas(this.currentId) || []; this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  // ── Certificados da ação ────────────────────────────────────
  _certificadosPanel() {
    const w = this.canWrite();
    const cs = this.certificados || [];
    const rows = cs.map(c => `<tr>
      <td class="cell-sub">${esc(c.NomeDocumento || '')}</td>
      <td><strong>${esc(c.NomeSocial || c.NomeCivil || '—')}</strong></td>
      <td>${esc(c.Categoria || '')}${c.Papel ? ' · ' + esc(c.Papel) : ''}</td>
      <td><a href="${esc(c.ArquivoUrl)}" target="_blank" rel="noopener">abrir</a></td>
      ${w ? `<td class="col-actions"><button class="btn btn-danger btn-xs" onclick="Acoes.removeCert('${c.ID}')">🗑</button></td>` : ''}
    </tr>`).join('');
    const table = cs.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Documento</th><th>Nome</th><th>Categoria</th><th>Arquivo</th>${w ? '<th class="col-actions"></th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>` : emptyState('Nenhum certificado desta ação.');
    return `<div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Acoes.openCertForm()">+ Registrar certificado</button>` : ''}</div>${table}`;
  },

  async openCertForm() {
    if (!this.canWrite()) return;
    if (!this.detail.editalId) { toast('Esta ação não tem edital vinculado; vincule um edital antes de emitir certificado.', 'error'); return; }
    try { this.certPessoas = await API.getPessoasDaAcao(this.currentId) || []; } catch (e) { this.certPessoas = []; }
    const d = this.detail;
    const pessoaOpts = ['<option value="">— Selecione —</option>'].concat(this.certPessoas.map((p, i) =>
      `<option value="${i}">${esc(p.nomeSocial || p.nomeCivil)}${p.nomeSocial && p.nomeSocial !== p.nomeCivil ? ' (' + esc(p.nomeCivil) + ')' : ''} — ${esc(p.papel)}</option>`)).join('');
    const body = `
      <p class="section-sub">Vinculado a: <strong>${esc(this._editalNome(d.editalId))}</strong> · <strong>${esc(d.titulo)}</strong></p>
      <div class="fg"><label>Categoria</label><select class="input" id="ct-cat" onchange="Acoes.onCertCat()">
        <option value="Equipe">Equipe da ação</option>
        <option value="Público">Público-alvo</option></select></div>
      <div id="ct-eq">
        <div class="fg"><label>Nome (equipe) *</label><select class="input" id="ct-pessoa" onchange="Acoes.onCertPessoa()">${pessoaOpts}</select></div>
        <div class="form-grid">
          <div class="fg"><label>CPF</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input class="input" id="ct-cpf" disabled style="flex:1">
              <button type="button" class="btn btn-ghost btn-xs" id="ct-cpf-ver" data-on="0" onclick="Acoes.revealCtCpf()">👁 Ver</button>
            </div></div>
          <div class="fg"><label>Papel</label><input class="input" id="ct-papel" disabled></div>
        </div>
      </div>
      <div id="ct-pub" style="display:none">
        <div class="fg"><label>Nome completo *</label><input class="input" id="ct-nome"></div>
        <div class="fg"><label>CPF *</label><input class="input" id="ct-cpfpub" inputmode="numeric" placeholder="000.000.000-00" oninput="this.value=maskCPF(this.value)"></div>
      </div>
      <div class="fg"><label>Arquivo PDF *</label><input type="file" accept="application/pdf,.pdf" class="input" id="ct-file"></div>`;
    openModal('Registrar certificado', body, async () => { await this.saveCert(); }, { confirmLabel: 'Registrar' });
  },

  onCertCat() {
    const cat = val('ct-cat');
    const eq = document.getElementById('ct-eq'); const pu = document.getElementById('ct-pub');
    if (eq) eq.style.display = cat === 'Equipe' ? 'block' : 'none';
    if (pu) pu.style.display = cat === 'Público' ? 'block' : 'none';
  },
  _maskCpf(cpf) { const d = String(cpf || '').replace(/\D/g, ''); return d ? ('•••.•••.•••-' + (d.length >= 2 ? d.slice(-2) : d)) : ''; },
  onCertPessoa() {
    const i = val('ct-pessoa');
    const p = (i !== '' && this.certPessoas[Number(i)]) ? this.certPessoas[Number(i)] : null;
    this._ctCpfSel = p ? String(p.cpf || '') : '';
    const cpf = document.getElementById('ct-cpf'); const pap = document.getElementById('ct-papel');
    const btn = document.getElementById('ct-cpf-ver');
    if (cpf) cpf.value = p ? this._maskCpf(this._ctCpfSel) : '';
    if (pap) pap.value = p ? p.papel : '';
    if (btn) { btn.dataset.on = '0'; btn.textContent = '👁 Ver'; }
  },
  revealCtCpf() {
    const cpf = document.getElementById('ct-cpf'); const btn = document.getElementById('ct-cpf-ver');
    if (!cpf || !btn) return;
    if (btn.dataset.on === '1') { cpf.value = this._maskCpf(this._ctCpfSel); btn.dataset.on = '0'; btn.textContent = '👁 Ver'; }
    else { cpf.value = maskCPF(this._ctCpfSel); btn.dataset.on = '1'; btn.textContent = '🙈 Ocultar'; }
  },

  async saveCert() {
    const cat = val('ct-cat');
    const fileEl = document.getElementById('ct-file');
    const file = fileEl && fileEl.files[0];
    if (!file) { toast('Selecione o arquivo PDF.', 'error'); return; }
    if (!/\.pdf$/i.test(file.name)) { toast('O arquivo precisa ser PDF.', 'error'); return; }
    const p = { categoria: cat, editalId: this.detail.editalId, acaoId: this.currentId };
    if (cat === 'Equipe') {
      const i = val('ct-pessoa');
      if (i === '' || !this.certPessoas[Number(i)]) { toast('Selecione a pessoa.', 'error'); return; }
      const pe = this.certPessoas[Number(i)];
      p.nomeCivil = pe.nomeCivil; p.nomeSocial = pe.nomeSocial; p.cpf = pe.cpf;
      p.papel = pe.papel; p.pessoaTipo = pe.tipo; p.pessoaId = pe.id;
    } else {
      p.nomeCivil = val('ct-nome'); p.cpf = val('ct-cpfpub');
      if (!p.nomeCivil) { toast('Informe o nome completo.', 'error'); return; }
      if (!p.cpf) { toast('Informe o CPF.', 'error'); return; }
    }
    setBusy(true);
    try {
      p.base64 = await fileToBase64(file); p.fileName = file.name;
      await API.addCertificado(p, this._reqId());
      toast('Certificado registrado.', 'success');
      closeModal();
      this.certificados = await API.getCertificadosDaAcao(this.currentId) || [];
      this.renderDetail();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  removeCert(id) {
    if (!window.confirm('Excluir este certificado? O arquivo vai para a lixeira.')) return;
    (async () => {
      try { await API.deleteCertificado(id); toast('Certificado excluído.', 'success'); this.certificados = await API.getCertificadosDaAcao(this.currentId) || []; this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
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
        <div class="fg"><label>Coordenador adjunto</label><select class="input" id="ac-coorient">${servOpt(r ? r.coorientadorId : '')}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Data de início</label><input class="input" type="date" id="ac-inicio" value="${esc(r ? r.dataInicio : '')}"></div>
        <div class="fg"><label>Data de fim</label><input class="input" type="date" id="ac-fim" value="${esc(r ? r.dataFim : '')}"></div>
      </div>
      <div class="fg"><label>Código SIGAA</label><input class="input" id="ac-sigaa" value="${esc(r ? (r.codigoSIGAA || '') : '')}" placeholder="código da ação no SIGAA"></div>
      <div class="fg"><label>Resumo da ação</label><textarea class="input" id="ac-resumo" rows="4" placeholder="Descrição/resumo da ação">${esc(r ? (r.resumo || '') : '')}</textarea></div>
      <div class="fg"><label>Imagem / logo da ação</label>
        ${r && r.logoUrl ? `<img src="${esc(r.logoUrl)}" alt="" style="max-width:160px;max-height:110px;border-radius:8px;display:block;margin:2px 0 6px">
          <label class="chk-item"><input type="checkbox" id="ac-logo-remove"> Remover imagem atual</label>` : ''}
        <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" class="input" id="ac-logo-file">
        <span class="field-hint">PNG ou JPG. Enviada ao salvar.</span></div>
      <p class="section-sub">Colaboradores são gerenciados na aba <strong>🤝 Colaboradores</strong>.</p>`;
  },

  onEditalChange() {
    const e = this.editais.find(x => String(x.ID) === String(val('ac-edital')));
    const seg = document.getElementById('ac-segmento');
    if (e && e.Segmento && seg) seg.value = e.Segmento;
  },

  _harvest() {
    return {
      titulo: val('ac-titulo'), tipoAcao: val('ac-tipo'), modalidade: val('ac-modalidade'),
      anoExecucao: val('ac-ano'), segmento: val('ac-segmento'), editalId: val('ac-edital'),
      coordenadorId: val('ac-coord'), coorientadorId: val('ac-coorient'),
      dataInicio: val('ac-inicio'), dataFim: val('ac-fim'), status: val('ac-status'),
      resumo: val('ac-resumo'), codigoSIGAA: val('ac-sigaa')
    };
  },

  async save(id) {
    const p = this._harvest();
    // Imagem/logo escolhida no próprio formulário.
    const fileEl = document.getElementById('ac-logo-file');
    const file = fileEl && fileEl.files[0];
    const removeLogo = document.getElementById('ac-logo-remove') && document.getElementById('ac-logo-remove').checked;
    let logoB64 = null, logoName = null;
    if (file) {
      if (!/\.(png|jpe?g)$/i.test(file.name) || (file.type && !/image\/(png|jpe?g)/i.test(file.type))) {
        toast('A imagem deve ser PNG ou JPG.', 'error'); return;
      }
      logoB64 = await fileToBase64(file);
      logoName = file.name;
    }
    setBusy(true);
    try {
      let savedId = id;
      if (id) await API.updateAcao(id, p);
      else { const res = await API.addAcao(p, this._reqId()); savedId = res && res.id; }
      if (removeLogo && id && !logoB64) await API.uploadAcaoLogo(id, { remove: true });
      if (logoB64 && savedId) await API.uploadAcaoLogo(savedId, { fileName: logoName, base64: logoB64 });
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
