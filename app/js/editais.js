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
      if (this.filterStatus && (e.Status || 'Vigente') !== this.filterStatus) return false;
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
      <option ${this.filterStatus === 'Vigente' ? 'selected' : ''}>Vigente</option>
      <option ${this.filterStatus === 'Encerrado' ? 'selected' : ''}>Encerrado</option>`;
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

  statusBadge(e) {
    return (e.Status === 'Encerrado')
      ? '<span class="badge badge-danger-soft">Encerrado</span>'
      : '<span class="badge badge-ok">Vigente</span>';
  },

  rowHtml(e) {
    const badge = this.statusBadge(e);
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
            ${e.LinkPublicacao ? `<a href="${esc(e.LinkPublicacao)}" target="_blank" rel="noopener">🔗 Link da publicação</a>` : ''}
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
    const link = e.LinkPublicacao ? `<a href="${esc(e.LinkPublicacao)}" target="_blank" rel="noopener">abrir ↗</a>` : '—';
    const tf = e.tipoFomento || {};
    const tfStr = Object.keys(tf).length
      ? Object.keys(tf).map(s => `${s}: ${esc(tf[s] || '—')}`).join(' · ') : '—';

    // Bloco Recurso (só se houver fomento).
    let recurso = '';
    if (e.Fomento === 'Sim') {
      recurso = `<h4 class="detail-sec">💰 Recurso financeiro</h4>
        <div class="detail-grid">
          ${cell('Agência/Órgão', esc(e.AgenciaFomento || '—'))}
          ${cell('Tipo de fomento', tfStr)}
          ${cell('Custeio', fmtMoney(e.Custeio))}
          ${cell('Capital', fmtMoney(e.Capital))}
          ${cell('Total', fmtMoney(e.Total))}
          ${cell('Bolsa', esc(e.Bolsa || 'Não'))}
          ${e.Bolsa === 'Sim' ? cell('Agência/Órgão (bolsa)', esc(e.AgenciaBolsa || '—')) : ''}
        </div>`;
      if (e.Bolsa === 'Sim' && (e.bolsas || []).length) {
        recurso += `<table class="mini-table"><thead><tr>
          ${e.Segmento === 'Conjunto' ? '<th>Segmento</th>' : ''}<th>Tipo</th><th>CH</th><th>R$</th><th>Nº</th><th>Período</th>
          </tr></thead><tbody>${e.bolsas.map(b => `<tr>
            ${e.Segmento === 'Conjunto' ? `<td>${esc(b.segmento || '—')}</td>` : ''}
            <td>${esc(b.tipo || '—')}</td><td>${esc(b.ch || '—')}</td><td>${fmtMoney(b.valor)}</td>
            <td>${esc(b.nBolsas || '—')}</td><td>${esc(b.periodoMeses ? b.periodoMeses + ' meses' : '—')}</td>
          </tr>`).join('')}</tbody></table>`;
      }
    }

    // Cronograma.
    let crono = `<h4 class="detail-sec">📅 Cronograma</h4>
      <div class="detail-grid">
        ${cell('Publicação', esc(this.dateVal(e.DataPublicacao) || '—'))}
      </div>`;
    if ((e.cronograma || []).length) {
      crono += `<table class="mini-table"><thead><tr><th>Etapa</th><th>Período</th></tr></thead>
        <tbody>${e.cronograma.map(c => `<tr><td>${esc(c.etapa || '—')}</td>
          <td>${(c.inicio || c.fim) ? `${esc(this.dateVal(c.inicio) || '?')} – ${esc(this.dateVal(c.fim) || '?')}` : '—'}</td></tr>`).join('')}</tbody></table>`;
    }

    const body = `
      <h3 class="detail-title">${esc(e.Titulo || '')} ${this.statusBadge(e)}</h3>
      ${e.Resumo ? `<p class="detail-resumo">${esc(e.Resumo)}</p>` : ''}
      <div class="detail-grid">
        ${cell('Número', esc(e.Numero || '—'))}
        ${cell('Ano', esc(e.Ano || '—'))}
        ${cell('Segmento', esc(e.Segmento || '—'))}
        ${cell('Categoria', esc(e.Categoria || '—'))}
        ${cell('Tipo de edital', esc(e.TipoEdital || '—'))}
        ${cell('Regime', esc(e.Regime || '—'))}
        ${cell('Fomento/Auxílio', esc(e.Fomento || 'Não'))}
        ${cell('Documentos', (e.docsCount || 0) + ' PDF(s)')}
        ${cell('Link da publicação', link)}
      </div>
      ${recurso}
      ${crono}`;
    openModal('Edital ' + (e.Numero || '') + '/' + (e.Ano || ''), body, null, { hideFooter: true });
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

  _tfStr(e) {
    const tf = e.tipoFomento || {};
    return Object.keys(tf).map(s => `${s}:${tf[s]}`).join(' | ');
  },

  exportXLS() {
    const rows = this.sortedFiltered().map(e => [
      e.Numero, e.Ano, e.Titulo, e.Segmento, e.Categoria, e.TipoEdital, e.Regime, e.Status,
      e.Fomento, e.AgenciaFomento, this._tfStr(e), e.Custeio, e.Capital, e.Total,
      e.Bolsa, e.AgenciaBolsa, this.dateVal(e.DataPublicacao), e.LinkPublicacao
    ]);
    exportXLS(['Número', 'Ano', 'Título', 'Segmento', 'Categoria', 'Tipo de edital', 'Regime',
      'Status', 'Fomento', 'Agência fomento', 'Tipo fomento', 'Custeio', 'Capital', 'Total',
      'Bolsa', 'Agência bolsa', 'Publicação', 'Link'], rows, 'Editais');
  },

  exportPDF() {
    const rows = this.sortedFiltered().map(e => [
      e.Numero + '/' + e.Ano, e.Titulo, e.Segmento, e.TipoEdital,
      this.dateVal(e.DataPublicacao), e.Status
    ]);
    exportPDF('Editais — SGA', ['Nº/Ano', 'Título', 'Segmento', 'Tipo', 'Publicação', 'Status'], rows);
  },

  // ── Formulário (novo / editar) — 3 abas ─────────────────────
  openForm(id) {
    const e = id ? this.data.find(x => x.ID === id) : null;
    this.formTab = 'dados';
    this.form = e ? {
      numero: e.Numero, ano: e.Ano, titulo: e.Titulo, resumo: e.Resumo, segmento: e.Segmento,
      categoria: e.Categoria, tipoEdital: e.TipoEdital, regime: e.Regime, link: e.LinkPublicacao,
      fomento: e.Fomento, agenciaFomento: e.AgenciaFomento, tipoFomento: e.tipoFomento || {},
      custeio: e.Custeio, capital: e.Capital, bolsa: e.Bolsa, agenciaBolsa: e.AgenciaBolsa,
      bolsas: (e.bolsas || []).slice(), dataPublicacao: e.DataPublicacao,
      cronograma: (e.cronograma || []).slice(), statusManual: e.StatusManual
    } : {
      numero: '', ano: new Date().getFullYear(), titulo: '', resumo: '', segmento: '',
      categoria: 'Interno', tipoEdital: '', regime: '', link: '', fomento: 'Não',
      agenciaFomento: '', tipoFomento: {}, custeio: '', capital: '', bolsa: 'Não',
      agenciaBolsa: '', bolsas: [], dataPublicacao: '', cronograma: [], statusManual: ''
    };
    this.formEditalId = id || null;
    this._formMinH = 0;
    openModal(id ? 'Editar edital' : 'Novo edital', this.formBody(),
      null, { hideFooter: true });   // navegação/salvar ficam nos botões das abas
    this.afterRender();
    this._measureForm();
  },

  // Fixa a altura do corpo do form pela aba Dados (ativa ao abrir), p/ não variar entre abas.
  _measureForm() {
    const sec = document.querySelector('#ftab-body .ftab-sec');
    if (!sec) return;
    this._formMinH = sec.offsetHeight;
    const b = document.getElementById('ftab-body');
    if (b) b.style.minHeight = this._formMinH + 'px';
  },

  // Após (re)renderizar o corpo do form: se a aba ativa for Documentos, carrega os PDFs.
  afterRender() {
    if (this.formTab !== 'docs') return;
    const box = document.getElementById('docs-tab-body');
    if (!box) return;
    if (!this.formEditalId) {
      box.innerHTML = emptyState('Salve o edital primeiro para anexar documentos. ' +
        'Ao criar, a janela de documentos abre automaticamente.');
      return;
    }
    this._docsTarget = 'docs-tab-body';
    this.renderDocs(this.formEditalId);
  },

  _segKey(s) { return { 'Ensino': 'ens', 'Pesquisa': 'pes', 'Extensão': 'ext', 'Indissociável': 'ind' }[s] || 'x'; },

  _datalists() {
    const segLists = SEGMENTOS_BASE.map(s => {
      const k = this._segKey(s);
      const fom = (TIPO_FOMENTO[s] || []).map(o => `<option value="${esc(o)}">`).join('');
      const bol = (TIPO_BOLSA[s] || []).map(o => `<option value="${esc(o)}">`).join('');
      return `<datalist id="dl-fom-${k}">${fom}</datalist><datalist id="dl-bol-${k}">${bol}</datalist>`;
    }).join('');
    const te = TIPO_EDITAL.map(o => `<option value="${esc(o)}">`).join('');
    const rg = REGIME_EDITAL.map(o => `<option value="${esc(o)}">`).join('');
    return segLists + `<datalist id="dl-tipoedital">${te}</datalist><datalist id="dl-regime">${rg}</datalist>`;
  },

  _fomentoTipoFields() {
    const f = this.form;
    const segs = f.segmento === 'Conjunto' ? SEGMENTOS_BASE : (SEGMENTOS_BASE.indexOf(f.segmento) >= 0 ? [f.segmento] : []);
    if (!segs.length) return '<p class="line-empty">Escolha um segmento (aba Dados) para definir o tipo de fomento.</p>';
    const inner = segs.map(s => {
      const k = this._segKey(s);
      return `<div class="fg"><label>Tipo de fomento${f.segmento === 'Conjunto' ? ' — ' + s : ''}</label>
        <input class="input" id="f-tipofom-${s}" list="dl-fom-${k}" value="${esc((f.tipoFomento || {})[s] || '')}"
               placeholder="${esc((TIPO_FOMENTO[s] || []).join(', '))} ou outro"></div>`;
    }).join('');
    return segs.length > 1 ? `<div class="form-grid">${inner}</div>` : inner;
  },

  _bolsaRow(b, i) {
    const conjunto = this.form.segmento === 'Conjunto';
    const lineSeg = conjunto ? (b.segmento || '') : this.form.segmento;
    const k = this._segKey(lineSeg);
    const segCell = conjunto
      ? `<select class="input line-seg" id="bl-seg-${i}" onchange="Editais.formReRender()"><option value="">segmento…</option>${SEGMENTOS_BASE.map(s => `<option ${b.segmento === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`
      : `<input type="hidden" id="bl-seg-${i}" value="${esc(this.form.segmento || '')}">`;
    return `<div class="line-row bolsa-row">
      ${segCell}
      <input class="input bl-tipo" id="bl-tipo-${i}" list="dl-bol-${k}" placeholder="Tipo" value="${esc(b.tipo || '')}">
      <input class="input bl-ch" type="number" id="bl-ch-${i}" placeholder="CH" value="${esc(b.ch || '')}" onchange="Editais.chPrefill(${i})">
      <input class="input bl-valor" id="bl-valor-${i}" placeholder="R$" value="${esc(b.valor || '')}">
      <input class="input bl-num" type="number" id="bl-num-${i}" placeholder="Nº" value="${esc(b.nBolsas || '')}">
      <input class="input bl-per" type="number" id="bl-per-${i}" placeholder="meses" value="${esc(b.periodoMeses || '')}">
      <button class="btn btn-danger btn-xs" onclick="Editais.removeBolsa(${i})" title="Remover">✕</button>
    </div>`;
  },

  _etapaRow(c, i) {
    return `<div class="line-row crono-row">
      <input class="input" id="cr-etapa-${i}" placeholder="Etapa (ex.: Inscrições)" value="${esc(c.etapa || '')}">
      <input class="input" type="date" id="cr-ini-${i}" value="${esc(this.dateVal(c.inicio))}">
      <input class="input" type="date" id="cr-fim-${i}" value="${esc(this.dateVal(c.fim))}">
      <button class="btn btn-danger btn-xs" onclick="Editais.removeEtapa(${i})" title="Remover">✕</button>
    </div>`;
  },

  formBody() {
    const f = this.form;
    const tab = (id, label) => `<button type="button" class="ftab ${this.formTab === id ? 'active' : ''}" onclick="Editais.switchTab('${id}')">${label}</button>`;
    const hide = (id) => this.formTab === id ? '' : 'style="display:none"';
    const opt = (list, sel) => list.map(o => `<option ${sel === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    // Navegação estilo assistente.
    const backBtn = (t) => `<button type="button" class="btn btn-ghost" onclick="Editais.switchTab('${t}')">← Voltar</button>`;
    const nextBtn = (t) => `<button type="button" class="btn btn-primary" onclick="Editais.switchTab('${t}')">Avançar →</button>`;
    const saveBtn = `<button type="button" id="wiz-save" class="btn btn-primary" onclick="Editais.save()">${this.formEditalId ? 'Salvar' : 'Criar edital'}</button>`;
    const doneBtn = `<button type="button" class="btn btn-primary" onclick="closeModal()">Concluir</button>`;
    const nav = (left, right) => `<div class="ftab-nav">${left || '<span></span>'}${right}</div>`;

    const dados = `<div class="ftab-sec" ${hide('dados')}>
      <div class="form-grid">
        <div class="fg"><label>*Número</label><input class="input" id="f-numero" value="${esc(f.numero || '')}"></div>
        <div class="fg"><label>*Ano</label><input class="input" id="f-ano" value="${esc(f.ano || '')}"></div>
      </div>
      <div class="fg"><label>*Título</label><input class="input" id="f-titulo" value="${esc(f.titulo || '')}"></div>
      <div class="fg"><label>Resumo</label><textarea class="input" id="f-resumo" rows="3">${esc(f.resumo || '')}</textarea></div>
      <div class="form-grid">
        <div class="fg"><label>*Segmento</label><select class="input" id="f-segmento" onchange="Editais.formReRender()"><option value="">—</option>${opt(SEGMENTOS, f.segmento)}</select></div>
        <div class="fg"><label>Categoria</label><select class="input" id="f-categoria">${opt(CATEGORIA_EDITAL, f.categoria)}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Tipo de edital</label><input class="input" id="f-tipoedital" list="dl-tipoedital" value="${esc(f.tipoEdital || '')}" placeholder="Fomento, Seleção… ou outro"></div>
        <div class="fg"><label>Regime</label><input class="input" id="f-regime" list="dl-regime" value="${esc(f.regime || '')}" placeholder="Chamada única, Fluxo contínuo… ou outro"></div>
      </div>
      <div class="fg"><label>Link da publicação</label><input class="input" id="f-link" placeholder="https://…" value="${esc(f.link || '')}"></div>
      <div class="fg"><label>Status</label><select class="input" id="f-statusmanual">
          <option ${f.statusManual !== 'Encerrado' ? 'selected' : ''}>Vigente</option>
          <option ${f.statusManual === 'Encerrado' ? 'selected' : ''}>Encerrado</option>
        </select></div>
      ${nav('', nextBtn('recurso'))}
    </div>`;

    const recurso = `<div class="ftab-sec" ${hide('recurso')}>
      <div class="fg"><label>Fomento / Auxílio</label><select class="input" id="f-fomento" onchange="Editais.formReRender()"><option ${f.fomento === 'Sim' ? 'selected' : ''}>Sim</option><option ${f.fomento !== 'Sim' ? 'selected' : ''}>Não</option></select></div>
      <div ${f.fomento === 'Sim' ? '' : 'style="display:none"'}>
        <div class="fg"><label>Agência / Órgão financiador</label><input class="input" id="f-agfomento" value="${esc(f.agenciaFomento || '')}"></div>
        ${this._fomentoTipoFields()}
        <div class="form-grid form-grid-3">
          <div class="fg"><label>Custeio (R$)</label><input class="input" id="f-custeio" value="${esc(f.custeio || '')}" oninput="Editais.updateTotal()"></div>
          <div class="fg"><label>Capital (R$)</label><input class="input" id="f-capital" value="${esc(f.capital || '')}" oninput="Editais.updateTotal()"></div>
          <div class="fg"><label>Total</label><input class="input" id="f-total" readonly value="${fmtMoney(parseMoney(f.custeio) + parseMoney(f.capital))}"></div>
        </div>
        <div class="fg"><label>Bolsa</label><select class="input" id="f-bolsa" onchange="Editais.formReRender()"><option ${f.bolsa === 'Sim' ? 'selected' : ''}>Sim</option><option ${f.bolsa !== 'Sim' ? 'selected' : ''}>Não</option></select></div>
        <div ${f.bolsa === 'Sim' ? '' : 'style="display:none"'}>
          <div class="fg"><label>Agência / Órgão financiador (bolsa)</label><input class="input" id="f-agbolsa" value="${esc(f.agenciaBolsa || '')}"></div>
          <div class="line-label"><span>Bolsas ${this.form.segmento === 'Conjunto' ? '(informe o segmento em cada linha)' : ''}</span><button type="button" class="btn btn-ghost btn-xs" onclick="Editais.addBolsa()">+ adicionar</button></div>
          <div id="bolsa-lines">${(f.bolsas || []).map((b, i) => this._bolsaRow(b, i)).join('') || '<p class="line-empty">Nenhuma linha.</p>'}</div>
        </div>
      </div>
      ${nav(backBtn('dados'), nextBtn('crono'))}
    </div>`;

    const crono = `<div class="ftab-sec" ${hide('crono')}>
      <div class="fg"><label>Data da publicação</label><input type="date" class="input" id="f-datapub" value="${esc(this.dateVal(f.dataPublicacao))}"></div>
      <div class="line-label"><span>Etapas</span><button type="button" class="btn btn-ghost btn-xs" onclick="Editais.addEtapa()">+ adicionar</button></div>
      <div id="crono-lines">${(f.cronograma || []).map((c, i) => this._etapaRow(c, i)).join('') || '<p class="line-empty">Nenhuma etapa.</p>'}</div>
      ${nav(backBtn('recurso'), saveBtn)}
    </div>`;

    const docs = `<div class="ftab-sec" ${hide('docs')}><div id="docs-tab-body"></div>${nav(backBtn('crono'), doneBtn)}</div>`;
    const minH = this._formMinH ? ` style="min-height:${this._formMinH}px"` : '';

    return `<div class="ftabs">${tab('dados', '📋 Dados')}${tab('recurso', '💰 Recurso')}${tab('crono', '📅 Cronograma')}${tab('docs', '📎 Documentos')}</div>
      <div id="ftab-body"${minH}>${dados}${recurso}${crono}${docs}</div>${this._datalists()}`;
  },

  switchTab(t) { this.harvest(); this.formTab = t; document.getElementById('modal-body').innerHTML = this.formBody(); this.afterRender(); },
  formReRender() { this.harvest(); document.getElementById('modal-body').innerHTML = this.formBody(); this.afterRender(); },

  harvest() {
    const f = this.form;
    f.numero = val('f-numero'); f.ano = val('f-ano'); f.titulo = val('f-titulo'); f.resumo = val('f-resumo');
    f.segmento = val('f-segmento'); f.categoria = val('f-categoria'); f.tipoEdital = val('f-tipoedital');
    f.regime = val('f-regime'); f.link = val('f-link'); f.statusManual = val('f-statusmanual');
    f.fomento = val('f-fomento'); f.agenciaFomento = val('f-agfomento');
    f.custeio = val('f-custeio'); f.capital = val('f-capital');
    f.bolsa = val('f-bolsa'); f.agenciaBolsa = val('f-agbolsa');
    f.dataPublicacao = val('f-datapub');
    const segs = f.segmento === 'Conjunto' ? SEGMENTOS_BASE : (SEGMENTOS_BASE.indexOf(f.segmento) >= 0 ? [f.segmento] : []);
    const tf = {};
    segs.forEach(s => { const el = document.getElementById('f-tipofom-' + s); if (el) tf[s] = el.value.trim(); });
    f.tipoFomento = tf;
    f.bolsas = (f.bolsas || []).map((_, i) => ({
      segmento: (document.getElementById('bl-seg-' + i) || {}).value || '',
      tipo: val('bl-tipo-' + i), ch: val('bl-ch-' + i), valor: val('bl-valor-' + i),
      nBolsas: val('bl-num-' + i), periodoMeses: val('bl-per-' + i)
    }));
    f.cronograma = (f.cronograma || []).map((_, i) => ({
      etapa: val('cr-etapa-' + i), inicio: val('cr-ini-' + i), fim: val('cr-fim-' + i)
    }));
  },

  addBolsa() { this.harvest(); this.form.bolsas.push({ segmento: this.form.segmento === 'Conjunto' ? '' : this.form.segmento, tipo: '', ch: '', valor: '', nBolsas: '', periodoMeses: '' }); this.formTab = 'recurso'; this.formReRenderKeep(); },
  removeBolsa(i) { this.harvest(); this.form.bolsas.splice(i, 1); this.formTab = 'recurso'; this.formReRenderKeep(); },
  addEtapa() { this.harvest(); this.form.cronograma.push({ etapa: '', inicio: '', fim: '' }); this.formTab = 'crono'; this.formReRenderKeep(); },
  removeEtapa(i) { this.harvest(); this.form.cronograma.splice(i, 1); this.formTab = 'crono'; this.formReRenderKeep(); },
  formReRenderKeep() { document.getElementById('modal-body').innerHTML = this.formBody(); this.afterRender(); },

  chPrefill(i) {
    const ch = (document.getElementById('bl-ch-' + i) || {}).value;
    const v = CH_VALOR[String(ch)];
    const el = document.getElementById('bl-valor-' + i);
    if (v != null && el) el.value = String(v);
  },

  updateTotal() {
    const el = document.getElementById('f-total');
    if (el) el.value = fmtMoney(parseMoney(val('f-custeio')) + parseMoney(val('f-capital')));
  },

  async save() {
    const id = this.formEditalId;
    this.harvest();
    const f = this.form;
    if (!f.numero || !f.titulo) { toast('Número e Título são obrigatórios (aba Dados).', 'error'); this.switchTab('dados'); return; }
    const p = {
      numero: f.numero, ano: f.ano, titulo: f.titulo, resumo: f.resumo, segmento: f.segmento,
      categoria: f.categoria, tipoEdital: f.tipoEdital, regime: f.regime, link: f.link,
      fomento: f.fomento, agenciaFomento: f.agenciaFomento, tipoFomento: f.tipoFomento,
      custeio: parseMoney(f.custeio), capital: parseMoney(f.capital),
      bolsa: f.bolsa, agenciaBolsa: f.agenciaBolsa,
      bolsas: (f.bolsas || []).map(b => ({
        segmento: b.segmento || '', tipo: b.tipo || '', ch: b.ch || '',
        valor: parseMoney(b.valor), nBolsas: b.nBolsas || '', periodoMeses: b.periodoMeses || ''
      })),
      dataPublicacao: f.dataPublicacao, cronograma: f.cronograma, statusManual: f.statusManual
    };
    const wb = document.getElementById('wiz-save');
    if (wb) { wb.disabled = true; wb.textContent = 'Salvando…'; }
    try {
      const res = id ? await API.updateEdital(id, p) : await API.addEdital(p);
      if (id) {
        toast('Edital atualizado.', 'success');
        closeModal();
        await this.reload();
      } else {
        // Criado: sem fechar a janela — vira modo edição e vai pra aba Documentos.
        toast('Edital criado. Anexe os documentos.', 'success');
        this.formEditalId = res.id;
        document.getElementById('modal-title').textContent = 'Editar edital';
        this.formTab = 'docs';
        this.formReRenderKeep();
        await this.reload();
      }
    } catch (e) {
      toast(e.message, 'error');
      if (wb) { wb.disabled = false; wb.textContent = id ? 'Salvar' : 'Criar edital'; }
    }
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
    this._docsTarget = 'modal-body';
    openModal('Documentos — ' + (e ? e.Numero + '/' + e.Ano : ''),
      '<div class="loading-page"><div class="spinner"></div></div>', null,
      { hideFooter: true });
    await this.renderDocs(id);
  },

  async renderDocs(id) {
    const target = this._docsTarget || 'modal-body';
    const box = () => document.getElementById(target);
    let docs = [];
    try { docs = await API.getEditalDocs(id) || []; }
    catch (e) { if (box()) box().innerHTML = emptyState('Erro: ' + e.message); return; }

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

    if (box()) box().innerHTML = uploader + list;
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
    // Diálogo nativo p/ não colidir com o modal (funciona no modal e na aba do form).
    if (!window.confirm('Remover este PDF? O arquivo será enviado para a lixeira do Drive.')) return;
    try {
      await API.deleteEditalDoc(docId);
      toast('Documento removido.', 'success');
      await this.renderDocs(editalId);
      await this.reload();
    } catch (e) { toast(e.message, 'error'); }
  },

  async renameDoc(docId, editalId) {
    const d = (this._docs || []).find(x => String(x.ID) === String(docId));
    const atual = d ? String(d.NomeArquivo || '').replace(/\.pdf$/i, '') : '';
    const novo = window.prompt('Novo nome do documento:', atual);
    if (novo == null) return;
    if (!novo.trim()) { toast('Informe um nome.', 'error'); return; }
    try {
      await API.renameEditalDoc(docId, novo);
      toast('Documento renomeado.', 'success');
      await this.renderDocs(editalId);
    } catch (e) { toast(e.message, 'error'); }
  }
};

// Necessário: app.js chama window['Editais'].mount e os onclick inline usam Editais.*
window.Editais = Editais;
