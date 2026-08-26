// ============================================================
// SGA — Módulo Ações (frontend)
// FATIA A: aba Dados (lista + formulário). Documentos/Bolsistas/Voluntários/
// Financeiro vêm nas fatias B/C/D. Layout herdado de Editais.
// ============================================================
const Acoes = {
  container: null,
  role: null,
  acoes: [], editais: [], servidores: [], alunos: [],
  filter: '',

  async mount(container, role) {
    this.container = container;
    this.role = role;
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
  onSearch(v) { this.filter = String(v || '').toLowerCase(); this.render(); },

  editalLabel(e) { return `${e.Numero || ''}/${e.Ano || ''} — ${e.Titulo || ''}`.trim(); },
  _br(iso) { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p[2] ? `${p[2]}/${p[1]}/${p[0]}` : iso; },
  _periodo(a) {
    if (!a.DataInicio && !a.DataFim) return '—';
    return (this._br(a.DataInicio) || '?') + ' a ' + (this._br(a.DataFim) || '?');
  },
  badge(s) {
    const cls = s === 'Ativa' ? 'badge-ok' : 'badge-muted';
    return `<span class="badge ${cls}">${esc(s || '—')}</span>`;
  },

  render() {
    const w = this.canWrite();
    const f = this.filter;
    const rows = !f ? this.acoes : this.acoes.filter(a =>
      String(a.Titulo || '').toLowerCase().includes(f) ||
      String(a.coordenadorNome || '').toLowerCase().includes(f) ||
      String(a.editalLabel || '').toLowerCase().includes(f));

    const acoesMenu = (id) => w ? `<td class="col-actions">
      <details class="row-menu">
        <summary class="btn btn-ghost btn-xs">Ações ▾</summary>
        <div class="row-menu-list">
          <button onclick="Acoes.openForm('${id}')">✏️ Editar</button>
          <button class="danger" onclick="Acoes.remove('${id}')">🗑 Excluir</button>
        </div>
      </details></td>` : '';

    const body = rows.map(a => `<tr>
      <td><strong>${esc(a.Titulo)}</strong></td>
      <td>${esc(a.TipoAcao || '—')}</td>
      <td>${esc(a.coordenadorNome || '—')}</td>
      <td>${esc(a.Segmento || '—')}</td>
      <td class="cell-sub">${esc(a.editalLabel || '—')}</td>
      <td>${esc(this._periodo(a))}</td>
      <td>${this.badge(a.Status)}</td>${acoesMenu(a.ID)}
    </tr>`).join('');

    const table = rows.length ? `
      <div class="table-wrap menus">
        <table class="data-table">
          <thead><tr><th>Título</th><th>Tipo</th><th>Coordenador</th><th>Segmento</th><th>Edital</th><th>Período</th><th>Status</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
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

  // Ao escolher o edital, sugere o segmento dele (editável).
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
      this.render();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  remove(id) {
    if (!this.canWrite()) return;
    const a = this.acoes.find(x => String(x.ID) === String(id));
    confirmDialog('Excluir ação', `Excluir a ação "${a ? a.Titulo : ''}"? A pasta no Drive vai para a lixeira.`,
      async () => {
        try { await API.deleteAcao(id); toast('Ação excluída.', 'success'); this.acoes = await API.getAcoes() || []; this.render(); }
        catch (e) { toast(e.message, 'error'); }
      }, 'Excluir');
  }
};

// app.js chama window['Acoes'].mount e os onclick inline usam Acoes.*
window.Acoes = Acoes;
