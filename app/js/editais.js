// ============================================================
// SGA — Módulo Editais (frontend)
// ============================================================
const Editais = {
  container: null,
  role: null,
  data: [],
  filter: '',

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },

  async mount(container, role) {
    this.container = container;
    this.role = role;
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

  filtered() {
    const q = this.filter.toLowerCase();
    if (!q) return this.data;
    return this.data.filter(e =>
      [e.Numero, e.Ano, e.Titulo, e.Segmento, e.AgenciaFomento]
        .some(v => String(v || '').toLowerCase().includes(q)));
  },

  render() {
    const rows = this.filtered();
    const novo = this.canWrite()
      ? `<button class="btn btn-primary" onclick="Editais.openForm()">+ Novo edital</button>` : '';

    const table = rows.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Nº / Ano</th><th>Título</th><th>Segmento</th>
            <th>Inscrições</th><th>Docs</th><th>Status</th><th class="col-actions">Ações</th>
          </tr></thead>
          <tbody>
          ${rows.map(e => this.rowHtml(e)).join('')}
          </tbody>
        </table>
      </div>` : emptyState('Nenhum edital cadastrado ainda.',
        this.canWrite() ? `<button class="btn btn-primary" onclick="Editais.openForm()">+ Criar o primeiro edital</button>` : '');

    this.container.innerHTML = `
      <div class="page-toolbar">
        <input class="input search" id="ed-search" placeholder="Buscar por número, título, segmento…"
               value="${esc(this.filter)}" oninput="Editais.onSearch(this.value)">
        ${novo}
      </div>
      ${table}`;
  },

  rowHtml(e) {
    const insc = (e.InscricoesInicio || e.InscricoesFim)
      ? `${esc(e.InscricoesInicio || '?')} – ${esc(e.InscricoesFim || '?')}` : '—';
    const badge = e.Status === 'Ativo'
      ? '<span class="badge badge-ok">Ativo</span>'
      : '<span class="badge badge-muted">Inativo</span>';
    const w = this.canWrite();
    return `<tr>
      <td><strong>${esc(e.Numero || '—')}</strong><span class="cell-sub">/${esc(e.Ano || '')}</span></td>
      <td>${esc(e.Titulo || '')}</td>
      <td>${esc(e.Segmento || '—')}</td>
      <td>${insc}</td>
      <td><button class="chip" title="Anexar / ver PDFs" onclick="Editais.openDocs('${e.ID}')">📎 ${e.docsCount || 0}</button></td>
      <td>${badge}</td>
      <td class="col-actions">
        <button class="btn btn-ghost btn-xs" onclick="Editais.openDocs('${e.ID}')">📎 Documentos</button>
        ${e.Link ? `<a class="btn btn-ghost btn-xs" href="${esc(e.Link)}" target="_blank" rel="noopener">Link</a>` : ''}
        ${w ? `<button class="btn btn-ghost btn-xs" onclick="Editais.openForm('${e.ID}')">Editar</button>` : ''}
        ${w ? `<button class="btn btn-ghost btn-xs" onclick="Editais.clone('${e.ID}')">Clonar</button>` : ''}
        ${w ? `<button class="btn btn-danger btn-xs" onclick="Editais.remove('${e.ID}')">Excluir</button>` : ''}
      </td>
    </tr>`;
  },

  onSearch(v) { this.filter = v; this.render(); document.getElementById('ed-search').focus(); },

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
        <div class="fg"><label>Publicação</label><input type="date" class="input" id="f-dpub" value="${esc(e.DataPublicacao || '')}"></div>
        <div class="fg"><label>Inscrições — início</label><input type="date" class="input" id="f-ini" value="${esc(e.InscricoesInicio || '')}"></div>
        <div class="fg"><label>Inscrições — fim</label><input type="date" class="input" id="f-fim" value="${esc(e.InscricoesFim || '')}"></div>
      </div>
      <div class="fg"><label>Resultado</label><input type="date" class="input" id="f-resu" value="${esc(e.DataResultado || '')}"></div>
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
    const uploader = w ? `
      <div class="upload-box">
        <div class="fg"><label>Nome do documento</label>
          <input class="input" id="doc-nome" placeholder="ex.: Edital 12-2026 — Chamada de bolsistas"></div>
        <div class="form-grid">
          <div class="fg"><label>Tipo</label><select class="input" id="doc-tipo">${optionsHtml(TIPOS_DOC)}</select></div>
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
    const file = fileEl.files[0];
    if (!file) { toast('Selecione um arquivo PDF.', 'error'); return; }
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
