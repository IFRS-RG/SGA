// ============================================================
// SGA — Módulo Participantes (frontend)
// FATIA 1: navegação + listagem minimizada. FATIA 2: cadastro/edição de
// identidade (nome social, vínculo múltiplo, WhatsApp; idade dinâmica no aluno).
// CPF/banco (com camadas de acesso) vêm na F3. Layout herdado de Editais.
// ============================================================
const Participantes = {
  container: null,
  role: null,
  tab: 'servidores',
  servidores: [],
  alunos: [],
  cursos: [],
  filter: '',

  async mount(container, role) {
    this.container = container;
    this.role = role;
    this.renderShell();
    try { this.cursos = await API.getCursos() || []; } catch (e) { this.cursos = []; }
    await this.reloadTab();
  },

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },
  canFin() { return ['Admin', 'Gestor', 'Financeiro'].indexOf(this.role) >= 0; },
  _tipo() { return this.tab === 'servidores' ? 'servidor' : 'aluno'; },
  _reqId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },

  cursoNome(id) {
    const c = this.cursos.find(x => String(x.ID) === String(id));
    return c ? c.Nome : (id ? '—' : '—');
  },

  renderShell() {
    this.container.innerHTML = `
      <div class="ftabs">
        <button type="button" class="ftab ${this.tab === 'servidores' ? 'active' : ''}" onclick="Participantes.switchTab('servidores')">👤 Servidores</button>
        <button type="button" class="ftab ${this.tab === 'alunos' ? 'active' : ''}" onclick="Participantes.switchTab('alunos')">🎓 Alunos</button>
      </div>
      <div id="part-panel"><div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div></div>`;
  },

  switchTab(t) {
    if (this.tab === t) return;
    this.tab = t;
    this.filter = '';
    this.renderShell();
    this.reloadTab();
  },

  async reloadTab() {
    const panel = document.getElementById('part-panel');
    try {
      if (this.tab === 'servidores') this.servidores = await API.getServidores() || [];
      else this.alunos = await API.getAlunos() || [];
      this.renderList();
    } catch (e) {
      if (panel) panel.innerHTML = emptyState('Erro ao carregar: ' + (e && e.message ? e.message : e));
    }
  },

  onSearch(v) { this.filter = String(v || '').toLowerCase(); this.renderList(); },

  renderList() {
    const panel = document.getElementById('part-panel');
    if (!panel) return;
    const isServ = this.tab === 'servidores';
    const data = isServ ? this.servidores : this.alunos;
    const w = this.canWrite();
    const fin = this.canFin();
    const hasActions = w || fin;
    const f = this.filter;

    const rows = !f ? data : data.filter(r =>
      String(r.Nome || '').toLowerCase().includes(f) ||
      String((isServ ? r.SIAPE : r.Matricula) || '').toLowerCase().includes(f) ||
      String(r.Email || '').toLowerCase().includes(f));

    const actTh = hasActions ? '<th class="col-actions">Ações</th>' : '';
    const head = isServ
      ? `<tr><th>Nome</th><th>SIAPE</th><th>Vínculo</th><th>E-mail</th><th>Telefone</th><th>Status</th>${actTh}</tr>`
      : `<tr><th>Nome</th><th>Matrícula</th><th>Curso</th><th>E-mail</th><th>Telefone</th><th>Status</th>${actTh}</tr>`;

    const acoes = (id) => hasActions ? `<td class="col-actions">
      <details class="row-menu">
        <summary class="btn btn-ghost btn-xs">Ações ▾</summary>
        <div class="row-menu-list">
          ${fin ? `<button onclick="Participantes.openFinanceiro('${id}')">💳 Financeiro</button>` : ''}
          ${w ? `<button onclick="Participantes.openForm('${id}')">✏️ Editar</button>` : ''}
          ${w ? `<button class="danger" onclick="Participantes.remove('${id}')">🗑 Excluir</button>` : ''}
        </div>
      </details>
    </td>` : '';

    const body = rows.map(r => {
      const tel = r.Telefone ? esc(r.Telefone) + (r.WhatsApp ? ' <span class="link-chip">WhatsApp</span>' : '') : '—';
      return isServ
        ? `<tr>
            <td><strong>${esc(r.Nome)}</strong></td>
            <td>${esc(r.SIAPE || '—')}</td>
            <td>${esc((r.vinculo || []).join(', ') || '—')}</td>
            <td class="cell-sub">${esc(r.Email || '—')}</td>
            <td>${tel}</td>
            <td>${this.badge(r.Status)}</td>${acoes(r.ID)}
          </tr>`
        : `<tr>
            <td><strong>${esc(r.Nome)}</strong></td>
            <td>${esc(r.Matricula || '—')}</td>
            <td>${esc(this.cursoNome(r.CursoID))}</td>
            <td class="cell-sub">${esc(r.Email || '—')}</td>
            <td>${tel}</td>
            <td>${this.badge(r.Status)}</td>${acoes(r.ID)}
          </tr>`;
    }).join('');

    const table = rows.length ? `
      <div class="table-wrap">
        <table class="data-table"><thead>${head}</thead><tbody>${body}</tbody></table>
      </div>`
      : emptyState(data.length
          ? 'Nenhum registro corresponde à busca.'
          : `Nenhum ${isServ ? 'servidor' : 'aluno'} cadastrado ainda.`,
          (w && !data.length) ? `<button class="btn btn-primary" onclick="Participantes.openForm()">+ Cadastrar ${isServ ? 'servidor' : 'aluno'}</button>` : '');

    panel.innerHTML = `
      <div class="page-actions">
        ${w ? `<button class="btn btn-primary" onclick="Participantes.openForm()">+ Novo ${isServ ? 'servidor' : 'aluno'}</button>` : ''}
      </div>
      <div class="page-toolbar">
        <input class="input search" placeholder="Buscar por nome, ${isServ ? 'SIAPE' : 'matrícula'} ou e-mail…"
               value="${esc(this.filter)}" oninput="Participantes.onSearch(this.value)">
      </div>
      <div class="toolbar-count">${rows.length} de ${data.length} ${isServ ? 'servidor(es)' : 'aluno(s)'}</div>
      ${table}`;
  },

  badge(s) {
    return String(s) === 'Ativo'
      ? '<span class="badge badge-ok">Ativo</span>'
      : '<span class="badge badge-muted">' + esc(s || 'Inativo') + '</span>';
  },

  // ── Formulário (add/edit) ───────────────────────────────────
  async openForm(id) {
    if (!this.canWrite()) return;
    const isServ = this.tab === 'servidores';
    let rec = null;
    if (id) {
      try { rec = isServ ? await API.getServidor(id) : await API.getAluno(id); }
      catch (e) { toast(e.message, 'error'); return; }
    }
    const body = isServ ? this.servForm(rec) : this.alunoForm(rec);
    const titulo = (id ? 'Editar ' : 'Novo ') + (isServ ? 'servidor' : 'aluno');
    openModal(titulo, body, async () => { await this.save(id, isServ); },
      { confirmLabel: id ? 'Salvar' : 'Adicionar' });
    if (!isServ) setTimeout(() => this.updateIdade(), 60);
  },

  _nomeSocialBlock(rec) {
    const chk = rec && rec.usarNomeSocialDocs ? 'checked' : '';
    return `
      <div class="fg"><label>Nome social</label>
        <input class="input" id="pf-nomesocial" value="${esc(rec ? rec.nomeSocial : '')}"></div>
      <label class="chk-item" style="margin:2px 0 4px">
        <input type="checkbox" id="pf-usanomesocial" ${chk}>
        <span>Usar nome social em documentos internos (exceto financeiro/pagamentos)</span></label>`;
  },

  _contatoBlock(rec) {
    const wa = rec && rec.whatsapp ? 'checked' : '';
    return `
      <div class="form-grid">
        <div class="fg"><label>Telefone</label>
          <input class="input" id="pf-telefone" value="${esc(maskTelefone(rec ? rec.telefone : ''))}" placeholder="(00) 00000-0000"
                 inputmode="numeric" oninput="this.value=maskTelefone(this.value)"></div>
        <div class="fg"><label>Status</label>
          <select class="input" id="pf-status">${optionsHtml(STATUS_PARTICIPANTE, rec ? rec.status : 'Ativo')}</select></div>
      </div>
      <label class="chk-item" style="margin:2px 0"><input type="checkbox" id="pf-whatsapp" ${wa}><span>Este telefone tem WhatsApp</span></label>`;
  },

  servForm(rec) {
    const vin = (rec && rec.vinculo) || [];
    const vinItems = VINCULOS_SERVIDOR.map(v =>
      `<label class="chk-item"><input type="checkbox" class="pf-vinculo" value="${esc(v)}" ${vin.indexOf(v) >= 0 ? 'checked' : ''}><span>${esc(v)}</span></label>`
    ).join('');
    return `
      <div class="fg"><label>Nome civil *</label>
        <input class="input" id="pf-nome" value="${esc(rec ? rec.nome : '')}"></div>
      ${this._nomeSocialBlock(rec)}
      <div class="form-grid">
        <div class="fg"><label>SIAPE</label>
          <input class="input" id="pf-siape" value="${esc(rec ? rec.siape : '')}" inputmode="numeric"></div>
        <div class="fg"><label>E-mail *</label>
          <input class="input" id="pf-email" value="${esc(rec ? rec.email : '')}" placeholder="usuario@riogrande.ifrs.edu.br"></div>
      </div>
      <div class="fg"><label>Vínculo <span class="field-hint" style="display:inline">(pode marcar mais de um)</span></label>
        <div class="chk-list">${vinItems}</div></div>
      ${this._contatoBlock(rec)}`;
  },

  alunoForm(rec) {
    const cursoOpts = ['<option value="">— Selecione —</option>'].concat(
      this.cursos.map(c => `<option value="${esc(c.ID)}" ${rec && String(rec.cursoId) === String(c.ID) ? 'selected' : ''}>${esc(c.Nome)}${c.Modalidade ? ' — ' + esc(c.Modalidade) : ''}</option>`)
    ).join('');
    return `
      <div class="fg"><label>Nome civil *</label>
        <input class="input" id="pf-nome" value="${esc(rec ? rec.nome : '')}"></div>
      ${this._nomeSocialBlock(rec)}
      <div class="form-grid">
        <div class="fg"><label>Matrícula *</label>
          <input class="input" id="pf-matricula" value="${esc(rec ? rec.matricula : '')}"></div>
        <div class="fg"><label>Curso</label>
          <select class="input" id="pf-curso">${cursoOpts}</select></div>
      </div>
      <div class="form-grid">
        <div class="fg"><label>Data de nascimento</label>
          <input class="input" type="date" id="pf-datanasc" value="${esc(rec ? rec.dataNascimento : '')}" oninput="Participantes.updateIdade()"></div>
        <div class="fg"><label>Idade</label>
          <input class="input" id="pf-idade" disabled value=""></div>
      </div>
      <div class="fg"><label>E-mail</label>
        <input class="input" id="pf-email" value="${esc(rec ? rec.email : '')}" placeholder="usuario@aluno.riogrande.ifrs.edu.br"></div>
      ${this._contatoBlock(rec)}`;
  },

  // Idade dinâmica (só exibição no form; o cálculo oficial é no backend na F4).
  updateIdade() {
    const d = val('pf-datanasc');
    const out = document.getElementById('pf-idade');
    if (!out) return;
    const a = this.idadeDe(d);
    out.value = a == null ? '' : (a + ' anos');
  },

  idadeDe(dataIso) {
    if (!dataIso) return null;
    const d = new Date(dataIso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const hoje = new Date();
    let a = hoje.getFullYear() - d.getFullYear();
    const m = hoje.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) a--;
    return a < 0 || a > 130 ? null : a;
  },

  _harvest(isServ) {
    const p = {
      nome: val('pf-nome'),
      nomeSocial: val('pf-nomesocial'),
      usarNomeSocialDocs: !!(document.getElementById('pf-usanomesocial') || {}).checked,
      email: val('pf-email'),
      telefone: val('pf-telefone'),
      whatsapp: !!(document.getElementById('pf-whatsapp') || {}).checked,
      status: val('pf-status')
    };
    if (isServ) {
      p.siape = val('pf-siape');
      p.vinculo = Array.from(document.querySelectorAll('.pf-vinculo:checked')).map(el => el.value);
    } else {
      p.matricula = val('pf-matricula');
      p.cursoId = val('pf-curso');
      p.dataNascimento = val('pf-datanasc');
    }
    return p;
  },

  async save(id, isServ) {
    const p = this._harvest(isServ);
    setBusy(true);
    try {
      if (isServ) {
        if (id) await API.updateServidor(id, p);
        else await API.addServidor(p, this._reqId());
      } else {
        if (id) await API.updateAluno(id, p);
        else await API.addAluno(p, this._reqId());
      }
      toast(id ? 'Registro atualizado.' : 'Registro adicionado.', 'success');
      closeModal();
      await this.reloadTab();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  },

  remove(id) {
    if (!this.canWrite()) return;
    const isServ = this.tab === 'servidores';
    confirmDialog('Excluir ' + (isServ ? 'servidor' : 'aluno'),
      'Esta ação é permanente. Se a intenção é apenas desativar, use o status Inativo. Excluir mesmo assim?',
      async () => {
        try {
          if (isServ) await API.deleteServidor(id); else await API.deleteAluno(id);
          toast('Registro excluído.', 'success');
          await this.reloadTab();
        } catch (e) { toast(e.message, 'error'); }
      }, 'Excluir');
  },

  // ── Financeiro (CPF / banco / PIX — camadas de acesso + auditoria) ──
  _nomeDe(id) {
    const d = this.tab === 'servidores' ? this.servidores : this.alunos;
    const r = d.find(x => String(x.ID) === String(id));
    return r ? r.Nome : '';
  },

  _fmtCpf(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d;
  },

  async openFinanceiro(id) {
    if (!this.canFin()) return;
    const tipo = this._tipo();
    let fin;
    try { fin = await API.getFinanceiro(tipo, id); }
    catch (e) { toast(e.message, 'error'); return; }
    this._finCache = { tipo, id, fin };
    openModal('Financeiro — ' + this._nomeDe(id), this._finView(fin),
      fin.canWrite ? async () => { await this.openFinanceiroForm(id); } : null,
      { confirmLabel: 'Editar dados', hideConfirm: !fin.canWrite, cancelLabel: 'Fechar' });
  },

  _finView(fin) {
    if (!fin.temRegistro) {
      return `<p class="section-sub">Nenhum dado financeiro cadastrado para este participante.</p>`;
    }
    let html = '<div class="detail-grid">';
    html += `<div><span class="dk">CPF</span><span class="dv" id="finv-cpf">${fin.temCpf ? esc(fin.cpf) : '—'}</span></div>`;
    if (fin.canBank) {
      html += `<div><span class="dk">Banco</span><span class="dv">${esc(fin.banco || '—')}${fin.bancoCodigo ? ' (' + esc(fin.bancoCodigo) + ')' : ''}</span></div>`;
      html += `<div><span class="dk">Agência</span><span class="dv">${esc(fin.agencia || '—')}</span></div>`;
      html += `<div><span class="dk">Tipo de conta</span><span class="dv">${esc(fin.tipoConta || '—')}</span></div>`;
      html += `<div><span class="dk">Nº da conta</span><span class="dv" id="finv-conta">${fin.temConta ? esc(fin.numeroConta) : '—'}</span></div>`;
      html += `<div><span class="dk">Tipo de chave PIX</span><span class="dv">${esc(fin.pixTipo || '—')}</span></div>`;
      html += `<div><span class="dk">Chave PIX</span><span class="dv" id="finv-pix">${fin.temPix ? esc(fin.pixChave) : '—'}</span></div>`;
    } else {
      html += `<div><span class="dk">Dados bancários</span><span class="dv">🔒 Restrito (Admin / Financeiro)</span></div>`;
    }
    html += '</div>';
    if (fin.temCpf || fin.temConta || fin.temPix) {
      html += `<button class="btn btn-ghost btn-xs" style="margin-top:10px" onclick="Participantes.revelarFin()">👁 Revelar dados sensíveis</button>`;
    }
    if (fin.atualizadoEm) {
      html += `<p class="section-sub" style="margin-top:10px">Atualizado em ${esc(fin.atualizadoEm)} por ${esc(fin.atualizadoPor || '')}.</p>`;
    }
    return html;
  },

  async revelarFin() {
    const c = this._finCache; if (!c) return;
    try {
      const full = await API.revealFinanceiro(c.tipo, c.id);
      const set = (elId, v) => { const el = document.getElementById(elId); if (el && v) el.textContent = v; };
      set('finv-cpf', full.cpf ? this._fmtCpf(full.cpf) : null);
      set('finv-conta', full.numeroConta || null);
      set('finv-pix', full.pixChave || null);
      toast('Dados revelados (acesso registrado na auditoria).', 'info');
    } catch (e) { toast(e.message, 'error'); }
  },

  async openFinanceiroForm(id) {
    const tipo = this._tipo();
    const fin = (this._finCache && this._finCache.fin) || {};
    let full = {};
    try { full = await API.revealFinanceiro(tipo, id); } catch (e) { toast(e.message, 'error'); return; }

    const nomes = BANCOS.map(b => b.nome);
    const outroSel = !!(fin.banco && nomes.indexOf(fin.banco) === -1);
    const bancoSelVal = outroSel ? 'Outro' : (fin.banco || '');
    const bancoOpts = ['<option value="">— Selecione —</option>']
      .concat(BANCOS.map(b => `<option ${bancoSelVal === b.nome ? 'selected' : ''}>${esc(b.nome)}</option>`)).join('');
    const tcOpts = ['<option value="">—</option>']
      .concat(TIPO_CONTA.map(o => `<option ${fin.tipoConta === o ? 'selected' : ''}>${esc(o)}</option>`)).join('');
    const pxOpts = ['<option value="">—</option>']
      .concat(PIX_TIPO.map(o => `<option ${fin.pixTipo === o ? 'selected' : ''}>${esc(o)}</option>`)).join('');

    const body = `
      <div class="fg"><label>CPF</label>
        <input class="input" id="fin-cpf" value="${esc(this._fmtCpf(full.cpf))}" inputmode="numeric" placeholder="000.000.000-00"></div>
      <div class="seg-head">Dados bancários</div>
      <div class="form-grid">
        <div class="fg"><label>Banco</label>
          <select class="input" id="fin-banco" onchange="Participantes.onBancoChange()">${bancoOpts}</select></div>
        <div class="fg"><label>Código</label>
          <input class="input" id="fin-bancocod" value="${esc(fin.bancoCodigo || '')}"></div>
      </div>
      <div class="fg" id="fin-banco-outro-wrap" style="display:${outroSel ? 'block' : 'none'}">
        <label>Nome do banco</label>
        <input class="input" id="fin-bancooutro" value="${esc(outroSel ? fin.banco : '')}"></div>
      <div class="form-grid">
        <div class="fg"><label>Agência</label><input class="input" id="fin-agencia" value="${esc(fin.agencia || '')}"></div>
        <div class="fg"><label>Tipo de conta</label><select class="input" id="fin-tipoconta">${tcOpts}</select></div>
      </div>
      <div class="fg"><label>Nº da conta</label><input class="input" id="fin-conta" value="${esc(full.numeroConta || '')}"></div>
      <div class="seg-head">PIX</div>
      <div class="form-grid">
        <div class="fg"><label>Tipo de chave</label><select class="input" id="fin-pixtipo">${pxOpts}</select></div>
        <div class="fg"><label>Chave PIX</label><input class="input" id="fin-pixchave" value="${esc(full.pixChave || '')}"></div>
      </div>`;
    openModal('Editar financeiro — ' + this._nomeDe(id), body,
      async () => { await this.saveFin(id); }, { confirmLabel: 'Salvar' });
    setTimeout(() => this.onBancoChange(), 50);
  },

  // Preenche o código ao escolher o banco; "Outro" libera nome e código para digitar.
  onBancoChange() {
    const sel = document.getElementById('fin-banco');
    const cod = document.getElementById('fin-bancocod');
    const wrap = document.getElementById('fin-banco-outro-wrap');
    if (!sel || !cod) return;
    if (sel.value === 'Outro') {
      if (wrap) wrap.style.display = 'block';
      cod.readOnly = false;
    } else {
      if (wrap) wrap.style.display = 'none';
      const b = BANCOS.find(x => x.nome === sel.value);
      cod.value = b ? b.codigo : '';
      cod.readOnly = !!(b && b.codigo);
    }
  },

  async saveFin(id) {
    const bancoSel = val('fin-banco');
    const p = {
      cpf: val('fin-cpf'),
      banco: bancoSel === 'Outro' ? val('fin-bancooutro') : bancoSel,
      bancoCodigo: val('fin-bancocod'),
      agencia: val('fin-agencia'),
      tipoConta: val('fin-tipoconta'),
      numeroConta: val('fin-conta'),
      pixTipo: val('fin-pixtipo'),
      pixChave: val('fin-pixchave')
    };
    setBusy(true);
    try {
      await API.saveFinanceiro(this._tipo(), id, p);
      toast('Dados financeiros salvos.', 'success');
      closeModal();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
};

// app.js chama window['Participantes'].mount e os onclick inline usam Participantes.*
window.Participantes = Participantes;
