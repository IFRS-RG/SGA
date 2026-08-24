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

  // Token único por ação de criar/clonar (idempotência no backend).
  _reqId() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },

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
      return [e.Numero, e.Ano, e.Titulo, e.Segmento, e.Origem]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  },

  sortedFiltered() {
    const rows = this.filtered().slice();
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const key = this.sortKey;
    const v = (e) => {
      switch (key) {
        case 'id':       return String(e.ID || '');
        case 'numAno':   return (Number(e.Ano) || 0) * 100000 + (Number(e.Numero) || 0);
        case 'origem':   return String(e.Origem || '').toLowerCase();
        case 'titulo':   return String(e.Titulo || '').toLowerCase();
        case 'segmento': return String(e.Segmento || '').toLowerCase();
        case 'publicacao': return String(e.DataPublicacao || '');
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
            ${this.th('id', 'ID')}
            ${this.th('origem', 'Origem')}
            ${this.th('numAno', 'Nº / Ano')}
            ${this.th('titulo', 'Título')}
            ${this.th('segmento', 'Segmento')}
            ${this.th('publicacao', 'Publicação')}
            ${this.th('status', 'Status')}
            <th class="col-btn">Pasta</th>
            <th class="col-btn">Página</th>
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
      <td><span class="cell-id">${esc(e.ID || '')}</span></td>
      <td>${e.Origem ? esc(e.Origem) : '—'}</td>
      <td><strong>${esc(e.Numero || '—')}</strong><span class="cell-sub">/${esc(e.Ano || '')}</span></td>
      <td>${(e.editaisPai || []).length ? '<span class="link-chip" title="Edital vinculado (filho)">↳ vinculado</span> ' : ''}${esc(e.Titulo || '')}</td>
      <td>${esc(e.Segmento || '—')}</td>
      <td>${e.DataPublicacao ? esc(this.dateVal(e.DataPublicacao)) : '—'}</td>
      <td>${badge}</td>
      <td class="col-btn"><button class="btn btn-ghost btn-xs" title="Abrir pasta no Drive" onclick="Editais.openFolder('${e.ID}')">📁</button></td>
      <td class="col-btn">${e.LinkPublicacao ? `<a class="btn btn-ghost btn-xs" href="${esc(e.LinkPublicacao)}" target="_blank" rel="noopener" title="Abrir página do edital">🔗</a>` : '<span class="cell-sub">—</span>'}</td>
      <td class="col-actions">
        <details class="row-menu">
          <summary class="btn btn-ghost btn-xs">Ações ▾</summary>
          <div class="row-menu-list">
            <button onclick="Editais.openDetails('${e.ID}')">🔎 Ver detalhes</button>
            <button onclick="Editais.openDocs('${e.ID}')">📎 Documentos</button>
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
    // Bloco Recurso (fomento e bolsa por segmento).
    const rec = e.recurso || {};
    const segsD = Object.keys(rec);
    const conj = e.Segmento === 'Conjunto';
    const num = (x) => Number(x) || 0;
    let recurso = '';
    if (e.Fomento === 'Sim') {
      recurso += `<h4 class="detail-sec">💰 Fomento / Auxílio</h4>
        <table class="mini-table"><thead><tr>${conj ? '<th>Segmento</th>' : ''}<th>Agência</th><th>Tipo</th><th>Custeio</th><th>Capital</th><th>Total</th></tr></thead>
        <tbody>${segsD.map(s => { const r = rec[s] || {}; return `<tr>${conj ? `<td>${esc(s)}</td>` : ''}<td>${esc(r.agenciaFomento || '—')}</td><td>${esc(r.tipoFomento || '—')}</td><td>${fmtMoney(r.custeio)}</td><td>${fmtMoney(r.capital)}</td><td>${fmtMoney(num(r.custeio) + num(r.capital))}</td></tr>`; }).join('')}</tbody></table>
        <div class="detail-grid" style="margin-top:8px">${cell('Total custeio', fmtMoney(e.Custeio))}${cell('Total capital', fmtMoney(e.Capital))}${cell('Total geral', fmtMoney(e.Total))}</div>`;
    }
    if (e.Bolsa === 'Sim') {
      recurso += `<h4 class="detail-sec">🎓 Bolsa</h4>
        <table class="mini-table"><thead><tr>${conj ? '<th>Segmento</th>' : ''}<th>Agência (bolsa)</th><th>Tipo de bolsa</th><th>Período</th><th>Valor total</th></tr></thead>
        <tbody>${segsD.map(s => { const r = rec[s] || {}; return `<tr>${conj ? `<td>${esc(s)}</td>` : ''}<td>${esc(r.agenciaBolsa || '—')}</td><td>${esc(r.tipoBolsa || '—')}</td><td>${esc(r.periodoMeses ? r.periodoMeses + ' meses' : '—')}</td><td>${fmtMoney(r.valorTotalBolsa)}</td></tr>`; }).join('')}</tbody></table>`;
      if ((e.bolsas || []).length) {
        recurso += `<table class="mini-table" style="margin-top:8px"><thead><tr>${conj ? '<th>Segmento</th>' : ''}<th>CH</th><th>R$</th></tr></thead>
          <tbody>${e.bolsas.map(b => `<tr>${conj ? `<td>${esc(b.segmento || '—')}</td>` : ''}<td>${esc(b.ch || '—')}</td><td>${fmtMoney(b.valor)}</td></tr>`).join('')}</tbody></table>`;
      }
      recurso += `<div class="detail-grid" style="margin-top:8px">${cell('Valor total de bolsa', fmtMoney(e.ValorTotalBolsa))}</div>`;
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

    // Vínculos (pais e filhos).
    const lbl = (x) => `${esc(x.Numero)}/${esc(x.Ano)} — ${esc(x.Titulo)}`;
    const pais = (e.editaisPai || []).map(String)
      .map(pid => { const p = this.data.find(x => String(x.ID) === pid); return p ? lbl(p) : pid; });
    const filhos = (this.data || []).filter(x => (x.editaisPai || []).map(String).indexOf(String(e.ID)) >= 0);
    const vinc = (pais.length || filhos.length) ? `<h4 class="detail-sec">🔗 Vínculos</h4>
      <div class="detail-grid">
        ${cell('Editais pai', pais.length ? pais.join('<br>') : '—')}
        ${cell('Editais vinculados (filhos)', filhos.length ? filhos.map(lbl).join('<br>') : '—')}
      </div>` : '';

    const body = `
      <h3 class="detail-title">${esc(e.Titulo || '')} ${this.statusBadge(e)}</h3>
      ${e.Resumo ? `<p class="detail-resumo">${esc(e.Resumo)}</p>` : ''}
      <div class="detail-grid">
        ${cell('Número', esc(e.Numero || '—'))}
        ${cell('Ano', esc(e.Ano || '—'))}
        ${cell('Segmento', esc(e.Segmento || '—'))}
        ${cell('Origem', esc(e.Origem || '—'))}
        ${cell('Fomento/Auxílio', esc(e.Fomento || 'Não'))}
        ${cell('Bolsa', esc(e.Bolsa || 'Não'))}
        ${cell('Documentos', (e.docsCount || 0) + ' PDF(s)')}
        ${cell('Link da publicação', link)}
      </div>
      ${vinc}
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

  // Junta um campo do recurso por segmento em texto (ex.: "Ensino:PAIEN | Pesquisa:AIPCTI").
  _recStr(e, field) {
    const r = e.recurso || {};
    return Object.keys(r).map(s => (r[s] || {})[field] ? `${s}:${(r[s])[field]}` : '').filter(Boolean).join(' | ');
  },

  // Editais pai (vínculos), como "1/2026 | 2/2026".
  _paisStr(e) {
    return (e.editaisPai || []).map(pid => {
      const p = this.data.find(x => String(x.ID) === String(pid));
      return p ? (p.Numero + '/' + p.Ano) : pid;
    }).join(' | ');
  },

  exportXLS() {
    const rows = this.sortedFiltered().map(e => [
      e.ID, e.Numero, e.Ano, e.Titulo, e.Resumo, e.Segmento, e.Origem, e.Status,
      this.dateVal(e.DataPublicacao),
      e.Fomento, this._recStr(e, 'tipoFomento'), this._recStr(e, 'agenciaFomento'),
      fmtMoney(e.Custeio), fmtMoney(e.Capital), fmtMoney(e.Total),
      e.Bolsa, this._recStr(e, 'tipoBolsa'), this._recStr(e, 'agenciaBolsa'),
      this._recStr(e, 'periodoMeses'), fmtMoney(e.ValorTotalBolsa),
      this._paisStr(e), (e.AnoPasta || e.Ano), (e.docsCount || 0), e.LinkPublicacao
    ]);
    exportXLS(['ID', 'Número', 'Ano', 'Título', 'Resumo', 'Segmento', 'Origem', 'Status',
      'Publicação', 'Fomento', 'Tipo fomento', 'Agência fomento', 'Custeio', 'Capital', 'Total',
      'Bolsa', 'Tipo bolsa', 'Agência bolsa', 'Período bolsa', 'Valor total bolsa',
      'Vínculo (pais)', 'Ano da pasta', 'Docs', 'Link'], rows, 'Editais');
  },

  exportPDF() {
    const rows = this.sortedFiltered().map(e => [
      e.Numero + '/' + e.Ano, e.Origem, e.Titulo, e.Segmento,
      this.dateVal(e.DataPublicacao), e.Fomento, e.Bolsa, e.Status
    ]);
    exportPDF('Editais — SGA', ['Nº/Ano', 'Origem', 'Título', 'Segmento', 'Publicação',
      'Fomento', 'Bolsa', 'Status'], rows);
  },

  // ── Formulário (novo / editar) — 3 abas ─────────────────────
  openForm(id) {
    const e = id ? this.data.find(x => x.ID === id) : null;
    this.formTab = 'dados';
    this.form = e ? {
      numero: e.Numero, ano: e.Ano, titulo: e.Titulo, resumo: e.Resumo, segmento: e.Segmento,
      origem: e.Origem, link: e.LinkPublicacao,
      fomento: e.Fomento, bolsa: e.Bolsa, recurso: e.recurso || {},
      bolsas: (e.bolsas || []).slice(), dataPublicacao: e.DataPublicacao,
      cronograma: (e.cronograma || []).slice(), editaisPai: (e.editaisPai || []).map(String),
      anoPasta: e.AnoPasta || '', statusManual: e.StatusManual
    } : {
      numero: '', ano: new Date().getFullYear(), titulo: '', resumo: '', segmento: '',
      origem: '', link: '', fomento: 'Não', bolsa: 'Não', recurso: {},
      bolsas: [], dataPublicacao: '', cronograma: [], editaisPai: [], anoPasta: '', statusManual: ''
    };
    this.formEditalId = id || null;
    this.formMaxStep = id ? 3 : 0;   // edição: tudo liberado; novo: só Dados
    openModal(id ? 'Editar edital' : 'Novo edital', this.formBody(),
      null, { hideFooter: true, onClose: () => Editais.tryCloseForm() });
    const mb = document.querySelector('.modal-body');
    if (mb) mb.classList.add('modal-body--form');   // layout: abas fixas + rolagem no meio + rodapé fixo
    this.afterRender();
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
    const ca = ORIGEM_EDITAL.map(o => `<option value="${esc(o)}">`).join('');
    return segLists + `<datalist id="dl-origem">${ca}</datalist><datalist id="dl-agencia">${ca}</datalist>`;
  },

  // Segmentos que se aplicam ao recurso: Conjunto → os 4; senão o único escolhido.
  _segs() {
    const s = this.form.segmento;
    return s === 'Conjunto' ? SEGMENTOS_BASE : (SEGMENTOS_BASE.indexOf(s) >= 0 ? [s] : []);
  },

  // Bloco de FOMENTO por segmento (agência, tipo, custeio, capital, total).
  _fomentoSegBlock(seg) {
    const r = (this.form.recurso || {})[seg] || {};
    const k = this._segKey(seg);
    const head = this.form.segmento === 'Conjunto' ? `<div class="seg-head">${esc(seg)}</div>` : '';
    return `${head}
      <div class="fg"><label>Agência / Órgão financiador</label><input class="input" id="f-agfom-${seg}" list="dl-agencia" value="${esc(r.agenciaFomento || '')}" placeholder="IFRS-RG, PROEN… ou outro"></div>
      <div class="fg"><label>Tipo de fomento</label><input class="input" id="f-tipofom-${seg}" list="dl-fom-${k}" value="${esc(r.tipoFomento || '')}" placeholder="${esc((TIPO_FOMENTO[seg] || []).join(', '))} ou outro"></div>
      <div class="form-grid form-grid-3">
        <div class="fg"><label>Custeio (R$)</label><input class="input" id="f-custeio-${seg}" value="${esc(r.custeio || '')}" oninput="Editais.updateTotal('${seg}')"></div>
        <div class="fg"><label>Capital (R$)</label><input class="input" id="f-capital-${seg}" value="${esc(r.capital || '')}" oninput="Editais.updateTotal('${seg}')"></div>
        <div class="fg"><label>Total</label><input class="input" id="f-total-${seg}" readonly value="${fmtMoney(parseMoney(r.custeio) + parseMoney(r.capital))}"></div>
      </div>`;
  },

  // Bloco de BOLSA por segmento (agência, tipo de bolsa e valor total de bolsa).
  _bolsaSegBlock(seg) {
    const r = (this.form.recurso || {})[seg] || {};
    const k = this._segKey(seg);
    const head = this.form.segmento === 'Conjunto' ? `<div class="seg-head">${esc(seg)}</div>` : '';
    return `${head}
      <div class="fg"><label>Agência / Órgão financiador (bolsa)</label><input class="input" id="f-agbol-${seg}" list="dl-agencia" value="${esc(r.agenciaBolsa || '')}" placeholder="IFRS-RG, PROEN… ou outro"></div>
      <div class="fg"><label>Tipo de bolsa</label><input class="input" id="f-tipobol-${seg}" list="dl-bol-${k}" value="${esc(r.tipoBolsa || '')}" placeholder="${esc((TIPO_BOLSA[seg] || []).join(', '))} ou outro"></div>
      <div class="form-grid">
        <div class="fg"><label>Período (meses)</label><input type="number" class="input" id="f-permeses-${seg}" value="${esc(r.periodoMeses || '')}" placeholder="meses"></div>
        <div class="fg"><label>Valor total de bolsa (R$)</label><input class="input" id="f-vtbol-${seg}" value="${esc(r.valorTotalBolsa || '')}"></div>
      </div>`;
  },

  _bolsaRow(b, i) {
    const conjunto = this.form.segmento === 'Conjunto';
    const segCell = conjunto
      ? `<select class="input line-seg" id="bl-seg-${i}"><option value="">segmento…</option>${SEGMENTOS_BASE.map(s => `<option ${b.segmento === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`
      : `<input type="hidden" id="bl-seg-${i}" value="${esc(this.form.segmento || '')}">`;
    return `<div class="line-row bolsa-row">
      ${segCell}
      <input class="input" type="number" id="bl-ch-${i}" placeholder="CH (horas/semana)" value="${esc(b.ch || '')}" onchange="Editais.chPrefill(${i})">
      <input class="input" id="bl-valor-${i}" placeholder="R$ (por bolsa)" value="${esc(b.valor || '')}">
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
    const stepOrder = ['dados', 'recurso', 'crono', 'docs'];
    const maxStep = this.formMaxStep || 0;
    const tab = (id, label) => {
      const locked = stepOrder.indexOf(id) > maxStep;
      return `<button type="button" class="ftab ${this.formTab === id ? 'active' : ''}${locked ? ' locked' : ''}" ${locked ? 'disabled title="Avance pelas etapas anteriores para liberar"' : `onclick="Editais.switchTab('${id}')"`}>${label}${locked ? ' 🔒' : ''}</button>`;
    };
    const hide = (id) => this.formTab === id ? '' : 'style="display:none"';
    const opt = (list, sel) => list.map(o => `<option ${sel === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    let paiSel = (f.editaisPai || []).map(String);
    const soUmPai = f.segmento !== 'Conjunto';
    if (soUmPai && paiSel.length > 1) paiSel = paiSel.slice(0, 1);   // segmento único → 1 pai
    const outrosEditais = (this.data || []).filter(x => String(x.ID) !== String(this.formEditalId));
    const paiChecks = outrosEditais.length
      ? outrosEditais.map(x => `<label class="chk-item"><input type="checkbox" class="pai-chk" value="${esc(x.ID)}" ${paiSel.indexOf(String(x.ID)) >= 0 ? 'checked' : ''} onchange="Editais.onPaiCheck(this)"> ${esc(x.Numero)}/${esc(x.Ano)} — ${esc(x.Titulo)}</label>`).join('')
      : '<p class="line-empty">Nenhum outro edital cadastrado para vincular.</p>';
    const paiHint = soUmPai
      ? 'Segmento único: no máximo 1 edital principal. Para vincular a vários segmentos, use Segmento = Conjunto.'
      : 'Segmento Conjunto: marque um edital principal por segmento (vários permitidos).';

    const dados = `<div class="ftab-sec" ${hide('dados')}>
      <div class="form-grid">
        <div class="fg"><label>*Número</label><input class="input" id="f-numero" value="${esc(f.numero || '')}"></div>
        <div class="fg"><label>*Ano</label><input class="input" id="f-ano" value="${esc(f.ano || '')}"></div>
      </div>
      <div class="fg"><label>*Título</label><input class="input" id="f-titulo" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" value="${esc(f.titulo || '')}"></div>
      <div class="fg"><label>Resumo</label><textarea class="input" id="f-resumo" rows="3">${esc(f.resumo || '')}</textarea></div>
      <div class="form-grid">
        <div class="fg"><label>*Segmento</label><select class="input" id="f-segmento" onchange="Editais.formReRender()"><option value="">—</option>${opt(SEGMENTOS, f.segmento)}</select></div>
        <div class="fg"><label>Origem</label><input class="input" id="f-origem" list="dl-origem" value="${esc(f.origem || '')}" placeholder="IFRS-RG, PROEN… ou outro"></div>
      </div>
      <div class="fg"><label>Ano da pasta (no Drive)</label><input type="number" class="input" id="f-anopasta" value="${esc(f.anoPasta || f.ano || '')}" title="Ano da pasta onde o edital fica no Drive (padrão = Ano do edital)"></div>
      <div class="fg"><label>Link da publicação</label><input class="input" id="f-link" placeholder="https://…" value="${esc(f.link || '')}"></div>
      <div class="fg"><label>É um sub-edital? Marque o(s) edital(is) principal(is) a que ele pertence:</label>
        <div class="chk-list" id="pais-box">${paiChecks}</div>
        <span class="field-hint">Deixe tudo desmarcado se este for um edital principal. ${paiHint}</span></div>
      <div class="fg"><label>Status</label><select class="input" id="f-statusmanual">
          <option ${f.statusManual !== 'Encerrado' ? 'selected' : ''}>Vigente</option>
          <option ${f.statusManual === 'Encerrado' ? 'selected' : ''}>Encerrado</option>
        </select></div>
    </div>`;

    const segsR = this._segs();
    const conjuntoR = f.segmento === 'Conjunto';
    const semSeg = '<p class="line-empty">Escolha um segmento (aba Dados) primeiro.</p>';
    const fomentoBlocks = segsR.length ? segsR.map(s => this._fomentoSegBlock(s)).join('') : semSeg;
    const bolsaBlocks = segsR.length ? segsR.map(s => this._bolsaSegBlock(s)).join('') : semSeg;

    const recurso = `<div class="ftab-sec" ${hide('recurso')}>
      <fieldset class="form-fieldset recurso-box"><legend>💰 Fomento / Auxílio</legend>
        <div class="fg"><label>Este edital tem fomento/auxílio?</label><select class="input" id="f-fomento" onchange="Editais.formReRender()"><option ${f.fomento === 'Sim' ? 'selected' : ''}>Sim</option><option ${f.fomento !== 'Sim' ? 'selected' : ''}>Não</option></select></div>
        <div ${f.fomento === 'Sim' ? '' : 'style="display:none"'}>${fomentoBlocks}</div>
      </fieldset>
      <fieldset class="form-fieldset recurso-box"><legend>🎓 Bolsa</legend>
        <div class="fg"><label>Este edital tem bolsa?</label><select class="input" id="f-bolsa" onchange="Editais.formReRender()"><option ${f.bolsa === 'Sim' ? 'selected' : ''}>Sim</option><option ${f.bolsa !== 'Sim' ? 'selected' : ''}>Não</option></select></div>
        <div ${f.bolsa === 'Sim' ? '' : 'style="display:none"'}>
          ${bolsaBlocks}
          <div class="line-label"><span>Bolsas ${conjuntoR ? '(informe o segmento em cada linha)' : ''}</span><button type="button" class="btn btn-ghost btn-xs" onclick="Editais.addBolsa()">+ adicionar</button></div>
          <div id="bolsa-lines">${(f.bolsas || []).map((b, i) => this._bolsaRow(b, i)).join('') || '<p class="line-empty">Nenhuma linha.</p>'}</div>
        </div>
      </fieldset>
    </div>`;

    const crono = `<div class="ftab-sec" ${hide('crono')}>
      <div class="fg"><label>Data da publicação</label><input type="date" class="input" id="f-datapub" value="${esc(this.dateVal(f.dataPublicacao))}"></div>
      <div class="line-label"><span>Etapas</span><button type="button" class="btn btn-ghost btn-xs" onclick="Editais.addEtapa()">+ adicionar</button></div>
      <div id="crono-lines">${(f.cronograma || []).map((c, i) => this._etapaRow(c, i)).join('') || '<p class="line-empty">Nenhuma etapa.</p>'}</div>
    </div>`;

    const docs = `<div class="ftab-sec" ${hide('docs')}><div id="docs-tab-body"></div></div>`;

    return `<div class="ftabs">${tab('dados', '📋 Dados')}${tab('recurso', '💰 Recurso')}${tab('crono', '📅 Cronograma')}${tab('docs', '📎 Documentos')}</div>
      <div id="ftab-body">${dados}${recurso}${crono}${docs}</div>
      <div class="form-footer">${this._formNav()}</div>${this._datalists()}`;
  },

  // Rodapé fixo do assistente (fora da rolagem): Voltar/Avançar/Salvar/Concluir por etapa.
  _formNav() {
    const back = (t) => `<button type="button" class="btn btn-ghost" onclick="Editais.switchTab('${t}')">← Voltar</button>`;
    const next = (t) => `<button type="button" class="btn btn-primary" onclick="Editais.advance('${t}')">Avançar →</button>`;
    const save = `<button type="button" id="wiz-save" class="btn btn-primary" onclick="Editais.save()">${this.formEditalId ? 'Salvar' : 'Criar edital'}</button>`;
    const done = `<button type="button" class="btn btn-primary" onclick="Editais.tryCloseForm()">Concluir</button>`;
    let left = '<span></span>', right = '';
    if (this.formTab === 'dados') { right = next('recurso'); }
    else if (this.formTab === 'recurso') { left = back('dados'); right = next('crono'); }
    else if (this.formTab === 'crono') { left = back('recurso'); right = save; }
    else if (this.formTab === 'docs') { left = back('crono'); right = done; }
    return left + right;
  },

  switchTab(t) {
    if (['dados', 'recurso', 'crono', 'docs'].indexOf(t) > (this.formMaxStep || 0)) return;  // etapa travada
    this.harvest(); this.formTab = t;
    document.getElementById('modal-body').innerHTML = this.formBody();
    this.afterRender();
    const mb = document.querySelector('.modal-body');
    if (mb) mb.scrollTop = 0;   // sempre começa no topo da aba
  },

  // Avançar para a próxima etapa: valida a atual e libera a próxima.
  advance(target) {
    this.harvest();
    if (this.formTab === 'dados' && (!this.form.numero || !this.form.titulo)) {
      toast('Preencha Número e Título para avançar.', 'error'); return;
    }
    const ti = ['dados', 'recurso', 'crono', 'docs'].indexOf(target);
    if (ti > (this.formMaxStep || 0)) this.formMaxStep = ti;
    this.switchTab(target);
  },
  formReRender() { this.harvest(); document.getElementById('modal-body').innerHTML = this.formBody(); this.afterRender(); },

  harvest() {
    const f = this.form;
    f.numero = val('f-numero'); f.ano = val('f-ano'); f.titulo = val('f-titulo').toUpperCase(); f.resumo = val('f-resumo');
    f.segmento = val('f-segmento'); f.origem = val('f-origem'); f.anoPasta = val('f-anopasta');
    f.link = val('f-link'); f.statusManual = val('f-statusmanual');
    if (document.getElementById('pais-box')) {
      f.editaisPai = Array.from(document.querySelectorAll('.pai-chk:checked')).map(c => c.value);
    }
    f.fomento = val('f-fomento'); f.bolsa = val('f-bolsa');
    f.dataPublicacao = val('f-datapub');
    // Recurso por segmento.
    const rec = {};
    this._segs().forEach(seg => {
      rec[seg] = {
        agenciaFomento: val('f-agfom-' + seg), tipoFomento: val('f-tipofom-' + seg),
        custeio: val('f-custeio-' + seg), capital: val('f-capital-' + seg),
        agenciaBolsa: val('f-agbol-' + seg), tipoBolsa: val('f-tipobol-' + seg),
        periodoMeses: val('f-permeses-' + seg), valorTotalBolsa: val('f-vtbol-' + seg)
      };
    });
    f.recurso = rec;
    f.bolsas = (f.bolsas || []).map((_, i) => ({
      segmento: (document.getElementById('bl-seg-' + i) || {}).value || '',
      ch: val('bl-ch-' + i), valor: val('bl-valor-' + i)
    }));
    f.cronograma = (f.cronograma || []).map((_, i) => ({
      etapa: val('cr-etapa-' + i), inicio: val('cr-ini-' + i), fim: val('cr-fim-' + i)
    }));
  },

  addBolsa() { this.harvest(); this.form.bolsas.push({ segmento: this.form.segmento === 'Conjunto' ? '' : this.form.segmento, ch: '', valor: '' }); this.formTab = 'recurso'; this.formReRenderKeep(); },
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

  updateTotal(seg) {
    const el = document.getElementById('f-total-' + seg);
    if (el) el.value = fmtMoney(parseMoney(val('f-custeio-' + seg)) + parseMoney(val('f-capital-' + seg)));
  },

  // Segmento único → só 1 pai: ao marcar um, desmarca os outros.
  onPaiCheck(cb) {
    if (val('f-segmento') !== 'Conjunto' && cb.checked) {
      document.querySelectorAll('.pai-chk').forEach(c => { if (c !== cb) c.checked = false; });
    }
  },

  _buildPayload() {
    const f = this.form;
    const recurso = {};
    Object.keys(f.recurso || {}).forEach(seg => {
      const r = f.recurso[seg] || {};
      recurso[seg] = {
        agenciaFomento: r.agenciaFomento || '', tipoFomento: r.tipoFomento || '',
        custeio: parseMoney(r.custeio), capital: parseMoney(r.capital),
        agenciaBolsa: r.agenciaBolsa || '', tipoBolsa: r.tipoBolsa || '',
        periodoMeses: r.periodoMeses || '', valorTotalBolsa: parseMoney(r.valorTotalBolsa)
      };
    });
    return {
      numero: f.numero, ano: f.ano, titulo: f.titulo, resumo: f.resumo, segmento: f.segmento,
      origem: f.origem, link: f.link,
      fomento: f.fomento, bolsa: f.bolsa, recurso: recurso,
      bolsas: (f.bolsas || []).map(b => ({
        segmento: b.segmento || '', ch: b.ch || '', valor: parseMoney(b.valor)
      })),
      dataPublicacao: f.dataPublicacao, cronograma: f.cronograma,
      editaisPai: f.editaisPai || [], anoPasta: f.anoPasta || '', statusManual: f.statusManual
    };
  },

  async save() {
    const id = this.formEditalId;
    this.harvest();
    const f = this.form;
    if (!f.numero || !f.titulo) { toast('Número e Título são obrigatórios (aba Dados).', 'error'); this.switchTab('dados'); return; }
    const p = this._buildPayload();
    const wb = document.getElementById('wiz-save');
    if (wb) { wb.disabled = true; wb.textContent = 'Salvando…'; }
    try {
      const res = id ? await API.updateEdital(id, p) : await API.addEdital(p, this._reqId());
      if (id) {
        toast('Edital atualizado.', 'success');
        closeModal();
        await this.reload();
      } else {
        toast('Edital criado. Anexe os documentos.', 'success');
        this.formEditalId = res.id;
        this.formMaxStep = 3;   // agora é edição: tudo liberado
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

  // Pergunta ao fechar (× / clicar fora / Concluir): salvar, sair sem salvar ou cancelar.
  tryCloseForm() {
    const ov = document.createElement('div');
    ov.className = 'close-confirm-overlay';
    ov.innerHTML = `<div class="close-confirm">
        <h3>Fechar o edital?</h3>
        <p>Deseja salvar as alterações antes de sair?</p>
        <div class="cc-actions">
          <button class="btn btn-ghost" data-act="cancel">Cancelar</button>
          <button class="btn btn-danger" data-act="discard">Sair sem salvar</button>
          <button class="btn btn-primary" data-act="save">Salvar e sair</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      const act = e.target.getAttribute('data-act');
      if (e.target === ov || act === 'cancel') { ov.remove(); return; }
      if (act === 'discard') { ov.remove(); closeModal(); return; }
      if (act === 'save') { ov.remove(); this._saveAndExit(); return; }
    });
  },

  async _saveAndExit() {
    this.harvest();
    const f = this.form;
    if (!f.numero || !f.titulo) { toast('Preencha Número e Título para salvar.', 'error'); this.switchTab('dados'); return; }
    const id = this.formEditalId;
    const p = this._buildPayload();
    try {
      id ? await API.updateEdital(id, p) : await API.addEdital(p, this._reqId());
      toast('Salvo.', 'success');
      closeModal();
      await this.reload();
    } catch (e) { toast(e.message, 'error'); }
  },

  async clone(id) {
    const e = this.data.find(x => x.ID === id);
    confirmDialog('Clonar edital',
      `Criar uma cópia de "${e ? e.Titulo : ''}"? Os documentos PDF não são copiados.`,
      async () => {
        if (this._acting) return; this._acting = true;
        try { await API.cloneEdital(id, this._reqId()); toast('Edital clonado.', 'success'); await this.reload(); }
        catch (e) { toast(e.message, 'error'); } finally { this._acting = false; }
      }, 'Clonar');
  },

  async remove(id) {
    const e = this.data.find(x => x.ID === id);
    confirmDialog('Excluir edital',
      `Excluir "${e ? e.Titulo : id}"? O edital, seus documentos e a pasta dele no Drive serão removidos (a pasta vai para a lixeira). Se houver sub-editais vinculados, a exclusão é bloqueada. Esta ação não pode ser desfeita.`,
      async () => {
        if (this._acting) return; this._acting = true;
        try { await API.deleteEdital(id); toast('Edital excluído.', 'success'); await this.reload(); }
        catch (e) { toast(e.message, 'error'); } finally { this._acting = false; }
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
    const uploader = w ? `
      <div class="upload-box">
        <div class="fg"><label>Nome do documento</label>
          <input class="input" id="doc-nome" placeholder="ex.: Edital 12-2026 — Chamada de bolsistas"></div>
        <div class="fg"><label>Tipo</label><select class="input" id="doc-tipo">${optionsHtml(TIPOS_DOC)}</select></div>
        <div class="fg"><label>Arquivo PDF</label>
          <input type="file" accept="application/pdf,.pdf" class="input" id="doc-file" onchange="Editais.onDocFile()">
          <span class="field-hint" id="doc-file-name"></span></div>
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
    const fn = document.getElementById('doc-file-name');
    const file = f && f.files[0];
    if (file && n && !n.value) n.value = file.name.replace(/\.pdf$/i, '');
    if (fn) fn.textContent = file ? 'Arquivo escolhido: ' + file.name : '';
  },

  async uploadDoc(editalId) {
    const fileEl = document.getElementById('doc-file');
    const tipo = val('doc-tipo');
    const nome = val('doc-nome');
    const file = fileEl.files[0];
    if (!file) { toast('Selecione um arquivo PDF.', 'error'); return; }
    if (!/\.pdf$/i.test(file.name)) { toast('O arquivo precisa ter extensão .pdf.', 'error'); return; }
    if (file.type && file.type !== 'application/pdf') { toast('O arquivo precisa ser um PDF.', 'error'); return; }

    const btn = document.getElementById('doc-upload-btn');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const base64 = await fileToBase64(file);
      await API.uploadEditalDoc({ editalId, tipo, nome, fileName: file.name, base64 });
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
