// ============================================================
// SGA — Módulo Editais (frontend)
// ============================================================

// Ícones dos botões de export (SVG inline — sem requisições externas).
const ICON_PDF = '<svg class="btn-ico" viewBox="0 0 40 48" width="30" height="36" aria-hidden="true"><path d="M4 2h20l12 12v30a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke="#2b2b2b" stroke-width="2.5"/><path d="M24 2v12h12" fill="none" stroke="#2b2b2b" stroke-width="2.5" stroke-linejoin="round"/><rect x="1" y="21" width="25" height="13" rx="2" fill="#e01f26"/><text x="13.5" y="31" font-family="Arial" font-size="8.5" font-weight="bold" fill="#fff" text-anchor="middle">PDF</text><path d="M33 29v8m-4-4 4 4 4-4" fill="none" stroke="#e01f26" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_XLS = '<svg class="btn-ico" viewBox="0 0 40 48" width="30" height="36" aria-hidden="true"><path d="M4 2h20l12 12v30a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke="#2b2b2b" stroke-width="2.5"/><path d="M24 2v12h12" fill="none" stroke="#2b2b2b" stroke-width="2.5" stroke-linejoin="round"/><g fill="#159a4f"><rect x="6" y="7" width="8" height="4.5"/><rect x="16" y="7" width="8" height="4.5"/><rect x="6" y="13.5" width="8" height="4.5"/><rect x="16" y="13.5" width="8" height="4.5"/></g><rect x="1" y="21" width="25" height="13" rx="2" fill="#159a4f"/><text x="13.5" y="31" font-family="Arial" font-size="8.5" font-weight="bold" fill="#fff" text-anchor="middle">XLS</text><path d="M33 29v8m-4-4 4 4 4-4" fill="none" stroke="#159a4f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const Editais = {
  container: null,
  role: null,
  data: [],
  filter: '',
  filterSeg: '',
  filterStatus: '',
  filterAno: '',
  sortKey: 'numAno',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },

  async mount(container, role) {
    this.container = container;
    this.role = role;
    // Fecha menus suspensos ao clicar fora (registra uma vez só).
    if (!this._menuInit) {
      document.addEventListener('click', (ev) => {
        document.querySelectorAll('details.row-menu[open]').forEach(d => {
          if (!d.contains(ev.target)) d.open = false;
        });
      });
      this._menuInit = true;
    }
    await this.reload();
  },

  async reload() {
    try {
      this.data = await API.getEditais() || [];
      this.render();
    } catch (e) {
      this.container.innerHTML = emptyState('Erro ao carregar editais: ' + (e && e.message ? e.message : e));
    }
  },

  // Converte data (ISO/Date/texto) para yyyy-mm-dd (inputs e export).
  dateVal(v) {
    if (!v) return '';
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d) ? s : d.toISOString().slice(0, 10);
  },

  filtered() {
    const q = this.filter.toLowerCase();
    return this.data.filter(e => {
      if (this.filterSeg && e.Segmento !== this.filterSeg) return false;
      if (this.filterStatus && (e.Status || 'Ativo') !== this.filterStatus) return false;
      if (this.filterAno && String(e.Ano) !== this.filterAno) return false;
      if (!q) return true;
      return [e.Numero, e.Ano, e.Titulo, e.Segmento, e.AgenciaFomento]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  },

  sortedFiltered() {
    const rows = this.filtered().slice();
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const key = this.sortKey;
    const v = (e) => {
      switch (key) {
        case 'numAno':   return (Number(e.Ano) || 0) * 100000 + (Number(e.Numero) || 0);
        case 'titulo':   return String(e.Titulo || '').toLowerCase();
        case 'segmento': return String(e.Segmento || '').toLowerCase();
        case 'status':   return String(e.Status || '').toLowerCase();
        case 'docs':     return Number(e.docsCount) || 0;
        default:         return 0;
      }
    };
    return rows.sort((a, b) => { const x = v(a), y = v(b); return x < y ? -dir : x > y ? dir : 0; });
  },

  th(key, label) {
    const active = this.sortKey === key;
    const arrow = active ? (this.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable${active ? ' sorted' : ''}" onclick="Editais.sort('${key}')">${label}${arrow}</th>`;
  },

  sort(key) {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = key; this.sortDir = 'asc'; }
    this.page = 1;
    this.render();
  },

  render() {
    const all = this.sortedFiltered();
    const totalPages = Math.max(1, Math.ceil(all.length / this.pageSize));
    if (this.page > totalPages) this.page = totalPages;
    if (this.page < 1) this.page = 1;
    const start = (this.page - 1) * this.pageSize;
    const rows = all.slice(start, start + this.pageSize);
    const w = this.canWrite();
    const novo = w ? `<button class="btn btn-primary" onclick="Editais.openForm()">+ Novo edital</button>` : '';

    const segOpts = ['<option value="">Todos os segmentos</option>']
      .concat(SEGMENTOS.map(s => `<option ${this.filterSeg === s ? 'selected' : ''}>${s}</option>`)).join('');
    const stOpts = `<option value="">Todos os status</option>
      <option ${this.filterStatus === 'Ativo' ? 'selected' : ''}>Ativo</option>
      <option ${this.filterStatus === 'Inativo' ? 'selected' : ''}>Inativo</option>`;
    const anos = [...new Set(this.data.map(e => String(e.Ano)).filter(Boolean))].sort((a, b) => b - a);
    const anoOpts = ['<option value="">Todos os anos</option>']
      .concat(anos.map(a => `<option ${this.filterAno === a ? 'selected' : ''}>${a}</option>`)).join('');

    const table = rows.length ? `
      <div class="table-wrap menus">
        <table class="data-table">
          <thead><tr>
            ${this.th('numAno', 'Nº / Ano')}
            ${this.th('titulo', 'Título')}
            ${this.th('segmento', 'Segmento')}
            ${this.th('status', 'Status')}
            <th class="col-actions">Ações</th>
          </tr></thead>
          <tbody>${rows.map(e => this.rowHtml(e)).join('')}</tbody>
        </table>
      </div>`
      : emptyState(this.data.length ? 'Nenhum edital corresponde aos filtros.' : 'Nenhum edital cadastrado ainda.',
          (w && !this.data.length) ? `<button class="btn btn-primary" onclick="Editais.openForm()">+ Criar o primeiro edital</button>` : '');

    this.container.innerHTML = `
      <div class="page-actions">
        <span class="icon-btn" role="button" tabindex="0" title="Exportar XLS" onclick="Editais.exportXLS()">${ICON_XLS}</span>
        <span class="icon-btn" role="button" tabindex="0" title="Exportar PDF" onclick="Editais.exportPDF()">${ICON_PDF}</span>
        ${novo}
      </div>
      <div class="page-toolbar">
        <input class="input search" id="ed-search" placeholder="Buscar por número, título, segmento…"
               value="${esc(this.filter)}" oninput="Editais.onSearch(this.value)">
        <select class="input toolbar-select" onchange="Editais.onFilterSeg(this.value)">${segOpts}</select>
        <select class="input toolbar-select" onchange="Editais.onFilterStatus(this.value)">${stOpts}</select>
        <select class="input toolbar-select" onchange="Editais.onFilterAno(this.value)">${anoOpts}</select>
      </div>
      <div class="toolbar-count">${all.length} de ${this.data.length} edital(is)${all.length > this.pageSize ? ` · página ${this.page}/${totalPages}` : ''}</div>
      ${table}
      ${totalPages > 1 ? this.pagerHtml(totalPages) : ''}`;
  },

  pagerHtml(totalPages) {
    return `<div class="pager">
      <button class="btn btn-ghost btn-xs" onclick="Editais.goPage(${this.page - 1})" ${this.page === 1 ? 'disabled' : ''}>‹ Anterior</button>
      <span class="pager-info">Página ${this.page} de ${totalPages}</span>
      <button class="btn btn-ghost btn-xs" onclick="Editais.goPage(${this.page + 1})" ${this.page === totalPages ? 'disabled' : ''}>Próxima ›</button>
    </div>`;
  },

  goPage(p) { this.page = p; this.render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },

  rowHtml(e) {
    const badge = (e.Status === 'Inativo')
      ? '<span class="badge badge-muted">Inativo</span>'
      : '<span class="badge badge-ok">Ativo</span>';
    const w = this.canWrite();
    return `<tr>
      <td><strong>${esc(e.Numero || '—')}</strong><span class="cell-sub">/${esc(e.Ano || '')}</span></td>
      <td>${esc(e.Titulo || '')}</td>
      <td>${esc(e.Segmento || '—')}</td>
      <td>${badge}</td>
      <td class="col-actions">
        <details class="row-menu">
          <summary class="btn btn-ghost btn-xs">Ações ▾</summary>
          <div class="row-menu-list">
            <button onclick="Editais.openDetails('${e.ID}')">🔎 Ver detalhes</button>
            <button onclick="Editais.openFolder('${e.ID}')">📁 Pasta no Drive</button>
            <button onclick="Editais.openDocs('${e.ID}')">📎 Documentos</button>
            ${e.Link ? `<a href="${esc(e.Link)}" target="_blank" rel="noopener">🔗 Link do edital</a>` : ''}
            ${w ? `<button onclick="Editais.openForm('${e.ID}')">✏️ Editar</button>` : ''}
            ${w ? `<button onclick="Editais.clone('${e.ID}')">⧉ Clonar</button>` : ''}
            ${w ? `<button class="danger" onclick="Editais.remove('${e.ID}')">🗑 Excluir</button>` : ''}
          </div>
        </details>
      </td>
    </tr>`;
  },

  // Popup com todos os dados do edital.
  openDetails(id) {
    const e = this.data.find(x => String(x.ID) === String(id));
    if (!e) return;
    const cell = (k, v) => `<div><span class="dk">${esc(k)}</span><span class="dv">${v}</span></div>`;
    const link = e.Link ? `<a href="${esc(e.Link)}" target="_blank" rel="noopener">abrir ↗</a>` : '—';
    const body = `
      <h3 class="detail-title">${esc(e.Titulo || '')}</h3>
      <div class="detail-grid">
        ${cell('Número', esc(e.Numero || '—'))}
        ${cell('Ano', esc(e.Ano || '—'))}
        ${cell('Segmento', esc(e.Segmento || '—'))}
        ${cell('Status', esc(e.Status || 'Ativo'))}
        ${cell('Interno/Externo', esc(e.TipoInterno || '—'))}
        ${cell('Fomento/Auxílio', esc(e.Fomento || '—'))}
        ${cell('Bolsas', esc(e.Bolsas || '—'))}
        ${cell('Custeio/Capital', esc(e.CusteioCapital || '—'))}
        ${cell('Agência / Órgão', esc(e.AgenciaFomento || '—'))}
        ${cell('Publicação', esc(this.dateVal(e.DataPublicacao) || '—'))}
        ${cell('Inscrições início', esc(this.dateVal(e.InscricoesInicio) || '—'))}
        ${cell('Inscrições fim', esc(this.dateVal(e.InscricoesFim) || '—'))}
        ${cell('Resultado', esc(this.dateVal(e.DataResultado) || '—'))}
        ${cell('Documentos', (e.docsCount || 0) + ' PDF(s)')}
        ${cell('Link', link)}
      </div>`;
    openModal('Edital ' + (e.Numero || '') + '/' + (e.Ano || ''), body, null,
      { hideFooter: true });
  },

  onSearch(v) {
    this.filter = v; this.page = 1; this.render();
    const s = document.getElementById('ed-search');
    if (s) { s.focus(); s.setSelectionRange(v.length, v.length); }
  },
  onFilterSeg(v) { this.filterSeg = v; this.page = 1; this.render(); },
  onFilterStatus(v) { this.filterStatus = v; this.page = 1; this.render(); },
  onFilterAno(v) { this.filterAno = v; this.page = 1; this.render(); },

  openFolder(id) {
    const win = window.open('', '_blank');   // abre no gesto do clique (evita bloqueio de popup)
    API.getEditalFolderUrl(id)
      .then(res => { if (win) win.location = res.url; })
      .catch(e => { if (win) win.close(); toast(e.message, 'error'); });
  },

  exportXLS() {
    const rows = this.sortedFiltered().map(e => [
      e.Numero, e.Ano, e.Titulo, e.Segmento, e.Fomento, e.TipoInterno, e.Bolsas, e.CusteioCapital,
      e.AgenciaFomento, this.dateVal(e.DataPublicacao), this.dateVal(e.InscricoesInicio),
      this.dateVal(e.InscricoesFim), this.dateVal(e.DataResultado), e.Link, e.Status
    ]);
    exportXLS(['Número', 'Ano', 'Título', 'Segmento', 'Fomento', 'Interno/Externo', 'Bolsas',
      'Custeio/Capital', 'Agência', 'Publicação', 'Inscr. início', 'Inscr. fim', 'Resultado',
      'Link', 'Status'], rows, 'Editais');
  },

  exportPDF() {
    const rows = this.sortedFiltered().map(e => [
      e.Numero + '/' + e.Ano, e.Titulo, e.Segmento,
      this.dateVal(e.InscricoesInicio), this.dateVal(e.InscricoesFim), e.Status
    ]);
    exportPDF('Editais — SGA', ['Nº/Ano', 'Título', 'Segmento', 'Inscr. início', 'Inscr. fim', 'Status'], rows);
  },

  // ── Formulário (novo / editar) ──────────────────────────────
  openForm(id) {
    const e = id ? this.data.find(x => x.ID === id) : null;
    const title = id ? 'Editar edital' : 'Novo edital';
    openModal(title, this.formHtml(e), async () => { await this.save(id); },
      { confirmLabel: id ? 'Salvar' : 'Criar' });
  },

  formHtml(e) {
    e = e || {};
    const simNao = (v) => `<option ${v === 'Sim' ? 'selected' : ''}>Sim</option><option ${v !== 'Sim' ? 'selected' : ''}>Não</option>`;
    return `
    <!-- Campos principais — mesma disposição da V1 -->
    <div class="form-grid">
      <div class="fg"><label>*Número</label><input class="input" id="f-numero" value="${esc(e.Numero || '')}"></div>
      <div class="fg"><label>*Ano</label><input class="input" id="f-ano" value="${esc(e.Ano || new Date().getFullYear())}"></div>
    </div>
    <div class="fg"><label>*Título</label><input class="input" id="f-titulo" value="${esc(e.Titulo || '')}"></div>
    <div class="form-grid">
      <div class="fg"><label>*Fomento/Auxílio</label><select class="input" id="f-fomento">${simNao(e.Fomento)}</select></div>
      <div class="fg"><label>*Interno/Externo</label><select class="input" id="f-tipo"><option ${e.TipoInterno === 'Interno' ? 'selected' : ''}>Interno</option><option ${e.TipoInterno === 'Externo' ? 'selected' : ''}>Externo</option></select></div>
    </div>
    <div class="fg"><label>*Segmento</label><select class="input" id="f-segmento">${optionsHtml(SEGMENTOS, e.Segmento)}</select></div>
    <div class="form-grid">
      <div class="fg"><label>*Bolsas</label><select class="input" id="f-bolsas">${simNao(e.Bolsas)}</select></div>
      <div class="fg"><label>*Custeio/Capital</label><select class="input" id="f-custeio">${simNao(e.CusteioCapital)}</select></div>
    </div>

    <!-- Campos adicionais -->
    <div class="form-grid">
      <div class="fg"><label>Agência / Órgão de fomento</label><input class="input" id="f-agencia" value="${esc(e.AgenciaFomento || '')}"></div>
      <div class="fg"><label>Status</label><select class="input" id="f-status"><option ${e.Status !== 'Inativo' ? 'selected' : ''}>Ativo</option><option ${e.Status === 'Inativo' ? 'selected' : ''}>Inativo</option></select></div>
    </div>
    <fieldset class="form-fieldset"><legend>Datas</legend>
      <div class="form-grid form-grid-3">
        <div class="fg"><label>Publicação</label><input type="date" class="input" id="f-dpub" value="${esc(this.dateVal(e.DataPublicacao))}"></div>
        <div class="fg"><label>Inscrições — início</label><input type="date" class="input" id="f-ini" value="${esc(this.dateVal(e.InscricoesInicio))}"></div>
        <div class="fg"><label>Inscrições — fim</label><input type="date" class="input" id="f-fim" value="${esc(this.dateVal(e.InscricoesFim))}"></div>
      </div>
      <div class="fg"><label>Resultado</label><input type="date" class="input" id="f-resu" value="${esc(this.dateVal(e.DataResultado))}"></div>
    </fieldset>
    <div class="fg"><label>Link do edital (onde está salvo — SEI, SIGAA, Drive…)</label>
      <input class="input" id="f-link" placeholder="https://…" value="${esc(e.Link || '')}"></div>`;
  },

  async save(id) {
    const p = {
      numero: val('f-numero'), ano: val('f-ano'), titulo: val('f-titulo'),
      segmento: val('f-segmento'), agenciaFomento: val('f-agencia'),
      fomento: val('f-fomento'), tipoInterno: val('f-tipo'), bolsas: val('f-bolsas'),
      custeioCapital: val('f-custeio'), status: val('f-status'),
      dataPublicacao: val('f-dpub'), inscricoesInicio: val('f-ini'),
      inscricoesFim: val('f-fim'), dataResultado: val('f-resu'), link: val('f-link')
    };
    if (!p.numero || !p.titulo) { toast('Número e Título são obrigatórios.', 'error'); return; }
    setBusy(true);
    try {
      const res = id ? await API.updateEdital(id, p) : await API.addEdital(p);
      toast(id ? 'Edital atualizado.' : 'Edital criado.', 'success');
      closeModal();
      await this.reload();
      // Ao criar um edital novo, já abre a janela de Documentos para anexar os PDFs.
      if (!id && res && res.id) this.openDocs(res.id);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  async clone(id) {
    const e = this.data.find(x => x.ID === id);
    confirmDialog('Clonar edital',
      `Criar uma cópia de "${e ? e.Titulo : ''}"? Os documentos PDF não são copiados.`,
      async () => {
        try { await API.cloneEdital(id); toast('Edital clonado.', 'success'); await this.reload(); }
        catch (e) { toast(e.message, 'error'); }
      }, 'Clonar');
  },

  async remove(id) {
    const e = this.data.find(x => x.ID === id);
    confirmDialog('Excluir edital',
      `Excluir "${e ? e.Titulo : id}"? Os documentos PDF vinculados também serão removidos. Esta ação não pode ser desfeita.`,
      async () => {
        try { await API.deleteEdital(id); toast('Edital excluído.', 'success'); await this.reload(); }
        catch (e) { toast(e.message, 'error'); }
      }, 'Excluir');
  },

  // ── Documentos PDF ──────────────────────────────────────────
  async openDocs(id) {
    const e = this.data.find(x => x.ID === id);
    openModal('Documentos — ' + (e ? e.Numero + '/' + e.Ano : ''),
      '<div class="loading-page"><div class="spinner"></div></div>', null,
      { hideFooter: true });
    await this.renderDocs(id);
  },

  async renderDocs(id) {
    let docs = [];
    try { docs = await API.getEditalDocs(id) || []; }
    catch (e) { document.getElementById('modal-body').innerHTML = emptyState('Erro: ' + e.message); return; }

    const w = this.canWrite();
    this._docs = docs;  // usado por renameDoc para achar o nome atual
    const ed = this.data.find(x => String(x.ID) === String(id));
    const anoDefault = (ed && ed.Ano) ? ed.Ano : new Date().getFullYear();
    const uploader = w ? `
      <div class="upload-box">
        <div class="fg"><label>Nome do documento</label>
          <input class="input" id="doc-nome" placeholder="ex.: Edital 12-2026 — Chamada de bolsistas"></div>
        <div class="form-grid form-grid-3">
          <div class="fg"><label>Tipo</label><select class="input" id="doc-tipo">${optionsHtml(TIPOS_DOC)}</select></div>
          <div class="fg"><label>Ano da pasta</label>
            <input type="number" class="input" id="doc-ano" value="${esc(anoDefault)}" title="Pasta do Drive onde o PDF será guardado"></div>
          <div class="fg"><label>Arquivo PDF</label><input type="file" accept="application/pdf" class="input" id="doc-file" onchange="Editais.onDocFile()"></div>
        </div>
        <button class="btn btn-primary" id="doc-upload-btn" onclick="Editais.uploadDoc('${id}')">Enviar PDF</button>
      </div>` : '';

    const list = docs.length ? `
      <ul class="doc-list">
        ${docs.map(d => `
          <li class="doc-item">
            <span class="doc-type doc-type--${this.tipoClass(d.Tipo)}">${esc(d.Tipo)}</span>
            <a class="doc-name" href="${esc(d.DriveUrl)}" target="_blank" rel="noopener">${esc(d.NomeArquivo)}</a>
            <span class="doc-date">${esc(d.DataUpload || '')}</span>
            ${w ? `<button class="btn btn-ghost btn-xs" onclick="Editais.renameDoc('${d.ID}','${id}')">Renomear</button>` : ''}
            ${w ? `<button class="btn btn-danger btn-xs" onclick="Editais.deleteDoc('${d.ID}','${id}')">Remover</button>` : ''}
          </li>`).join('')}
      </ul>` : emptyState('Nenhum documento enviado ainda.');

    document.getElementById('modal-body').innerHTML = uploader + list;
  },

  tipoClass(t) {
    return { 'Edital': 'edital', 'Retificação': 'retif', 'Anexo': 'anexo', 'Demais publicações': 'demais' }[t] || 'demais';
  },

  onDocFile() {
    const f = document.getElementById('doc-file');
    const n = document.getElementById('doc-nome');
    if (f && n && !n.value && f.files[0]) n.value = f.files[0].name.replace(/\.pdf$/i, '');
  },

  async uploadDoc(editalId) {
    const fileEl = document.getElementById('doc-file');
    const tipo = val('doc-tipo');
    const nome = val('doc-nome');
    const ano  = val('doc-ano');
    const file = fileEl.files[0];
    if (!file) { toast('Selecione um arquivo PDF.', 'error'); return; }
    if (file.type && file.type !== 'application/pdf') { toast('O arquivo precisa ser um PDF.', 'error'); return; }
    if (!ano) { toast('Informe o ano da pasta.', 'error'); return; }

    const btn = document.getElementById('doc-upload-btn');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const base64 = await fileToBase64(file);
      await API.uploadEditalDoc({ editalId, tipo, nome, ano, fileName: file.name, base64 });
      toast('PDF enviado.', 'success');
      await this.renderDocs(editalId);
      // Atualiza a contagem na tabela.
      await this.reload();
      // Reabre a lista de docs (reload re-renderizou a página por baixo do modal).
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = 'Enviar PDF';
    }
  },

  async deleteDoc(docId, editalId) {
    confirmDialog('Remover documento', 'Remover este PDF? O arquivo será enviado para a lixeira do Drive.',
      async () => {
        try {
          await API.deleteEditalDoc(docId);
          toast('Documento removido.', 'success');
          await this.openDocs(editalId);
          await this.reload();
        } catch (e) { toast(e.message, 'error'); }
      }, 'Remover');
  },

  renameDoc(docId, editalId) {
    const d = (this._docs || []).find(x => String(x.ID) === String(docId));
    const atual = d ? String(d.NomeArquivo || '').replace(/\.pdf$/i, '') : '';
    openModal('Renomear documento',
      `<div class="fg"><label>Novo nome</label><input class="input" id="rn-nome" value="${esc(atual)}"></div>`,
      async () => {
        const novo = val('rn-nome');
        if (!novo) { toast('Informe um nome.', 'error'); return; }
        setBusy(true);
        try {
          await API.renameEditalDoc(docId, novo);
          toast('Documento renomeado.', 'success');
          await this.openDocs(editalId);
        } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
      }, { confirmLabel: 'Renomear' });
  }
};

// Necessário: app.js chama window['Editais'].mount e os onclick inline usam Editais.*
window.Editais = Editais;
