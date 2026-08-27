// ============================================================
// SGA — Módulo Certificados (frontend)
// 2 abas: Equipe da ação · Público-alvo. Upload de PDF vinculado a
// edital + ação; CPF automático (equipe) ou digitado (público).
// ============================================================
const Certificados = {
  container: null,
  role: null,
  certs: [], editais: [], acoes: [],
  tab: 'equipe',          // 'equipe' | 'publico'
  filter: '',
  _buscaRaw: '',          // texto digitado (sem lowercase) p/ o input não perder o que foi digitado
  _cpfSel: '',            // CPF completo da pessoa selecionada no formulário
  pessoas: [],            // equipe da ação selecionada (no formulário)

  async mount(container, role) {
    this.container = container;
    this.role = role;
    this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try {
      const [ce, ed, ac] = await Promise.all([API.getCertificados(), API.getEditais(), API.getAcoes()]);
      this.certs = ce || []; this.editais = ed || []; this.acoes = ac || [];
    } catch (e) {
      this.container.innerHTML = emptyState('Erro ao carregar: ' + (e && e.message ? e.message : e));
      return;
    }
    this.render();
  },

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },
  _reqId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  editalLabel(e) { return `${e.Numero || ''}/${e.Ano || ''} — ${e.Titulo || ''}`.trim(); },
  // Só atualiza a LISTA (não recria o input de busca → não perde o foco a cada tecla).
  onSearch(v) { this._buscaRaw = String(v || ''); this.filter = this._buscaRaw.toLowerCase(); this._renderList(); },
  switchTab(t) { if (this.tab === t) return; this.tab = t; this.filter = ''; this._buscaRaw = ''; this.render(); },
  _acoesDoEdital(editalId) { return this.acoes.filter(a => String(a.EditalID) === String(editalId)); },

  _maskCpf(cpf) { const d = String(cpf || '').replace(/\D/g, ''); return d ? ('•••.•••.•••-' + (d.length >= 2 ? d.slice(-2) : d)) : ''; },
  verCpf(btn) {
    const span = btn.parentNode.querySelector('.cpf-cell');
    if (!span) return;
    const full = span.getAttribute('data-cpf');
    if (span.dataset.on === '1') { span.textContent = this._maskCpf(full); span.dataset.on = '0'; btn.textContent = '👁'; }
    else { span.textContent = maskCPF(full); span.dataset.on = '1'; btn.textContent = '🙈'; }
  },

  render() {
    const isEq = this.tab === 'equipe';
    const w = this.canWrite();
    this.container.innerHTML = `
      <div class="ftabs">
        <button type="button" class="ftab ${isEq ? 'active' : ''}" onclick="Certificados.switchTab('equipe')">👥 Equipe da ação</button>
        <button type="button" class="ftab ${!isEq ? 'active' : ''}" onclick="Certificados.switchTab('publico')">🎯 Público-alvo</button>
      </div>
      <div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Certificados.openForm()">+ Registrar certificado</button>` : ''}</div>
      <div class="page-toolbar"><input class="input search" id="cert-busca" placeholder="Buscar por nome, CPF ou ação…" value="${esc(this._buscaRaw || '')}" oninput="Certificados.onSearch(this.value)"></div>
      <div class="toolbar-count" id="cert-count"></div>
      <div id="cert-list"></div>`;
    this._renderList();
  },

  _renderList() {
    const isEq = this.tab === 'equipe';
    const w = this.canWrite();
    const list = this.certs.filter(c => c.Categoria === (isEq ? 'Equipe' : 'Público'));
    const f = this.filter;
    const rows = !f ? list : list.filter(c =>
      String(c.NomeCivil || '').toLowerCase().includes(f) ||
      String(c.NomeSocial || '').toLowerCase().includes(f) ||
      String(c.CPF || '').includes(f.replace(/\D/g, '')) ||
      String(c.acaoTitulo || '').toLowerCase().includes(f));

    const body = rows.map(c => `<tr>
      <td class="cell-sub">${esc(c.NomeDocumento || '')}</td>
      <td><strong>${esc(c.NomeSocial || c.NomeCivil || '—')}</strong>${c.NomeSocial && c.NomeSocial !== c.NomeCivil ? `<div class="cell-sub">civil: ${esc(c.NomeCivil)}</div>` : ''}</td>
      <td>${c.CPF ? `<span class="cpf-cell" data-cpf="${esc(String(c.CPF))}">${esc(this._maskCpf(c.CPF))}</span> <button type="button" class="btn btn-ghost btn-xs" onclick="Certificados.verCpf(this)">👁</button>` : '—'}</td>
      ${isEq ? `<td>${esc(c.Papel || '—')}</td>` : ''}
      <td class="cell-sub">${esc(c.editalLabel || '—')}</td>
      <td>${esc(c.acaoTitulo || '—')}</td>
      <td><a href="${esc(c.ArquivoUrl)}" target="_blank" rel="noopener">abrir</a></td>
      ${w ? `<td class="col-actions"><button class="btn btn-danger btn-xs" onclick="Certificados.remove('${c.ID}')">🗑</button></td>` : ''}
    </tr>`).join('');
    const head = `<tr><th>Documento</th><th>Nome</th><th>CPF</th>${isEq ? '<th>Papel</th>' : ''}<th>Edital</th><th>Ação</th><th>Arquivo</th>${w ? '<th class="col-actions"></th>' : ''}</tr>`;
    const table = rows.length ? `<div class="table-wrap"><table class="data-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>` : emptyState('Nenhum certificado registrado nesta aba.');
    const cnt = document.getElementById('cert-count'); if (cnt) cnt.textContent = `${rows.length} de ${list.length} certificado(s)`;
    const box = document.getElementById('cert-list'); if (box) box.innerHTML = table;
  },

  openForm() {
    if (!this.canWrite()) return;
    const isEq = this.tab === 'equipe';
    const editalOpts = ['<option value="">— Selecione —</option>'].concat(this.editais.map(e => `<option value="${esc(e.ID)}">${esc(this.editalLabel(e))}</option>`)).join('');
    const body = `
      <div class="form-grid">
        <div class="fg"><label>Edital *</label><select class="input" id="ce-edital" onchange="Certificados.onEdital()">${editalOpts}</select></div>
        <div class="fg"><label>Ação *</label><select class="input" id="ce-acao" onchange="Certificados.onAcao()"><option value="">— Selecione o edital —</option></select></div>
      </div>
      ${isEq ? `
      <div class="fg"><label>Nome (equipe da ação) *</label><select class="input" id="ce-pessoa" onchange="Certificados.onPessoa()"><option value="">— Selecione a ação —</option></select></div>
      <div class="form-grid">
        <div class="fg"><label>CPF</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input class="input" id="ce-cpf" disabled style="flex:1">
            <button type="button" class="btn btn-ghost btn-xs" id="ce-cpf-ver" data-on="0" onclick="Certificados.revealCpfForm()">👁 Ver</button>
          </div></div>
        <div class="fg"><label>Papel</label><input class="input" id="ce-papel" disabled></div>
      </div>` : `
      <div class="fg"><label>Nome completo *</label><input class="input" id="ce-nome"></div>
      <div class="fg"><label>CPF *</label><input class="input" id="ce-cpf" inputmode="numeric" placeholder="000.000.000-00" oninput="this.value=maskCPF(this.value)"></div>`}
      <div class="fg"><label>Nome do documento</label><input class="input" disabled value="(ID gerado automaticamente ao salvar)"></div>
      <div class="fg"><label>Arquivo PDF *</label><input type="file" accept="application/pdf,.pdf" class="input" id="ce-file"></div>`;
    openModal('Registrar certificado — ' + (isEq ? 'Equipe' : 'Público-alvo'), body,
      async () => { await this.save(); }, { confirmLabel: 'Registrar' });
  },

  onEdital() {
    const opts = ['<option value="">— Selecione —</option>'].concat(this._acoesDoEdital(val('ce-edital')).map(a => `<option value="${esc(a.ID)}">${esc(a.Titulo)}</option>`)).join('');
    const sel = document.getElementById('ce-acao'); if (sel) sel.innerHTML = opts;
    const ps = document.getElementById('ce-pessoa'); if (ps) ps.innerHTML = '<option value="">— Selecione a ação —</option>';
    this.onPessoa();
  },

  async onAcao() {
    if (this.tab !== 'equipe') return;
    const aid = val('ce-acao');
    const ps = document.getElementById('ce-pessoa');
    if (!ps) return;
    if (!aid) { ps.innerHTML = '<option value="">— Selecione a ação —</option>'; this.pessoas = []; this.onPessoa(); return; }
    ps.innerHTML = '<option value="">Carregando…</option>';
    try { this.pessoas = await API.getPessoasDaAcao(aid) || []; }
    catch (e) { toast(e.message, 'error'); this.pessoas = []; }
    ps.innerHTML = ['<option value="">— Selecione —</option>'].concat(this.pessoas.map((p, i) =>
      `<option value="${i}">${esc(p.nomeSocial || p.nomeCivil)}${p.nomeSocial && p.nomeSocial !== p.nomeCivil ? ' (' + esc(p.nomeCivil) + ')' : ''} — ${esc(p.papel)}</option>`)).join('');
    this.onPessoa();
  },

  onPessoa() {
    const i = val('ce-pessoa');
    const p = (i !== '' && this.pessoas[Number(i)]) ? this.pessoas[Number(i)] : null;
    this._cpfSel = p ? String(p.cpf || '') : '';
    const cpf = document.getElementById('ce-cpf'); const pap = document.getElementById('ce-papel');
    const btn = document.getElementById('ce-cpf-ver');
    if (cpf) cpf.value = p ? this._maskCpf(this._cpfSel) : '';
    if (pap) pap.value = p ? p.papel : '';
    if (btn) { btn.dataset.on = '0'; btn.textContent = '👁 Ver'; }
  },

  revealCpfForm() {
    const cpf = document.getElementById('ce-cpf'); const btn = document.getElementById('ce-cpf-ver');
    if (!cpf || !btn) return;
    if (btn.dataset.on === '1') { cpf.value = this._maskCpf(this._cpfSel); btn.dataset.on = '0'; btn.textContent = '👁 Ver'; }
    else { cpf.value = maskCPF(this._cpfSel); btn.dataset.on = '1'; btn.textContent = '🙈 Ocultar'; }
  },

  async save() {
    const isEq = this.tab === 'equipe';
    const fileEl = document.getElementById('ce-file');
    const file = fileEl && fileEl.files[0];
    if (!val('ce-edital')) { toast('Selecione o edital.', 'error'); return; }
    if (!val('ce-acao')) { toast('Selecione a ação.', 'error'); return; }
    if (!file) { toast('Selecione o arquivo PDF.', 'error'); return; }
    if (!/\.pdf$/i.test(file.name)) { toast('O arquivo precisa ser PDF.', 'error'); return; }

    const p = { categoria: isEq ? 'Equipe' : 'Público', editalId: val('ce-edital'), acaoId: val('ce-acao') };
    if (isEq) {
      const i = val('ce-pessoa');
      if (i === '' || !this.pessoas[Number(i)]) { toast('Selecione a pessoa.', 'error'); return; }
      const pe = this.pessoas[Number(i)];
      p.nomeCivil = pe.nomeCivil; p.nomeSocial = pe.nomeSocial; p.cpf = pe.cpf;
      p.papel = pe.papel; p.pessoaTipo = pe.tipo; p.pessoaId = pe.id;
    } else {
      p.nomeCivil = val('ce-nome'); p.cpf = val('ce-cpf');
      if (!p.nomeCivil) { toast('Informe o nome completo.', 'error'); return; }
      if (!p.cpf) { toast('Informe o CPF.', 'error'); return; }
    }
    setBusy(true);
    try {
      p.base64 = await fileToBase64(file);
      p.fileName = file.name;
      const r = await API.addCertificado(p, this._reqId());
      toast('Certificado registrado' + (r && r.nomeDocumento ? ' (' + r.nomeDocumento + ')' : '') + '.', 'success');
      closeModal();
      this.certs = await API.getCertificados() || [];
      this.render();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  remove(id) {
    if (!window.confirm('Excluir este certificado? O arquivo vai para a lixeira do Drive.')) return;
    (async () => {
      try { await API.deleteCertificado(id); toast('Certificado excluído.', 'success'); this.certs = await API.getCertificados() || []; this.render(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  }
};

// app.js chama window['Certificados'].mount e os onclick inline usam Certificados.*
window.Certificados = Certificados;
