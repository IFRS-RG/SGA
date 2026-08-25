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
    const f = this.filter;

    const rows = !f ? data : data.filter(r =>
      String(r.Nome || '').toLowerCase().includes(f) ||
      String((isServ ? r.SIAPE : r.Matricula) || '').toLowerCase().includes(f) ||
      String(r.Email || '').toLowerCase().includes(f));

    const head = isServ
      ? `<tr><th>Nome</th><th>SIAPE</th><th>Vínculo</th><th>E-mail</th><th>Telefone</th><th>Status</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr>`
      : `<tr><th>Nome</th><th>Matrícula</th><th>Curso</th><th>E-mail</th><th>Telefone</th><th>Status</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr>`;

    const acoes = (id) => w ? `<td class="col-actions">
      <button class="btn btn-ghost btn-xs" onclick="Participantes.openForm('${id}')">✏️ Editar</button>
      <button class="btn btn-danger btn-xs" onclick="Participantes.remove('${id}')">🗑</button></td>` : '';

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
          <input class="input" id="pf-telefone" value="${esc(rec ? rec.telefone : '')}" placeholder="(00) 00000-0000"></div>
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
  }
};

// app.js chama window['Participantes'].mount e os onclick inline usam Participantes.*
window.Participantes = Participantes;
