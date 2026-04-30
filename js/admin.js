// ============================================================
// SGA — Admin Page Logic
// ============================================================

const Admin = (() => {

  // ── State ────────────────────────────────────────────────
  const state = {
    coordenadores: [], editais: [],
    acoes: [], membros: [], bolsistas: [], voluntarios: [], cursos: [],
    assiduidades: [], notificacoes: [], logs: [],
    permissoes: []
  };

  // ── Tab routing ───────────────────────────────────────────
  function init() {
    setupTabs();
    setupSubtabs('tab-cadastros', '.subtab-btn[data-subtab]', 'subtab-');
    setupSubtabs('tab-configuracoes', '#tab-configuracoes .subtab-btn[data-subtab]', 'subtab-');
    buildMesAnoSelects(['ass-mes']);
    loadAll();
  }

  function setupTabs() {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content[id^="tab-"]').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'logs')         Logs.load();
        if (btn.dataset.tab === 'assiduidade')  Assiduidade.load();
        if (btn.dataset.tab === 'todas-acoes')  TodasAcoes.load();
        if (btn.dataset.tab === 'configuracoes') Configuracoes.load();
      });
    });
  }

  function setupSubtabs(parentId, selector, prefix) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = document.getElementById(parentId) || document;
        parent.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        parent.querySelectorAll('[id^="' + prefix + '"]').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(prefix + btn.dataset.subtab).classList.add('active');
      });
    });
  }

  function buildMesAnoSelects(ids) {
    const opts = buildMesAnoOptions({ year: 2025, month: 1 }, { year: 2028, month: 12 });
    const now  = new Date();
    const cur  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
    ids.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (o.value === cur) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  }

  function _populateSelect(id, items, mapper, placeholder) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = `<option value="">${placeholder}</option>` +
      items.map(item => {
        const { value, label } = mapper(item);
        return `<option value="${esc(String(value))}">${label}</option>`;
      }).join('');
    if (current) el.value = current;
  }

  async function loadAll() {
    try {
      const [coords, editais, acoes, membros, bolsistas, vols, cursos, session] = await Promise.all([
        API.getCoordenadores(), API.getEditais(), API.getAcoes(),
        API.getMembros(), API.getBolsistas(), API.getVoluntarios(), API.getCursos(),
        Promise.resolve(loadSession())
      ]);
      state.coordenadores = coords    || [];
      state.editais       = editais   || [];
      state.acoes         = acoes     || [];
      state.membros       = membros   || [];
      state.bolsistas     = bolsistas || [];
      state.voluntarios   = vols      || [];
      state.cursos        = cursos    || [];
      state.permissoes    = session?.roleInfo?.permissions || [];

      _populateSelect('filter-acoes-coord',      state.coordenadores, c => ({ value: c.Email, label: c.Nome }), 'Coordenador');
      _populateSelect('filter-acoes-edital',     state.editais, e => ({ value: e.ID, label: `${e.Numero}/${e.Ano} — ${e.Titulo}` }), 'Edital');
      _populateSelect('filter-bolsistas-acao',   state.acoes.filter(a => a.Status === 'Ativo'), a => ({ value: a.ID, label: a.Titulo }), 'Ação');
      _populateSelect('filter-voluntarios-acao', state.acoes.filter(a => a.Status === 'Ativo'), a => ({ value: a.ID, label: a.Titulo }), 'Ação');
      _populateSelect('fa-coord', state.coordenadores, c => ({ value: c.Email, label: c.Nome }), 'Coordenador');

      Coord.render(); Editais.render(); Acoes.render();
      Membros.render(); Bolsistas.render(); Voluntarios.render(); Cursos.render();
    } catch(e) { toast('Erro ao carregar dados: ' + e.message, 'error'); }
  }

  // ── Modal helpers ─────────────────────────────────────────
  function openModal(title, bodyHtml, onSave, saveLabel) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML =
      `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancelar</button>
       <button class="btn btn-primary" id="modal-save-btn">${saveLabel || 'Salvar'}</button>`;
    document.getElementById('modal-save-btn').onclick = onSave;
    document.getElementById('modal-overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  function setBusy(busy) {
    const btn = document.getElementById('modal-save-btn');
    if (btn) { btn.disabled = busy; btn.textContent = busy ? 'Salvando...' : 'Salvar'; }
  }

  // ── COORDENADORES ─────────────────────────────────────────
  const Coord = {
    _sortDir: 'asc',
    _unmasked: new Set(),
    filtered() {
      const q  = (document.getElementById('search-coord')?.value || '').toLowerCase();
      const st = document.getElementById('filter-coord-status')?.value || '';
      const dir = this._sortDir;
      return state.coordenadores
        .filter(r => (!q || r.Nome?.toLowerCase().includes(q) || r.Email?.toLowerCase().includes(q)) && (!st || r.Status === st))
        .sort((a,b) => {
          const cmp = (a.Nome||'').localeCompare(b.Nome||'');
          return dir === 'asc' ? cmp : -cmp;
        });
    },
    render() {
      const rows = this.filtered();
      const el   = document.getElementById('table-coord');
      if (!rows.length) { showEmpty('table-coord'); return; }
      const arrow = this._sortDir === 'asc' ? ' ↑' : ' ↓';
      el.innerHTML = `<table>
        <thead><tr>
          <th onclick="Admin.Coord.toggleSort()" style="cursor:pointer;user-select:none">Nome${arrow}</th>
          <th>E-mail</th><th>CPF</th><th>Telefone</th><th>Status</th><th>Ações</th>
        </tr></thead>
        <tbody>${rows.map(r => {
          const unmasked = this._unmasked.has(r.ID);
          const cpf = unmasked ? esc(r.CPF||'') : (r.CPF ? '***.***.***-**' : '—');
          const tel = unmasked ? esc(r.Telefone||'') : (r.Telefone ? '(**) * ****-****' : '—');
          return `<tr>
            <td>${esc(r.Nome)}</td>
            <td>${esc(r.Email)}</td>
            <td>${cpf}</td>
            <td>${tel}</td>
            <td>${statusBadge(r.Status)}</td>
            <td class="td-actions">
              <button class="btn btn-ghost btn-xs" title="${unmasked?'Ocultar':'Exibir'} dados sensíveis" onclick="Admin.Coord.toggleMask('${r.ID}')">${unmasked?'🙈':'👁'}</button>
              <button class="btn btn-ghost btn-xs" onclick="Admin.Coord.openEdit('${r.ID}')">Editar</button>
              <button class="btn ${r.Status==='Ativo'?'btn-warning':'btn-success'} btn-xs" onclick="Admin.Coord.toggle('${r.ID}','${r.Status==='Ativo'?'Inativo':'Ativo'}')">
                ${r.Status==='Ativo'?'Inativar':'Ativar'}
              </button>
              <button class="btn btn-danger btn-xs" onclick="Admin.Coord.delete_('${r.ID}')">Excluir</button>
            </td>
          </tr>`;
        }).join('')}</tbody></table>`;
    },
    openAdd() {
      openModal('Adicionar Coordenador', this._form(), async () => {
        const nome  = document.getElementById('f-nome');
        const email = document.getElementById('f-email');
        if (!validateForm([{el:nome},{el:email}])) return;
        setBusy(true);
        try {
          await API.addCoordenador({ nome: nome.value.trim(), email: email.value.trim() });
          toast('Coordenador adicionado.', 'success');
          closeModal();
          state.coordenadores = await API.getCoordenadores() || [];
          _populateSelect('filter-acoes-coord', state.coordenadores, c => ({ value: c.Email, label: c.Nome }), 'Coordenador');
          _populateSelect('fa-coord', state.coordenadores, c => ({ value: c.Email, label: c.Nome }), 'Coordenador');
          this.render();
        } catch(e) { toast(e.message,'error'); } finally { setBusy(false); }
      });
    },
    openEdit(id) {
      const r = state.coordenadores.find(x => x.ID === id);
      if (!r) return;
      openModal('Editar Coordenador', this._form(r), async () => {
        const nome  = document.getElementById('f-nome');
        const email = document.getElementById('f-email');
        if (!validateForm([{el:nome},{el:email}])) return;
        setBusy(true);
        try {
          await API.updateCoordenador({ id: r.ID, nome: nome.value.trim(), email: email.value.trim() });
          toast('Coordenador atualizado.', 'success');
          closeModal();
          state.coordenadores = await API.getCoordenadores() || [];
          this.render();
        } catch(e) { toast(e.message,'error'); } finally { setBusy(false); }
      });
    },
    async toggle(id, newStatus) {
      try {
        await API.toggleCoordenador(id, newStatus);
        state.coordenadores = await API.getCoordenadores() || [];
        this.render();
        toast(`Status alterado para ${newStatus}.`, 'success');
      } catch(e) { toast(e.message,'error'); }
    },
    async delete_(id) {
      const r = state.coordenadores.find(x => x.ID === id);
      if (!confirm(`Excluir coordenador "${r?.Nome || id}"?\nEsta ação não pode ser desfeita.`)) return;
      try {
        await API.deleteCoordenador(id);
        toast('Coordenador excluído.', 'success');
        state.coordenadores = await API.getCoordenadores() || [];
        _populateSelect('filter-acoes-coord', state.coordenadores, c => ({ value: c.Email, label: c.Nome }), 'Coordenador');
        _populateSelect('fa-coord', state.coordenadores, c => ({ value: c.Email, label: c.Nome }), 'Coordenador');
        this.render();
      } catch(e) { toast(e.message,'error'); }
    },
    toggleSort() {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
      this.render();
    },
    toggleMask(id) {
      if (this._unmasked.has(id)) this._unmasked.delete(id);
      else this._unmasked.add(id);
      this.render();
    },
    _form(r) {
      return `<div class="form-group"><label class="form-label">*Nome completo</label>
        <input class="form-control" id="f-nome" value="${esc(r?.Nome||'')}"></div>
        <div class="form-group"><label class="form-label">*E-mail institucional</label>
        <input class="form-control" id="f-email" type="email" value="${esc(r?.Email||'')}"></div>`;
    },
    exportXLS() { exportXLS(['Nome','E-mail','Status'], this.filtered().map(r=>[r.Nome,r.Email,r.Status]), 'Coordenadores'); },
    exportPDF() { exportPDF('Coordenadores', ['Nome','E-mail','Status'], this.filtered().map(r=>[r.Nome,r.Email,r.Status])); }
  };

  // ── EDITAIS ───────────────────────────────────────────────
  const Editais = {
    filtered() {
      const q  = (document.getElementById('search-editais')?.value||'').toLowerCase();
      const st = document.getElementById('filter-editais-status')?.value||'';
      const sg = document.getElementById('filter-editais-seg')?.value||'';
      return state.editais.filter(r =>
        (!q || r.Titulo?.toLowerCase().includes(q) || String(r.Numero).includes(q)) &&
        (!st || r.Status===st) && (!sg || r.Segmento===sg)
      ).sort((a,b)=>(a.Titulo||'').localeCompare(b.Titulo||''));
    },
    render() {
      const rows = this.filtered();
      const el   = document.getElementById('table-editais');
      if (!rows.length) { showEmpty('table-editais'); return; }
      el.innerHTML = `<table><thead><tr>
        <th>Número</th><th>Ano</th><th>Título</th><th>Fomento</th><th>Interno/Externo</th>
        <th>Segmento</th><th>Bolsas</th><th>Custeio/Capital</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${esc(r.Numero)}</td><td>${esc(r.Ano)}</td><td>${esc(r.Titulo)}</td>
        <td>${esc(r.Fomento)}</td><td>${esc(r.TipoInterno)}</td><td>${esc(r.Segmento)}</td>
        <td>${esc(r.Bolsas||'Não')}</td><td>${esc(r.CusteioCapital||'Não')}</td>
        <td>${statusBadge(r.Status)}</td>
        <td class="td-actions">
          <button class="btn btn-ghost btn-xs" onclick="Admin.Editais.openEdit('${r.ID}')">Editar</button>
          <button class="btn ${r.Status==='Ativo'?'btn-warning':'btn-success'} btn-xs" onclick="Admin.Editais.toggle('${r.ID}','${r.Status==='Ativo'?'Inativo':'Ativo'}')">
            ${r.Status==='Ativo'?'Inativar':'Ativar'}</button>
          <button class="btn btn-danger btn-xs" onclick="Admin.Editais.delete_('${r.ID}')">Excluir</button>
        </td></tr>`).join('')}</tbody></table>`;
    },
    openAdd() { openModal('Adicionar Edital', this._form(), async()=>{ await this._save(); }); },
    openEdit(id) {
      const r = state.editais.find(x=>x.ID===id);
      openModal('Editar Edital', this._form(r), async()=>{ await this._save(id); });
    },
    async _save(id) {
      const p = {
        numero: document.getElementById('f-numero')?.value,
        ano:    document.getElementById('f-ano')?.value,
        titulo: document.getElementById('f-titulo')?.value,
        fomento: document.getElementById('f-fomento')?.value,
        tipoInterno: document.getElementById('f-tipo')?.value,
        segmento: document.getElementById('f-seg')?.value,
        bolsas: document.getElementById('f-bolsas')?.value,
        custeioCapital: document.getElementById('f-custeio')?.value
      };
      if (!validateForm([{el:document.getElementById('f-numero')},{el:document.getElementById('f-titulo')}])) return;
      setBusy(true);
      try {
        id ? await API.updateEdital(id, p) : await API.addEdital(p);
        toast(id?'Edital atualizado.':'Edital adicionado.','success');
        closeModal();
        state.editais = await API.getEditais()||[];
        _populateSelect('filter-acoes-edital', state.editais, e => ({ value: e.ID, label: `${e.Numero}/${e.Ano} — ${e.Titulo}` }), 'Edital');
        this.render();
      } catch(e){toast(e.message,'error');}finally{setBusy(false);}
    },
    async toggle(id,st){try{await API.toggleEdital(id,st);state.editais=await API.getEditais()||[];this.render();toast(`Status → ${st}`,'success');}catch(e){toast(e.message,'error');}},
    async delete_(id) {
      const r = state.editais.find(x=>x.ID===id);
      if (!confirm(`Excluir edital "${r?.Titulo || id}"?\nEsta ação não pode ser desfeita.`)) return;
      try {
        await API.deleteEdital(id);
        toast('Edital excluído.','success');
        state.editais = await API.getEditais()||[];
        _populateSelect('filter-acoes-edital', state.editais, e => ({ value: e.ID, label: `${e.Numero}/${e.Ano} — ${e.Titulo}` }), 'Edital');
        this.render();
      } catch(e){toast(e.message,'error');}
    },
    _form(r) {
      const segs = SEGMENTOS.map(s=>`<option ${r?.Segmento===s?'selected':''}>${s}</option>`).join('');
      return `<div class="form-row">
        <div class="form-group"><label class="form-label">*Número</label><input class="form-control" id="f-numero" value="${esc(r?.Numero||'')}"></div>
        <div class="form-group"><label class="form-label">*Ano</label><input class="form-control" id="f-ano" value="${esc(r?.Ano||new Date().getFullYear())}"></div>
      </div>
      <div class="form-group"><label class="form-label">*Título</label><input class="form-control" id="f-titulo" value="${esc(r?.Titulo||'')}"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">*Fomento/Auxílio</label>
          <select class="form-select" id="f-fomento">
            <option ${r?.Fomento==='Sim'?'selected':''}>Sim</option>
            <option ${r?.Fomento==='Não'?'selected':''}>Não</option></select></div>
        <div class="form-group"><label class="form-label">*Interno/Externo</label>
          <select class="form-select" id="f-tipo">
            <option ${r?.TipoInterno==='Interno'?'selected':''}>Interno</option>
            <option ${r?.TipoInterno==='Externo'?'selected':''}>Externo</option></select></div>
      </div>
      <div class="form-group"><label class="form-label">*Segmento</label><select class="form-select" id="f-seg">${segs}</select></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">*Bolsas</label>
          <select class="form-select" id="f-bolsas">
            <option ${r?.Bolsas==='Sim'?'selected':''}>Sim</option>
            <option ${(!r?.Bolsas||r?.Bolsas==='Não')?'selected':''}>Não</option></select></div>
        <div class="form-group"><label class="form-label">*Custeio/Capital</label>
          <select class="form-select" id="f-custeio">
            <option ${r?.CusteioCapital==='Sim'?'selected':''}>Sim</option>
            <option ${(!r?.CusteioCapital||r?.CusteioCapital==='Não')?'selected':''}>Não</option></select></div>
      </div>`;
    },
    exportXLS(){exportXLS(['Número','Ano','Título','Fomento','Tipo','Segmento','Bolsas','Custeio/Capital','Status'],this.filtered().map(r=>[r.Numero,r.Ano,r.Titulo,r.Fomento,r.TipoInterno,r.Segmento,r.Bolsas,r.CusteioCapital,r.Status]),'Editais');},
    exportPDF(){exportPDF('Editais',['Número','Ano','Título','Segmento','Status'],this.filtered().map(r=>[r.Numero,r.Ano,r.Titulo,r.Segmento,r.Status]));}
  };

  // ── AÇÕES ─────────────────────────────────────────────────
  const Acoes = {
    filtered() {
      const q     = (document.getElementById('search-acoes')?.value||'').toLowerCase();
      const st    = document.getElementById('filter-acoes-status')?.value||'';
      const sg    = document.getElementById('filter-acoes-seg')?.value||'';
      const coord = document.getElementById('filter-acoes-coord')?.value||'';
      const edit  = document.getElementById('filter-acoes-edital')?.value||'';
      return state.acoes.filter(r =>
        (!q || r.Titulo?.toLowerCase().includes(q) || r.coordenadorNome?.toLowerCase().includes(q)) &&
        (!st    || r.Status === st) &&
        (!sg    || r.Segmento === sg) &&
        (!coord || r.CoordenadorEmail === coord) &&
        (!edit  || r.EditalID === edit)
      ).sort((a,b)=>(a.Titulo||'').localeCompare(b.Titulo||''));
    },
    render() {
      const rows = this.filtered();
      const el   = document.getElementById('table-acoes');
      if (!rows.length) { showEmpty('table-acoes'); return; }
      el.innerHTML = `<table><thead><tr>
        <th>Título</th><th>Coordenador</th><th>Ano</th><th>Segmento</th><th>Edital</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${esc(r.Titulo)}</td><td>${esc(r.coordenadorNome||r.CoordenadorEmail)}</td>
        <td>${esc(r.AnoExecucao)}</td><td>${esc(r.Segmento)}</td><td>${esc(r.editalLabel||r.EditalID||'—')}</td>
        <td>${statusBadge(r.Status)}</td>
        <td class="td-actions">
          ${r.SIGAAUrl ? `<a href="${esc(r.SIGAAUrl)}" target="_blank" class="btn btn-ghost btn-xs">📄 SIGAA</a>` : ''}
          <button class="btn btn-ghost btn-xs" title="Upload PDF do SIGAA" onclick="Admin.Acoes.uploadSIGAA('${r.ID}')">⬆ SIGAA</button>
          <button class="btn btn-ghost btn-xs" onclick="Admin.Acoes.openEdit('${r.ID}')">Editar</button>
          <button class="btn ${r.Status==='Ativo'?'btn-warning':'btn-success'} btn-xs" onclick="Admin.Acoes.toggle('${r.ID}','${r.Status==='Ativo'?'Inativo':'Ativo'}')">
            ${r.Status==='Ativo'?'Inativar':'Ativar'}</button>
          <button class="btn btn-danger btn-xs" onclick="Admin.Acoes.delete_('${r.ID}')">Excluir</button>
        </td></tr>`).join('')}</tbody></table>`;
      // Input file oculto para SIGAA
      if (!document.getElementById('_sigaa-input')) {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'application/pdf';
        inp.id = '_sigaa-input'; inp.style.display = 'none';
        inp.onchange = () => Admin.Acoes._doUploadSIGAA(inp);
        document.body.appendChild(inp);
      }
    },
    openAdd(){openModal('Adicionar Ação',this._form(),async()=>{await this._save();});},
    openEdit(id){const r=state.acoes.find(x=>x.ID===id);openModal('Editar Ação',this._form(r),async()=>{await this._save(id);});},
    async _save(id) {
      const p = {
        titulo: document.getElementById('f-titulo')?.value,
        coordenadorEmail: document.getElementById('f-coord')?.value,
        anoExecucao: document.getElementById('f-ano')?.value,
        segmento: document.getElementById('f-seg')?.value,
        editalId: document.getElementById('f-edital')?.value
      };
      if (!validateForm([{el:document.getElementById('f-titulo')},{el:document.getElementById('f-coord')}])) return;
      setBusy(true);
      try {
        id ? await API.updateAcao(id, p) : await API.addAcao(p);
        toast('Ação '+(id?'atualizada':'adicionada')+'.','success');
        closeModal();
        state.acoes = await API.getAcoes()||[];
        _populateSelect('filter-bolsistas-acao',  state.acoes.filter(a=>a.Status==='Ativo'), a=>({value:a.ID,label:a.Titulo}), 'Ação');
        _populateSelect('filter-voluntarios-acao', state.acoes.filter(a=>a.Status==='Ativo'), a=>({value:a.ID,label:a.Titulo}), 'Ação');
        this.render();
      } catch(e){toast(e.message,'error');}finally{setBusy(false);}
    },
    async toggle(id,st){try{await API.toggleAcao(id,st);state.acoes=await API.getAcoes()||[];this.render();}catch(e){toast(e.message,'error');}},
    async delete_(id) {
      const r = state.acoes.find(x=>x.ID===id);
      if (!confirm(`Excluir ação "${r?.Titulo || id}"?\nEsta ação não pode ser desfeita.`)) return;
      try {
        await API.deleteAcao(id);
        toast('Ação excluída.','success');
        state.acoes = await API.getAcoes()||[];
        this.render();
      } catch(e){toast(e.message,'error');}
    },
    _form(r) {
      const coordsOpts = state.coordenadores.filter(c=>c.Status==='Ativo').map(c=>`<option value="${c.Email}" ${r?.CoordenadorEmail===c.Email?'selected':''}>${esc(c.Nome)}</option>`).join('');
      const editaisOpts = '<option value="">Sem edital</option>' + state.editais.filter(e=>e.Status==='Ativo').map(e=>`<option value="${e.ID}" ${r?.EditalID===e.ID?'selected':''}>${e.Numero}/${e.Ano} — ${esc(e.Titulo)}</option>`).join('');
      const segs = SEGMENTOS.map(s=>`<option ${r?.Segmento===s?'selected':''}>${s}</option>`).join('');
      return `<div class="form-group"><label class="form-label">*Título</label><input class="form-control" id="f-titulo" value="${esc(r?.Titulo||'')}"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">*Coordenador</label><select class="form-select" id="f-coord">${coordsOpts}</select></div>
        <div class="form-group"><label class="form-label">*Ano de execução</label><input class="form-control" id="f-ano" value="${esc(r?.AnoExecucao||new Date().getFullYear())}"></div>
      </div>
      <div class="form-group"><label class="form-label">*Segmento</label><select class="form-select" id="f-seg">${segs}</select></div>
      <div class="form-group"><label class="form-label">Edital</label><select class="form-select" id="f-edital">${editaisOpts}</select></div>`;
    },
    uploadSIGAA(id) {
      const inp = document.getElementById('_sigaa-input');
      if (!inp) return;
      inp.dataset.acaoId = id;
      inp.value = '';
      inp.click();
    },
    async _doUploadSIGAA(inp) {
      const id   = inp.dataset.acaoId;
      const file = inp.files?.[0];
      if (!file || !id) return;
      if (file.size > 10 * 1024 * 1024) { toast('Arquivo muito grande. Máximo: 10 MB.', 'error'); return; }
      toast('Enviando PDF...', 'info');
      try {
        const base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload  = () => res(r.result.split(',')[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        await API.uploadSIGAA(id, { base64, fileName: file.name });
        toast('PDF do SIGAA enviado com sucesso.', 'success');
        state.acoes = await API.getAcoes() || [];
        this.render();
      } catch (e) { toast('Erro ao enviar: ' + e.message, 'error'); }
    },
    exportXLS(){exportXLS(['Título','Coordenador','Ano','Segmento','Edital','Status'],this.filtered().map(r=>[r.Titulo,r.coordenadorNome,r.AnoExecucao,r.Segmento,r.editalLabel,r.Status]),'Acoes');},
    exportPDF(){exportPDF('Ações',['Título','Coordenador','Ano','Segmento','Status'],this.filtered().map(r=>[r.Titulo,r.coordenadorNome,r.AnoExecucao,r.Segmento,r.Status]));}
  };

  // ── MEMBROS ───────────────────────────────────────────────
  const Membros = {
    filtered() {
      const q  = (document.getElementById('search-membros')?.value || '').toLowerCase();
      const st = document.getElementById('filter-membros-status')?.value || '';
      return state.membros
        .filter(r => (!q || r.Nome?.toLowerCase().includes(q) || r.Email?.toLowerCase().includes(q)) && (!st || r.Status === st))
        .sort((a, b) => (a.Nome || '').localeCompare(b.Nome || ''));
    },
    render() {
      const rows = this.filtered();
      const el   = document.getElementById('table-membros');
      if (!rows.length) { showEmpty('table-membros'); return; }
      el.innerHTML = `<table><thead><tr>
        <th>Nome</th><th>E-mail</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(r.Nome)}</td><td>${esc(r.Email)}</td>
        <td>${statusBadge(r.Status)}</td>
        <td class="td-actions">
          ${r.Status==='Pendente' ? `<button class="btn btn-success btn-xs" onclick="Admin.Membros.aprovar('${r.ID}')">✓ Aprovar</button>` : ''}
          <button class="btn btn-ghost btn-xs" onclick="Admin.Membros.verPerfil('${r.ID}')">Ver perfil</button>
          <button class="btn btn-ghost btn-xs" onclick="Admin.Membros.openEdit('${r.ID}')">Editar</button>
          <button class="btn ${r.Status==='Ativo'?'btn-warning':'btn-success'} btn-xs" onclick="Admin.Membros.toggle('${r.ID}','${r.Status==='Ativo'?'Inativo':'Ativo'}')">
            ${r.Status==='Ativo'?'Inativar':'Ativar'}</button>
          <button class="btn btn-danger btn-xs" onclick="Admin.Membros.delete_('${r.ID}')">Excluir</button>
        </td></tr>`).join('')}</tbody></table>`;
    },
    verPerfil(id) {
      const r = state.membros.find(x => x.ID === id);
      if (!r) return;

      const tr = (k, v) => v
        ? `<tr><td class="text-muted text-small" style="padding:.35rem .5rem;white-space:nowrap">${k}</td>
               <td style="padding:.35rem .5rem">${esc(String(v))}</td></tr>`
        : '';

      const pessoalRows = [
        tr('CPF', r.CPF), tr('Telefone', r.Telefone), tr('Nascimento', r.DataNascimento),
        tr('Endereço', r.Endereco), tr('E-mail Pessoal', r.EmailPessoal)
      ].join('');

      const academicRows = [
        tr('Curso', r.cursoLabel || r.CursoID), tr('Matrícula', r.Matricula),
        tr('Ingresso', r.AnoSemestreIngresso), tr('Semestre Atual', r.SemestreAtual)
      ].join('');

      const bancarioRows = [
        tr('Banco', r.Banco), tr('Agência', r.Agencia),
        tr('Conta', r.Conta), tr('Tipo Conta', r.TipoConta)
      ].join('');

      const hasData = pessoalRows || academicRows || bancarioRows;

      const docs = r.docs || [];
      const docsHtml = docs.length
        ? docs.map(d => `<tr>
            <td class="text-small" style="padding:.35rem .5rem">${esc(d.name)}</td>
            <td style="padding:.35rem .5rem"><a href="${esc(d.url)}" target="_blank" class="btn btn-ghost btn-xs">Abrir</a></td>
          </tr>`).join('')
        : `<tr><td colspan="2" class="text-muted text-small" style="padding:.35rem .5rem">Nenhum documento enviado.</td></tr>`;

      const repoBtn = r.DriveFolder
        ? `<a href="https://drive.google.com/drive/folders/${esc(r.DriveFolder)}" target="_blank"
             class="btn btn-ghost btn-sm" style="margin-bottom:1rem">📁 Repositório</a>`
        : '';

      const accordion = (title, rows, open = false) => rows
        ? `<details ${open ? 'open' : ''} style="margin-bottom:.75rem;border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem">
             <summary style="cursor:pointer;font-weight:600;font-size:.875rem">${title}</summary>
             <table style="width:100%;margin-top:.5rem">${rows}</table>
           </details>`
        : '';

      openModal(`Perfil — ${esc(r.Nome)}`,
        `${repoBtn}
         ${hasData
           ? accordion('Dados Pessoais', pessoalRows, true) +
             accordion('Dados Acadêmicos', academicRows) +
             (bancarioRows ? accordion('Dados Bancários', bancarioRows) : '')
           : `<p class="text-muted text-small">Dados ainda não preenchidos pelo membro.</p>`}
         <div class="form-section-title" style="margin-top:.75rem">Documentos</div>
         <table style="width:100%">${docsHtml}</table>`,
        () => closeModal(), 'Fechar');
    },
    openAdd() { openModal('Adicionar Membro', this._form(), async () => { await this._save(); }); },
    openEdit(id) {
      const r = state.membros.find(x => x.ID === id);
      if (!r) return;
      openModal('Editar Membro', this._form(r), async () => { await this._save(id); });
    },
    async _save(id) {
      const nome  = document.getElementById('f-nome');
      const email = document.getElementById('f-email');
      if (!validateForm([{ el: nome }, { el: email }])) return;
      const p = { nome: nome.value.trim(), email: email.value.trim() };
      setBusy(true);
      try {
        id ? await API.updateMembro(id, p) : await API.addMembro(p);
        toast('Membro ' + (id ? 'atualizado' : 'adicionado') + '.', 'success');
        closeModal();
        state.membros = await API.getMembros() || [];
        this.render();
      } catch(e) { toast(e.message, 'error'); } finally { setBusy(false); }
    },
    async toggle(id, st) {
      try {
        await API.toggleMembro(id, st);
        state.membros = await API.getMembros() || [];
        this.render();
        toast(`Status alterado para ${st}.`, 'success');
      } catch(e) { toast(e.message, 'error'); }
    },
    async aprovar(id) {
      const r = state.membros.find(x => x.ID === id);
      if (!confirm(`Aprovar membro "${r?.Nome || id}"?\nO acesso ao sistema será liberado imediatamente.`)) return;
      try {
        await API.aprovarMembro(id);
        toast('Membro aprovado. Acesso liberado.', 'success');
        state.membros     = await API.getMembros()     || [];
        state.bolsistas   = await API.getBolsistas()   || [];
        state.voluntarios = await API.getVoluntarios() || [];
        this.render(); Bolsistas.render(); Voluntarios.render();
      } catch(e) { toast(e.message, 'error'); }
    },
    async delete_(id) {
      const r = state.membros.find(x => x.ID === id);
      if (!confirm(`Excluir membro "${r?.Nome || id}"?\nVínculos de bolsista/voluntário existentes não serão removidos automaticamente.`)) return;
      try {
        await API.deleteMembro(id);
        toast('Membro excluído.', 'success');
        state.membros = await API.getMembros() || [];
        this.render();
      } catch(e) { toast(e.message, 'error'); }
    },
    _form(r) {
      return `<div class="form-group"><label class="form-label">*Nome completo</label>
        <input class="form-control" id="f-nome" value="${esc(r?.Nome || '')}"></div>
        <div class="form-group"><label class="form-label">*E-mail institucional do aluno</label>
        <input class="form-control" id="f-email" type="email" value="${esc(r?.Email || '')}"></div>`;
    },
    exportXLS() {
      exportXLS(['Nome', 'E-mail', 'Status'], this.filtered().map(r => [r.Nome, r.Email, r.Status]), 'Membros');
    }
  };

  // ── BOLSISTAS ─────────────────────────────────────────────
  const Bolsistas = {
    filtered() {
      const q    = (document.getElementById('search-bolsistas')?.value||'').toLowerCase();
      const st   = document.getElementById('filter-bolsistas-status')?.value||'';
      const acao = document.getElementById('filter-bolsistas-acao')?.value||'';
      return state.bolsistas.filter(r =>
        (!q    || r.Nome?.toLowerCase().includes(q) || r.Email?.toLowerCase().includes(q)) &&
        (!st   || r.Status===st) &&
        (!acao || r.AcaoID===acao)
      ).sort((a,b)=>(a.Nome||'').localeCompare(b.Nome||''));
    },
    render() {
      const rows = this.filtered();
      const el   = document.getElementById('table-bolsistas');
      if (!rows.length) { showEmpty('table-bolsistas'); return; }
      el.innerHTML = `<table><thead><tr>
        <th>Nome</th><th>E-mail</th><th>Ação</th><th>Início</th><th>Edital</th><th>Carga Horária</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${esc(r.Nome)}</td><td>${esc(r.Email)}</td>
        <td>${esc(r.acaoTitulo||r.AcaoID)}</td>
        <td>${esc(r.DataInicio||'—')}</td>
        <td>${esc(r.editalLabel||'—')}</td>
        <td>${esc(r.CargaHoraria||'—')}</td><td>${statusBadge(r.Status)}</td>
        <td class="td-actions">
          <button class="btn btn-ghost btn-xs" onclick="Admin.Bolsistas.openEdit('${r.ID}')">Editar</button>
          <button class="btn ${r.Status==='Ativo'?'btn-warning':'btn-success'} btn-xs" onclick="Admin.Bolsistas.toggle('${r.ID}','${r.Status==='Ativo'?'Inativo':'Ativo'}')">
            ${r.Status==='Ativo'?'Inativar':'Ativar'}</button>
          <button class="btn btn-danger btn-xs" onclick="Admin.Bolsistas.delete_('${r.ID}')">Excluir</button>
        </td></tr>`).join('')}</tbody></table>`;
    },
    openAdd(){openModal('Adicionar Bolsista',this._form(),async()=>{await this._save();});},
    openEdit(id){const r=state.bolsistas.find(x=>x.ID===id);openModal('Editar Bolsista',this._form(r),async()=>{await this._save(id);});},
    async _save(id) {
      const ch       = document.getElementById('f-ch')?.value;
      const membroId = document.getElementById('f-membro')?.value;
      if (!membroId) { toast('Selecione um membro.', 'warning'); return; }
      const p = {
        membroId,
        acaoId:       document.getElementById('f-acao')?.value,
        dataInicio:   document.getElementById('f-inicio')?.value || '',
        editalId:     document.getElementById('f-edital')?.value || '',
        cargaHoraria: ch === 'Outra' ? document.getElementById('f-ch-other')?.value : ch
      };
      if (!validateForm([{el:document.getElementById('f-acao')}])) return;
      setBusy(true);
      try {
        id ? await API.updateBolsista(id, p) : await API.addBolsista(p);
        toast('Bolsista '+(id?'atualizado':'adicionado')+'.','success');
        closeModal();
        state.bolsistas = await API.getBolsistas()||[];
        this.render();
      } catch(e){toast(e.message,'error');}finally{setBusy(false);}
    },
    async toggle(id,st){try{await API.toggleBolsista(id,st);state.bolsistas=await API.getBolsistas()||[];this.render();}catch(e){toast(e.message,'error');}},
    async delete_(id) {
      const r = state.bolsistas.find(x=>x.ID===id);
      if (!confirm(`Excluir bolsista "${r?.Nome || id}"?\nEsta ação não pode ser desfeita.`)) return;
      try {
        await API.deleteBolsista(id);
        toast('Bolsista excluído.','success');
        state.bolsistas = await API.getBolsistas()||[];
        this.render();
      } catch(e){toast(e.message,'error');}
    },
    _form(r) {
      const memOpts = state.membros.filter(m => m.Status === 'Ativo')
        .map(m => `<option value="${esc(m.ID)}" ${r?.MembroID===m.ID?'selected':''}>${esc(m.Nome)} — ${esc(m.Email)}</option>`).join('');
      const acOpts = state.acoes.filter(a=>a.Status==='Ativo')
        .map(a=>`<option value="${a.ID}" ${r?.AcaoID===a.ID?'selected':''}>${esc(a.Titulo)}</option>`).join('');
      const editaisOpts = '<option value="">Sem edital</option>' + state.editais.filter(e=>e.Status==='Ativo')
        .map(e=>`<option value="${e.ID}" ${r?.EditalID===e.ID?'selected':''}>${e.Numero}/${e.Ano} — ${esc(e.Titulo)}</option>`).join('');
      const chs = ['4h','8h','12h','16h','20h','Outra'].map(h=>`<option ${r?.CargaHoraria===h?'selected':''}>${h}</option>`).join('');
      return `<div class="form-group"><label class="form-label">*Membro</label>
        <select class="form-select" id="f-membro"><option value="">Selecione...</option>${memOpts}</select></div>
      <div class="form-group"><label class="form-label">*Ação</label><select class="form-select" id="f-acao">${acOpts}</select></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">*Data de Início</label>
          <input class="form-control" id="f-inicio" type="date" value="${esc(r?.DataInicio||'')}"></div>
        <div class="form-group"><label class="form-label">*Carga Horária</label>
          <select class="form-select" id="f-ch" onchange="document.getElementById('f-ch-other').style.display=this.value==='Outra'?'block':'none'">${chs}</select>
          <input class="form-control mt-1" id="f-ch-other" placeholder="Especifique" style="display:${r?.CargaHoraria==='Outra'?'block':'none'}"></div>
      </div>
      <div class="form-group"><label class="form-label">Edital</label><select class="form-select" id="f-edital">${editaisOpts}</select></div>`;
    },
    exportXLS(){exportXLS(['Nome','E-mail','Ação','Início','Edital','Carga Horária','Status'],this.filtered().map(r=>[r.Nome,r.Email,r.acaoTitulo,r.DataInicio||'',r.editalLabel,r.CargaHoraria||'',r.Status]),'Bolsistas');},
    exportPDF(){exportPDF('Bolsistas',['Nome','E-mail','Ação','Status'],this.filtered().map(r=>[r.Nome,r.Email,r.acaoTitulo,r.Status]));}
  };

  // ── VOLUNTÁRIOS ───────────────────────────────────────────
  const Voluntarios = {
    filtered() {
      const q    = (document.getElementById('search-voluntarios')?.value||'').toLowerCase();
      const st   = document.getElementById('filter-voluntarios-status')?.value||'';
      const acao = document.getElementById('filter-voluntarios-acao')?.value||'';
      return state.voluntarios.filter(r =>
        (!q    || r.Nome?.toLowerCase().includes(q)) &&
        (!st   || r.Status===st) &&
        (!acao || r.AcaoID===acao)
      ).sort((a,b)=>(a.Nome||'').localeCompare(b.Nome||''));
    },
    render() {
      const rows = this.filtered();
      const el   = document.getElementById('table-voluntarios');
      if (!rows.length) { showEmpty('table-voluntarios'); return; }
      el.innerHTML = `<table><thead><tr>
        <th>Nome</th><th>E-mail</th><th>Ação</th><th>Início</th><th>Carga Horária</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${esc(r.Nome)}</td><td>${esc(r.Email)}</td>
        <td>${esc(r.acaoTitulo||r.AcaoID)}</td>
        <td>${esc(r.DataInicio||'—')}</td>
        <td>${esc(r.CargaHoraria||'—')}</td><td>${statusBadge(r.Status)}</td>
        <td class="td-actions">
          <button class="btn btn-ghost btn-xs" onclick="Admin.Voluntarios.openEdit('${r.ID}')">Editar</button>
          <button class="btn ${r.Status==='Ativo'?'btn-warning':'btn-success'} btn-xs" onclick="Admin.Voluntarios.toggle('${r.ID}','${r.Status==='Ativo'?'Inativo':'Ativo'}')">
            ${r.Status==='Ativo'?'Inativar':'Ativar'}</button>
          <button class="btn btn-danger btn-xs" onclick="Admin.Voluntarios.delete_('${r.ID}')">Excluir</button>
        </td></tr>`).join('')}</tbody></table>`;
    },
    openAdd(){openModal('Adicionar Voluntário',this._form(),async()=>{await this._save();});},
    openEdit(id){const r=state.voluntarios.find(x=>x.ID===id);openModal('Editar Voluntário',this._form(r),async()=>{await this._save(id);});},
    async _save(id) {
      const ch       = document.getElementById('f-ch')?.value;
      const membroId = document.getElementById('f-membro')?.value;
      if (!membroId) { toast('Selecione um membro.', 'warning'); return; }
      const p = {
        membroId,
        acaoId:       document.getElementById('f-acao')?.value,
        dataInicio:   document.getElementById('f-inicio')?.value || '',
        cargaHoraria: ch === 'Outra' ? document.getElementById('f-ch-other')?.value : ch
      };
      if (!validateForm([{el:document.getElementById('f-acao')}])) return;
      setBusy(true);
      try {
        id ? await API.updateVoluntario(id, p) : await API.addVoluntario(p);
        toast('Voluntário '+(id?'atualizado':'adicionado')+'.','success');
        closeModal();
        state.voluntarios = await API.getVoluntarios()||[];
        this.render();
      } catch(e){toast(e.message,'error');}finally{setBusy(false);}
    },
    async toggle(id,st){try{await API.toggleVoluntario(id,st);state.voluntarios=await API.getVoluntarios()||[];this.render();}catch(e){toast(e.message,'error');}},
    async delete_(id) {
      const r = state.voluntarios.find(x=>x.ID===id);
      if (!confirm(`Excluir voluntário "${r?.Nome || id}"?\nEsta ação não pode ser desfeita.`)) return;
      try {
        await API.deleteVoluntario(id);
        toast('Voluntário excluído.','success');
        state.voluntarios = await API.getVoluntarios()||[];
        this.render();
      } catch(e){toast(e.message,'error');}
    },
    _form(r) {
      const memOpts = state.membros.filter(m => m.Status === 'Ativo')
        .map(m => `<option value="${esc(m.ID)}" ${r?.MembroID===m.ID?'selected':''}>${esc(m.Nome)} — ${esc(m.Email)}</option>`).join('');
      const acOpts = state.acoes.filter(a=>a.Status==='Ativo')
        .map(a=>`<option value="${a.ID}" ${r?.AcaoID===a.ID?'selected':''}>${esc(a.Titulo)}</option>`).join('');
      const chs = ['4h','8h','12h','16h','20h','Outra'].map(h=>`<option ${r?.CargaHoraria===h?'selected':''}>${h}</option>`).join('');
      return `<div class="form-group"><label class="form-label">*Membro</label>
        <select class="form-select" id="f-membro"><option value="">Selecione...</option>${memOpts}</select></div>
      <div class="form-group"><label class="form-label">*Ação</label><select class="form-select" id="f-acao">${acOpts}</select></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">*Data de Início</label>
          <input class="form-control" id="f-inicio" type="date" value="${esc(r?.DataInicio||'')}"></div>
        <div class="form-group"><label class="form-label">*Carga Horária</label>
          <select class="form-select" id="f-ch" onchange="document.getElementById('f-ch-other').style.display=this.value==='Outra'?'block':'none'">${chs}</select>
          <input class="form-control mt-1" id="f-ch-other" placeholder="Especifique" style="display:${r?.CargaHoraria==='Outra'?'block':'none'}"></div>
      </div>`;
    },
    exportXLS(){exportXLS(['Nome','E-mail','Ação','Início','Carga Horária','Status'],this.filtered().map(r=>[r.Nome,r.Email,r.acaoTitulo,r.DataInicio||'',r.CargaHoraria||'',r.Status]),'Voluntarios');},
    exportPDF(){exportPDF('Voluntários',['Nome','E-mail','Ação','Status'],this.filtered().map(r=>[r.Nome,r.Email,r.acaoTitulo,r.Status]));}
  };

  // ── CURSOS ────────────────────────────────────────────────
  const Cursos = {
    filtered() {
      const q   = (document.getElementById('search-cursos')?.value||'').toLowerCase();
      const mod = document.getElementById('filter-cursos-mod')?.value||'';
      const st  = document.getElementById('filter-cursos-status')?.value||'';
      return state.cursos.filter(r =>
        (!q   || r.Nome?.toLowerCase().includes(q)) &&
        (!mod || r.Modalidade===mod) &&
        (!st  || r.Status===st)
      ).sort((a,b)=>(a.Nome||'').localeCompare(b.Nome||''));
    },
    render() {
      const rows = this.filtered();
      const el   = document.getElementById('table-cursos');
      if (!rows.length) { showEmpty('table-cursos'); return; }
      el.innerHTML = `<table><thead><tr>
        <th>Nome do Curso</th><th>Modalidade</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${esc(r.Nome)}</td><td>${esc(r.Modalidade)}</td><td>${statusBadge(r.Status)}</td>
        <td class="td-actions">
          <button class="btn btn-ghost btn-xs" onclick="Admin.Cursos.openEdit('${r.ID}')">Editar</button>
          <button class="btn ${r.Status==='Ativo'?'btn-warning':'btn-success'} btn-xs" onclick="Admin.Cursos.toggle('${r.ID}','${r.Status==='Ativo'?'Inativo':'Ativo'}')">
            ${r.Status==='Ativo'?'Inativar':'Ativar'}</button>
          <button class="btn btn-danger btn-xs" onclick="Admin.Cursos.delete_('${r.ID}')">Excluir</button>
        </td></tr>`).join('')}</tbody></table>`;
    },
    openAdd(){openModal('Adicionar Curso',this._form(),async()=>{await this._save();});},
    openEdit(id){const r=state.cursos.find(x=>x.ID===id);openModal('Editar Curso',this._form(r),async()=>{await this._save(id);});},
    async _save(id) {
      const p = { nome: document.getElementById('f-nome')?.value, modalidade: document.getElementById('f-mod')?.value };
      if (!validateForm([{el:document.getElementById('f-nome')}])) return;
      setBusy(true);
      try {
        id ? await API.updateCurso(id, p) : await API.addCurso(p);
        toast('Curso '+(id?'atualizado':'adicionado')+'.','success');
        closeModal();
        state.cursos = await API.getCursos()||[];
        this.render();
      } catch(e){toast(e.message,'error');}finally{setBusy(false);}
    },
    async toggle(id,st){try{await API.toggleCurso(id,st);state.cursos=await API.getCursos()||[];this.render();}catch(e){toast(e.message,'error');}},
    async delete_(id) {
      const r = state.cursos.find(x=>x.ID===id);
      if (!confirm(`Excluir curso "${r?.Nome || id}"?\nEsta ação não pode ser desfeita.`)) return;
      try {
        await API.deleteCurso(id);
        toast('Curso excluído.','success');
        state.cursos = await API.getCursos()||[];
        this.render();
      } catch(e){toast(e.message,'error');}
    },
    _form(r) {
      const mods = ['Integrado','Subsequente','Superior','Especialização','Licenciatura'].map(m=>`<option ${r?.Modalidade===m?'selected':''}>${m}</option>`).join('');
      return `<div class="form-group"><label class="form-label">*Nome do curso</label><input class="form-control" id="f-nome" value="${esc(r?.Nome||'')}"></div>
      <div class="form-group"><label class="form-label">*Modalidade</label><select class="form-select" id="f-mod">${mods}</select></div>`;
    },
    exportXLS(){exportXLS(['Nome','Modalidade','Status'],this.filtered().map(r=>[r.Nome,r.Modalidade,r.Status]),'Cursos');},
    exportPDF(){exportPDF('Cursos',['Nome','Modalidade','Status'],this.filtered().map(r=>[r.Nome,r.Modalidade,r.Status]));}
  };

  // ── TODAS AS AÇÕES ────────────────────────────────────────
  const TodasAcoes = {
    _sortDir: 'asc',
    load() {
      showLoading('todas-acoes-list');
      const segFilter    = document.getElementById('fa-seg')?.value || '';
      const coordFilter  = document.getElementById('fa-coord')?.value || '';
      const statusFilter = document.getElementById('fa-status')?.value || '';

      let acoes = state.acoes;
      if (segFilter)    acoes = acoes.filter(a => a.Segmento === segFilter);
      if (coordFilter)  acoes = acoes.filter(a => a.CoordenadorEmail === coordFilter);
      if (statusFilter) acoes = acoes.filter(a => a.Status === statusFilter);

      this.render(acoes, state.coordenadores, state.bolsistas, state.voluntarios);
    },
    toggleSort() {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
      const btn = document.getElementById('fa-sort-btn');
      if (btn) btn.textContent = `Coord ${this._sortDir === 'asc' ? '↑' : '↓'}`;
      this.load();
    },
    render(acoes, coords, bolsistas, vols) {
      const el = document.getElementById('todas-acoes-list');
      const byCoord = {};
      acoes.forEach(a => {
        const coord = coords.find(c => c.Email === a.CoordenadorEmail);
        const cName = coord ? coord.Nome : a.CoordenadorEmail;
        if (!byCoord[a.CoordenadorEmail]) byCoord[a.CoordenadorEmail] = { name: cName, acoes: [] };
        byCoord[a.CoordenadorEmail].acoes.push(a);
      });

      const dir = this._sortDir;
      const sortedCoords = Object.keys(byCoord).sort((a,b) => {
        const cmp = byCoord[a].name.localeCompare(byCoord[b].name);
        return dir === 'asc' ? cmp : -cmp;
      });
      if (!sortedCoords.length) { showEmpty('todas-acoes-list'); return; }

      el.innerHTML = sortedCoords.map(cEmail => {
        const { name: cName, acoes: aces } = byCoord[cEmail];
        const bySegmento = {};
        aces.forEach(a => { if (!bySegmento[a.Segmento]) bySegmento[a.Segmento]=[]; bySegmento[a.Segmento].push(a); });

        return `<div class="coord-group">
          <div class="coord-group-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            ${esc(cName)} <span class="badge badge-blue">${aces.length} ação(ões)</span>
          </div>
          <div style="background:var(--white);border:1px solid var(--gray-200);border-top:none;border-radius:0 0 var(--radius) var(--radius);padding:.75rem;display:none">
            ${Object.keys(bySegmento).sort().map(seg => `
              <div class="segmento-group">
                <div class="segmento-header">${esc(seg)}</div>
                ${bySegmento[seg].map(a => this._acaoCard(a, bolsistas, vols)).join('')}
              </div>`).join('')}
          </div>
        </div>`;
      }).join('');
    },
    _acaoCard(acao, bolsistas, vols) {
      const acaoBolsistas = bolsistas.filter(b => b.AcaoID === acao.ID && b.Status === 'Ativo');
      const acaoVols      = vols.filter(v => v.AcaoID === acao.ID && v.Status === 'Ativo');

      const participList = [
        ...acaoBolsistas.map(b => {
          const edital = state.editais.find(e => e.ID === b.EditalID);
          const eLabel = edital ? ` · Edital ${edital.Numero}/${edital.Ano}` : '';
          return `<div class="participant-row">
            <span class="badge badge-blue participant-badge">bolsista</span>
            <span class="participant-name">${esc(b.Nome)}</span>
            <span class="text-muted text-small">${esc(b.CargaHoraria||'')}${esc(eLabel)}</span>
          </div>`;
        }),
        ...acaoVols.map(v => `<div class="participant-row">
          <span class="badge badge-gray participant-badge">voluntário</span>
          <span class="participant-name">${esc(v.Nome)}</span>
          <span class="text-muted text-small">${esc(v.cursoLabel||'')}</span>
        </div>`)
      ].join('') || '<div class="text-muted text-small" style="padding:.5rem">Nenhum participante vinculado.</div>';

      return `<div class="card mb-1">
        <div class="card-header" onclick="this.nextElementSibling.classList.toggle('open');this.classList.toggle('expanded')">
          <div class="card-header-left">
            <span class="dot ${acao.Status==='Ativo'?'dot-green':'dot-gray'}"></span>
            <div>
              <div class="card-title">${esc(acao.Titulo)}</div>
              <div class="card-sub">${esc(acao.AnoExecucao)}${acao.editalLabel?' · '+esc(acao.editalLabel):''}</div>
            </div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <span class="text-muted text-small">${acaoBolsistas.length}B · ${acaoVols.length}V</span>
            <span class="badge ${acao.Status==='Ativo'?'badge-green':'badge-gray'}">${esc(acao.Status)}</span>
          </div>
        </div>
        <div class="card-body">${participList}</div>
      </div>`;
    },
    exportXLS() {
      const rows = [];
      state.acoes.forEach(a => {
        const bs = state.bolsistas.filter(b => b.AcaoID === a.ID && b.Status === 'Ativo');
        const vs = state.voluntarios.filter(v => v.AcaoID === a.ID && v.Status === 'Ativo');
        [...bs.map(p => [a.Titulo, a.coordenadorNome||a.CoordenadorEmail, a.Segmento, p.Nome, p.Email, 'bolsista', p.CargaHoraria||'', a.Status]),
         ...vs.map(p => [a.Titulo, a.coordenadorNome||a.CoordenadorEmail, a.Segmento, p.Nome, p.Email, 'voluntário', '', a.Status])]
          .forEach(r => rows.push(r));
      });
      exportXLS(['Ação','Coordenador','Segmento','Participante','E-mail','Tipo','Carga Horária','Status'], rows, 'TodasAcoes');
    },
    exportPDF() { toast('Use XLS para exportar Todas as Ações.','warning'); }
  };

  // ── ASSIDUIDADE ───────────────────────────────────────────
  const Assiduidade = {
    _data: [],
    async load() {
      showLoading('assiduidade-list');
      try {
        const filters = {
          mesAno:   document.getElementById('ass-mes')?.value   || '',
          segmento: document.getElementById('ass-seg')?.value   || '',
          enviado:  document.getElementById('ass-envio')?.value || '',
          validado: document.getElementById('ass-valid')?.value || ''
        };
        const [ass, acoes, coords, bolsistas, vols] = await Promise.all([
          API.getAssiduidades({ mesAno: filters.mesAno, segmento: filters.segmento }),
          API.getAcoes(), API.getCoordenadores(), API.getBolsistas(), API.getVoluntarios()
        ]);
        this._data = ass || [];
        this._renderHierarchical(ass||[], acoes||[], coords||[], bolsistas||[], vols||[], filters);
      } catch(e) { toast(e.message,'error'); showEmpty('assiduidade-list'); }
    },
    _renderHierarchical(ass, acoes, coords, bolsistas, vols, filters) {
      const el = document.getElementById('assiduidade-list');
      const permissoes = loadSession()?.roleInfo?.permissions || [];

      // Map most recent assiduidade per AcaoID
      const assMap = {};
      ass.forEach(a => {
        const cur = assMap[a.AcaoID];
        if (!cur || (a.Timestamp||'') > (cur.Timestamp||'')) assMap[a.AcaoID] = a;
      });

      let filteredAcoes = acoes.filter(a => a.Status === 'Ativo');
      if (filters.segmento) filteredAcoes = filteredAcoes.filter(a => a.Segmento === filters.segmento);
      if (filters.enviado === 'Enviados')     filteredAcoes = filteredAcoes.filter(a => assMap[a.ID]);
      if (filters.enviado === 'Não enviados') filteredAcoes = filteredAcoes.filter(a => !assMap[a.ID]);
      if (filters.validado === 'Validados')   filteredAcoes = filteredAcoes.filter(a => assMap[a.ID] && isTrue(assMap[a.ID].Validado));
      if (filters.validado === 'Pendentes')   filteredAcoes = filteredAcoes.filter(a => !assMap[a.ID] || !isTrue(assMap[a.ID].Validado));

      if (!filteredAcoes.length) { showEmpty('assiduidade-list', 'Nenhuma ação encontrada para os filtros selecionados.'); return; }

      const byCoord = {};
      filteredAcoes.forEach(a => {
        const coord = coords.find(c => c.Email === a.CoordenadorEmail);
        const cName = coord ? coord.Nome : a.CoordenadorEmail;
        if (!byCoord[a.CoordenadorEmail]) byCoord[a.CoordenadorEmail] = { name: cName, acoes: [] };
        byCoord[a.CoordenadorEmail].acoes.push(a);
      });

      const sortedCoords = Object.keys(byCoord).sort((a,b) => byCoord[a].name.localeCompare(byCoord[b].name));

      el.innerHTML = sortedCoords.map(cEmail => {
        const { name: cName, acoes: aces } = byCoord[cEmail];
        const pendingCount = aces.filter(a => !assMap[a.ID] || !isTrue(assMap[a.ID].Validado)).length;
        const bySegmento = {};
        aces.forEach(a => { if (!bySegmento[a.Segmento]) bySegmento[a.Segmento]=[]; bySegmento[a.Segmento].push(a); });

        return `<div class="coord-group" style="margin-bottom:.75rem">
          <div class="coord-group-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            ${esc(cName)}
            <span class="badge badge-blue">${aces.length} ação(ões)</span>
            ${pendingCount > 0
              ? `<span class="badge badge-red">${pendingCount} pendente(s)</span>`
              : '<span class="badge badge-green">Em dia</span>'}
          </div>
          <div style="background:var(--white);border:1px solid var(--gray-200);border-top:none;border-radius:0 0 var(--radius) var(--radius);padding:.75rem">
            ${Object.keys(bySegmento).sort().map(seg => `
              <div class="segmento-group">
                <div class="segmento-header">${esc(seg)}</div>
                ${bySegmento[seg].map(a => this._assCard(a, assMap[a.ID], bolsistas, vols, permissoes, filters.mesAno)).join('')}
              </div>`).join('')}
          </div>
        </div>`;
      }).join('');
    },
    _assCard(acao, assR, bolsistas, vols, permissoes, mesAno) {
      const enviado   = !!assR;
      const validado  = enviado && isTrue(assR.Validado);
      const foraPrazo = enviado && isTrue(assR.ForaPrazo);
      let snap = null;
      if (enviado) {
        try { snap = assR.snapshot || (assR.Snapshot ? (typeof assR.Snapshot==='string' ? JSON.parse(assR.Snapshot) : assR.Snapshot) : null); } catch(e) {}
      }

      const dotClass  = validado ? 'dot-green' : enviado ? 'dot-yellow' : 'dot-red';
      const badgeFora = foraPrazo ? `<span class="badge-fora-prazo">⚠ Fora do prazo · ${isoToBR(assR.Timestamp)}</span>` : '';

      let participList = '';
      if (snap && snap.participantes && snap.participantes.length) {
        participList = snap.participantes.map(p => `
          <div class="participant-row">
            <span class="dot ${p.cumpriu?'dot-green':'dot-red'}"></span>
            <span class="participant-name">${esc(p.nome)}</span>
            <span class="badge ${p.tipo==='bolsista'?'badge-blue':'badge-gray'} participant-badge">${p.tipo}</span>
            <span class="badge ${p.cumpriu?'badge-green':'badge-red'}">${p.cumpriu?'Sim':'Não'}</span>
            ${p.observacao?`<span class="text-muted text-small" style="margin-left:.5rem">${esc(p.observacao)}</span>`:''}
          </div>`).join('');
      } else {
        const bs = bolsistas.filter(b => b.AcaoID === acao.ID && b.Status === 'Ativo');
        const vs = vols.filter(v => v.AcaoID === acao.ID && v.Status === 'Ativo');
        participList = [
          ...bs.map(b => `<div class="participant-row">
            <span class="dot dot-gray"></span>
            <span class="participant-name">${esc(b.Nome)}</span>
            <span class="badge badge-blue participant-badge">bolsista</span>
            <span class="text-muted text-small">Aguardando envio</span>
          </div>`),
          ...vs.map(v => `<div class="participant-row">
            <span class="dot dot-gray"></span>
            <span class="participant-name">${esc(v.Nome)}</span>
            <span class="badge badge-gray participant-badge">voluntário</span>
            <span class="text-muted text-small">Aguardando envio</span>
          </div>`)
        ].join('') || '<div class="text-muted text-small" style="padding:.5rem">Nenhum participante vinculado.</div>';
      }

      const canValidate = permissoes.includes(acao.Segmento);
      const validBtn = enviado && !validado && canValidate
        ? `<div style="margin-top:.75rem"><button class="btn btn-success btn-sm" onclick="Admin.Assiduidade.validar('${assR.ID}')">✓ Validar manualmente</button></div>`
        : '';

      return `<div class="card mb-1">
        <div class="card-header" onclick="this.nextElementSibling.classList.toggle('open');this.classList.toggle('expanded')">
          <div class="card-header-left">
            <span class="dot ${dotClass}"></span>
            <div>
              <div class="card-title">${esc(acao.Titulo)}</div>
              <div class="card-sub">${esc(acao.AnoExecucao)}${mesAno?' · '+mesAnoLabel(mesAno):''}</div>
            </div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
            ${badgeFora}
            <span class="badge ${validado?'badge-green':enviado?'badge-yellow':'badge-red'}">
              ${validado ? '✓ Validado' : enviado ? 'Pendente' : 'Não enviado'}
            </span>
          </div>
        </div>
        <div class="card-body">
          ${participList}
          ${validBtn}
          ${enviado ? `<div class="text-muted text-small mt-1">Enviado em: ${isoToBR(assR.Timestamp)}</div>` : ''}
        </div>
      </div>`;
    },
    async validar(id) {
      if (!id) { toast('ID inválido.','error'); return; }
      try {
        await API.validarAssiduidade(id);
        toast('Assiduidade validada.','success');
        this.load();
      } catch(e) { toast(e.message,'error'); }
    },
    exportXLS() {
      const rows = this._data.map(r => {
        const snap = r.snapshot || (r.Snapshot ? JSON.parse(r.Snapshot) : {});
        return [r.acaoTitulo, r.coordenadorNome, r.MesAno ? mesAnoLabel(r.MesAno) : '', isTrue(r.Validado)?'Sim':'Não', isTrue(r.ForaPrazo)?'Sim':'Não', isoToBR(r.Timestamp)];
      });
      exportXLS(['Ação','Coordenador','Mês/Ano','Validado','Fora do Prazo','Enviado em'], rows, 'Assiduidades');
    },
    exportPDF() {
      const rows = this._data.map(r => [r.acaoTitulo, r.coordenadorNome, r.MesAno ? mesAnoLabel(r.MesAno) : '', isTrue(r.Validado)?'Sim':'Não']);
      exportPDF('Assiduidades', ['Ação','Coordenador','Mês/Ano','Validado'], rows);
    }
  };

  // ── CONFIGURAÇÕES ─────────────────────────────────────────
  const Configuracoes = {
    async load() {
      try {
        const [periodo, notifs] = await Promise.all([API.getPeriodo(), API.getNotificacoes()]);
        state.notificacoes = notifs||[];
        const iniEl = document.getElementById('period-ini');
        const fimEl = document.getElementById('period-fim');
        if (iniEl) iniEl.value = periodo.diaInicio||'';
        if (fimEl) fimEl.value = periodo.diaFim||'';
        const infoEl = document.getElementById('period-info');
        if (infoEl) {
          infoEl.className = `period-alert ${periodo.aberto?'open':'closed'} mb-2`;
          infoEl.textContent = periodo.aberto
            ? `✓ Período aberto: ${periodo.inicio} a ${periodo.fim}`
            : `⚠ Período fechado. Próxima abertura: ${periodo.inicio}`;
        }
        this.renderLembretes();
      } catch(e) { toast(e.message,'error'); }
    },
    async savePeriodo() {
      const ini = document.getElementById('period-ini')?.value;
      const fim = document.getElementById('period-fim')?.value;
      if (!ini || !fim) { toast('Preencha os dois dias.','warning'); return; }
      try {
        await API.setPeriodo({ diaInicio: parseInt(ini), diaFim: parseInt(fim) });
        toast('Período salvo.','success');
        this.load();
      } catch(e) { toast(e.message,'error'); }
    },
    async sendLembreteManual() {
      const msg  = document.getElementById('lem-msg')?.value;
      const seg  = document.getElementById('lem-seg')?.value;
      const dest = document.getElementById('lem-dest')?.value;
      if (!msg) { toast('Preencha a mensagem.','warning'); return; }
      try {
        const r = await API.sendLembrete({ mensagem: msg, segmento: seg, destinatarios: dest });
        toast(`Lembrete enviado para ${r.enviados} coordenador(es).`,'success');
      } catch(e) { toast(e.message,'error'); }
    },
    renderLembretes() {
      const el = document.getElementById('lembretes-list');
      if (!el) return;
      if (!state.notificacoes.length) { el.innerHTML='<div class="empty-state">Nenhum lembrete automático configurado.</div>'; return; }
      el.innerHTML = `<table><thead><tr><th>Dia</th><th>Destinatários</th><th>Segmento</th><th>Ativo</th><th>Ações</th></tr></thead>
        <tbody>${state.notificacoes.map(n=>`<tr>
          <td>Dia ${esc(n.Dia)}</td><td>${esc(n.Destinatarios)}</td><td>${esc(n.Segmento)}</td>
          <td><span class="badge ${isTrue(n.Ativo)?'badge-green':'badge-gray'}">${isTrue(n.Ativo)?'Ativo':'Inativo'}</span></td>
          <td class="td-actions">
            <button class="btn btn-ghost btn-xs" onclick="Admin.Configuracoes.editLembrete('${n.ID}')">Editar</button>
            <button class="btn btn-danger btn-xs" onclick="Admin.Configuracoes.deleteLembrete('${n.ID}')">Excluir</button>
          </td></tr>`).join('')}</tbody></table>`;
    },
    openAddLembrete() {
      openModal('Novo Lembrete Automático', this._lembreteForm(), async()=>{
        const p = { dia: document.getElementById('f-dia')?.value, destinatarios: document.getElementById('f-dest')?.value, segmento: document.getElementById('f-seg')?.value, mensagem: document.getElementById('f-msg')?.value, ativo: true };
        if (!p.dia) { toast('Informe o dia.','warning'); return; }
        setBusy(true);
        try { await API.addNotificacao(p); toast('Lembrete adicionado.','success'); closeModal(); state.notificacoes=await API.getNotificacoes()||[]; this.renderLembretes(); } catch(e){toast(e.message,'error');}finally{setBusy(false);}
      });
    },
    editLembrete(id) {
      const n = state.notificacoes.find(x=>x.ID===id);
      if (!n) return;
      openModal('Editar Lembrete', this._lembreteForm(n), async()=>{
        const p = { dia: document.getElementById('f-dia')?.value, destinatarios: document.getElementById('f-dest')?.value, segmento: document.getElementById('f-seg')?.value, mensagem: document.getElementById('f-msg')?.value, ativo: document.getElementById('f-ativo')?.checked };
        setBusy(true);
        try { await API.updateNotificacao(id,p); toast('Lembrete atualizado.','success'); closeModal(); state.notificacoes=await API.getNotificacoes()||[]; this.renderLembretes(); } catch(e){toast(e.message,'error');}finally{setBusy(false);}
      });
    },
    async deleteLembrete(id) {
      if (!confirm('Excluir este lembrete?')) return;
      try { await API.deleteNotificacao(id); state.notificacoes=await API.getNotificacoes()||[]; this.renderLembretes(); toast('Lembrete removido.','success'); } catch(e){toast(e.message,'error');}
    },
    _lembreteForm(n) {
      const dests = ['Todos','Enviaram','Não enviaram'].map(d=>`<option ${n?.Destinatarios===d?'selected':''}>${d}</option>`).join('');
      const segs  = ['Todos','Ensino','Pesquisa','Extensão','Indissociável'].map(s=>`<option ${n?.Segmento===s?'selected':''}>${s}</option>`).join('');
      return `<div class="form-row">
        <div class="form-group"><label class="form-label">*Dia do mês</label><input class="form-control" type="number" id="f-dia" min="1" max="31" value="${esc(n?.Dia||'')}"></div>
        <div class="form-group"><label class="form-label">Destinatários</label><select class="form-select" id="f-dest">${dests}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Segmento</label><select class="form-select" id="f-seg">${segs}</select></div>
      <div class="form-group"><label class="form-label">Mensagem</label><textarea class="form-control" id="f-msg" rows="3">${esc(n?.Mensagem||'Lembramos que o prazo para registro de assiduidade está em aberto. Acesse o SGA e registre as informações da sua equipe.')}</textarea></div>
      ${n?`<div class="form-group"><label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="f-ativo" ${isTrue(n.Ativo)?'checked':''}> Ativo</label></div>`:''}`;
    }
  };

  // ── LOGS ─────────────────────────────────────────────────
  const Logs = {
    _data: [],
    async load() {
      showLoading('table-logs');
      try {
        this._data = await API.getAuditoria() || [];
        this.render();
      } catch(e) { toast(e.message,'error'); showEmpty('table-logs'); }
    },
    render() {
      const q = (document.getElementById('log-search')?.value||'').toLowerCase();
      const p = document.getElementById('log-perfil')?.value||'';
      const rows = this._data.filter(r =>
        (!q || r.Acao?.toLowerCase().includes(q) || r.Detalhe?.toLowerCase().includes(q) || r.Nome?.toLowerCase().includes(q)) &&
        (!p || r.Perfil===p)
      );
      const el = document.getElementById('table-logs');
      if (!rows.length) { showEmpty('table-logs'); return; }
      el.innerHTML = `<table><thead><tr><th>Data/Hora</th><th>Perfil</th><th>Nome</th><th>E-mail</th><th>Ação</th><th>Detalhe</th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td style="white-space:nowrap">${isoToBR(r.Timestamp)}</td>
          <td><span class="badge badge-blue">${esc(r.Perfil)}</span></td>
          <td>${esc(r.Nome)}</td><td class="text-small text-muted">${esc(r.Email)}</td>
          <td>${esc(r.Acao)}</td><td class="text-small">${esc(r.Detalhe)}</td>
        </tr>`).join('')}</tbody></table>`;
    }
  };

  // ── Public API ────────────────────────────────────────────
  return {
    init, closeModal, loadAll,
    Coord, Editais, Acoes, Membros, Bolsistas, Voluntarios, Cursos,
    TodasAcoes, Assiduidade, Configuracoes, Logs
  };

})();
