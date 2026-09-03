// ============================================================
// SGA — Módulo Seleção (processo seletivo nomeado)
// Cada processo tem um NOME e agrega vagas ativas de QUALQUER ação.
// Uma vaga só pode estar em um processo (as já usadas somem da escolha).
// A avaliação de candidatos é etapa posterior.
// ============================================================
const Selecao = {
  container: null,
  role: null,
  selecoes: [],
  view: 'list',       // 'list' | 'detail'
  detail: null,

  async mount(container, role) {
    this.container = container;
    this.role = role;
    this.view = 'list';
    this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try { this.selecoes = await API.getSelecoes() || []; }
    catch (e) { this.container.innerHTML = emptyState('Erro ao carregar: ' + (e && e.message ? e.message : e)); return; }
    this.render();
  },

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },
  _reqId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  _suggestNome() { const d = new Date(); return 'Seleção ' + d.getFullYear() + '/' + (d.getMonth() < 6 ? 1 : 2); },
  _br(iso) { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p[2] ? `${p[2]}/${p[1]}/${p[0]}` : iso; },

  render() { if (this.view === 'detail') this.renderDetail(); else this.renderList(); },

  renderList() {
    const w = this.canWrite();
    const rows = (this.selecoes || []).map(s => {
      const acoes = (s.acoes || []).map(esc).join(', ') || '—';
      const menu = w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
        <button onclick="Selecao.openDetail('${s.ID}')">👁 Ver</button>
        <button onclick="Selecao.openSelecao('${s.ID}')">✏️ Editar</button>
        <button class="danger" onclick="Selecao.remove('${s.ID}')">🗑 Excluir</button>
      </div></details></td>` : '';
      return `<tr>
        <td><a href="#" onclick="Selecao.openDetail('${s.ID}');return false;"><strong>${esc(s.Nome || '—')}</strong></a></td>
        <td class="cell-sub">${acoes}</td>
        <td>${(s.vagas || []).length} vaga(s)</td>
        <td><span class="badge ${s.Status === 'Aberta' ? 'badge-ok' : 'badge-muted'}">${esc(s.Status || '—')}</span></td>
        ${menu}
      </tr>`;
    }).join('');

    const table = (this.selecoes || []).length ? `
      <div class="table-wrap menus"><table class="data-table">
        <thead><tr><th>Processo seletivo</th><th>Ações</th><th>Vagas</th><th>Status</th>${w ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody></table></div>`
      : emptyState('Nenhum processo seletivo criado ainda.');

    this.container.innerHTML = `
      <div class="page-actions">${w ? `<button class="btn btn-primary" onclick="Selecao.openSelecao()">+ Nova seleção</button>` : ''}</div>
      ${table}`;
  },

  // Agrupa vagas por Edital › Ação e monta a checklist.
  _vagasChecklist(vagas, chosen) {
    if (!vagas.length) return '<span class="field-hint">Nenhuma vaga ativa disponível.</span>';
    chosen = (chosen || []).map(String);
    const byEdital = {};
    vagas.forEach(v => {
      const ek = v.editalLabel || '(sem edital)';
      const ak = v.acaoTitulo || '(sem ação)';
      byEdital[ek] = byEdital[ek] || {};
      (byEdital[ek][ak] = byEdital[ek][ak] || []).push(v);
    });
    let html = '';
    Object.keys(byEdital).sort().forEach(ek => {
      html += `<div class="sel-grp" style="font-weight:600;margin:8px 0 2px">${esc(ek)}</div>`;
      Object.keys(byEdital[ek]).sort().forEach(ak => {
        html += `<div class="sel-grp" style="font-weight:500;margin:4px 0 2px 8px;color:var(--muted,#666)">${esc(ak)}</div>`;
        byEdital[ek][ak].forEach(v => {
          const txt = v.Titulo + ' ' + v.Tipo + ' ' + ak + ' ' + ek;
          html += `<div class="sel-vaga-item" data-text="${esc(txt.toLowerCase())}" style="margin-left:8px">
            <label class="chk-item"><input type="checkbox" class="sel-vaga" value="${esc(v.ID)}" ${chosen.indexOf(String(v.ID)) !== -1 ? 'checked' : ''}>
            ${v.Tipo === 'Bolsista' ? '🎓' : '🙌'} ${esc(v.Titulo)} <span class="cell-sub">· ${esc(String(v.quantidade))} vaga(s)</span></label>
          </div>`;
        });
      });
    });
    return html;
  },

  async openSelecao(id) {
    if (!this.canWrite()) return;
    const s = id ? (this.selecoes || []).find(x => String(x.ID) === String(id)) : null;
    let vagas;
    try { vagas = await API.getVagasAtivas(id || '') || []; }
    catch (e) { toast(e.message, 'error'); return; }
    const chosen = s ? (s.vagas || []).map(v => String(v.ID)) : [];
    const nome = s ? s.Nome : this._suggestNome();
    const statusOpts = STATUS_VAGA.map(o => `<option ${s && s.Status === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    const maxV = s && s.maxVagasAluno ? s.maxVagasAluno : 1;
    const body = `
      <div class="form-grid">
        <div class="fg"><label>Nome do processo *</label><input class="input" id="sel-nome" value="${esc(nome)}"></div>
        <div class="fg"><label>Status</label><select class="input" id="sel-status">${statusOpts}</select></div>
      </div>
      <div class="fg" style="max-width:260px"><label>Máx. de vagas por aluno</label>
        <input class="input" id="sel-maxv" type="number" min="1" value="${esc(String(maxV))}">
        <span class="field-hint">Quantas vagas deste processo um aluno pode se inscrever.</span></div>
      <div class="fg"><label>Vagas ativas (de qualquer ação) *</label>
        <input class="input" id="sel-busca" placeholder="filtrar por título/ação/edital…" oninput="Selecao.filterVagas(this.value)">
        <div class="chk-list" id="sel-vagas" style="max-height:260px">${this._vagasChecklist(vagas, chosen)}</div></div>`;
    openModal((id ? 'Editar ' : 'Nova ') + 'seleção', body, async () => { await this.save(id); }, { confirmLabel: id ? 'Salvar' : 'Criar seleção' });
  },

  filterVagas(q) {
    q = String(q || '').toLowerCase().trim();
    document.querySelectorAll('#sel-vagas .sel-vaga-item').forEach(el => {
      el.style.display = (!q || el.getAttribute('data-text').indexOf(q) !== -1) ? '' : 'none';
    });
  },

  async save(id) {
    const nome = val('sel-nome');
    const status = val('sel-status');
    const maxVagasAluno = Math.max(1, parseInt(val('sel-maxv'), 10) || 1);
    const vagas = Array.from(document.querySelectorAll('.sel-vaga:checked')).map(i => i.value);
    if (!nome.trim()) { toast('Informe o nome do processo.', 'error'); return; }
    if (!vagas.length) { toast('Escolha ao menos uma vaga.', 'error'); return; }
    setBusy(true);
    try {
      if (id) await API.updateSelecao(id, { nome: nome, vagas: vagas, status: status, maxVagasAluno: maxVagasAluno });
      else await API.addSelecao({ nome: nome, vagas: vagas, status: status, maxVagasAluno: maxVagasAluno }, this._reqId());
      toast(id ? 'Seleção atualizada.' : 'Seleção criada.', 'success');
      closeModal();
      this.selecoes = await API.getSelecoes() || [];
      this.render();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  // ── Detalhe em tela cheia (portfólio de vagas + inscritos) ──
  async openDetail(id) {
    this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try { this.detail = await API.getSelecao(id); this.view = 'detail'; }
    catch (e) { toast(e.message, 'error'); this.view = 'list'; this.renderList(); return; }
    this.renderDetail();
  },

  back() { this.view = 'list'; this.renderList(); },

  _situBadge(s) {
    const ok = { 'Selecionado': 'badge-ok', 'Classificado': 'badge-ok' };
    return `<span class="badge ${ok[s] || 'badge-muted'}">${esc(s || 'Inscrito')}</span>`;
  },

  _reqResumo(req, cursosNomes) {
    req = req || {};
    const parts = [];
    if (req.modalidade && req.modalidade.length) parts.push('Modalidade: ' + req.modalidade.join(', '));
    if (req.cursos === 'todos') parts.push('Cursos: todos');
    else if (cursosNomes && cursosNomes.length) parts.push('Cursos: ' + cursosNomes.join(', '));
    if (req.periodoMin) parts.push('Período/semestre mín.: ' + req.periodoMin);
    if (req.assistencia) parts.push('Beneficiário de assistência estudantil');
    (req.demais || []).forEach(d => { if (d.requisito || d.comprovacao) parts.push((d.requisito || '—') + (d.comprovacao ? ' (comprovação: ' + d.comprovacao + ')' : '')); });
    return parts;
  },

  _faixasTable(v) {
    const fx = v.faixas || [];
    if (!fx.length) return '<p class="field-hint">Sem faixas.</p>';
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>CH</th><th>${v.Tipo === 'Bolsista' ? 'Valor da bolsa' : 'Horas'}</th><th>Vagas</th></tr></thead>
      <tbody>${fx.map(f => `<tr><td>${esc(String(f.ch))}h</td><td>${v.Tipo === 'Bolsista' && f.valor !== '' && f.valor != null ? fmtMoney(f.valor) : '—'}</td><td>${esc(String(f.quantidade))}</td></tr>`).join('')}</tbody></table></div>`;
  },

  _inscritosTable(v) {
    const ins = v.inscritos || [];
    if (!ins.length) return `<p class="field-hint">Nenhum inscrito ainda. <em>As inscrições serão importadas.</em></p>`;
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Nome</th><th>Matrícula</th><th>Curso</th><th>E-mail</th><th>Faixa</th><th>Nota</th><th>Situação</th></tr></thead>
      <tbody>${ins.map(c => `<tr>
        <td><strong>${esc(c.nome || '—')}</strong></td>
        <td>${esc(c.matricula || '—')}</td>
        <td>${esc(c.curso || '—')}</td>
        <td class="cell-sub">${esc(c.email || '—')}</td>
        <td>${c.faixaCH ? esc(String(c.faixaCH)) + 'h' : '—'}</td>
        <td>${c.notaFinal !== '' && c.notaFinal != null ? esc(String(c.notaFinal)) : '—'}</td>
        <td>${this._situBadge(c.situacao)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  },

  _vagaCard(v) {
    const req = this._reqResumo(v.requisitos, v.cursosNomes);
    const reqHtml = req.length ? '<ul style="margin:4px 0 0 18px">' + req.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'
      : '<p class="field-hint">Sem requisitos eliminatórios.</p>';
    const crit = v.criterios || [];
    const critHtml = crit.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Categoria</th><th>Critério</th><th>Forma</th><th>Peso</th></tr></thead>
      <tbody>${crit.map(c => `<tr><td>${esc(c.categoria)}</td><td>${esc(c.criterio || '—')}</td><td>${esc(c.forma || '—')}</td><td>${esc(String(c.peso))}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="field-hint">Sem critérios classificatórios.</p>';
    const nIns = (v.inscritos || []).length;
    const totalVagas = (v.faixas || []).reduce((s, f) => s + (Number(f.quantidade) || 0), 0);
    return `<details class="upload-box" style="margin-bottom:12px">
      <summary style="cursor:pointer;list-style:none">
        <div class="seg-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0">
          <span>${v.Tipo === 'Bolsista' ? '🎓' : '🙌'} <strong>${esc(v.Titulo)}</strong>
            <span class="badge ${v.Status === 'Aberta' ? 'badge-ok' : 'badge-muted'}">${esc(v.Status)}</span></span>
          <span class="cell-sub">${totalVagas} vaga(s) · <strong>${nIns}</strong> inscrito(s) ▾</span>
        </div>
        <p class="section-sub" style="margin:4px 0 0">${esc(v.Tipo)} · ${esc(v.acaoTitulo || '')}${v.editalLabel ? ' · ' + esc(v.editalLabel) : ''}</p>
      </summary>
      <div style="margin-top:10px">
        <div class="seg-head">Faixas ofertadas</div>${this._faixasTable(v)}
        <div class="seg-head" style="margin-top:10px">Requisitos de participação</div>${reqHtml}
        <div class="seg-head" style="margin-top:10px">Critérios de seleção e classificação</div>${critHtml}
        <div class="seg-head" style="margin-top:10px">Inscritos <span class="badge badge-muted">${nIns}</span></div>${this._inscritosTable(v)}
      </div>
    </details>`;
  },

  renderDetail() {
    const d = this.detail;
    const w = this.canWrite();
    const vagas = d.vagas || [];
    const totalVagas = vagas.reduce((s, v) => s + (v.faixas || []).reduce((a, f) => a + (Number(f.quantidade) || 0), 0), 0);
    // Resumo por situação (visão do gestor).
    const porSitu = {};
    vagas.forEach(v => (v.inscritos || []).forEach(c => { const k = c.situacao || 'Inscrito'; porSitu[k] = (porSitu[k] || 0) + 1; }));
    const situChips = SITUACAO_INSCRICAO.filter(s => porSitu[s]).map(s => `<span class="badge badge-muted">${esc(s)}: ${porSitu[s]}</span>`).join(' ')
      || '<span class="cell-sub">sem inscritos</span>';
    // Agrupa vagas por ação.
    const byAcao = {};
    vagas.forEach(v => { (byAcao[v.acaoTitulo || '(sem ação)'] = byAcao[v.acaoTitulo || '(sem ação)'] || []).push(v); });
    const grupos = Object.keys(byAcao).map(ak =>
      `<h3 style="margin:14px 0 6px">${esc(ak)}</h3>${byAcao[ak].map(v => this._vagaCard(v)).join('')}`).join('')
      || emptyState('Este processo não tem vagas.');

    const pub = d.publicadoEm
      ? `<span class="badge badge-ok">publicado no portal</span> <span class="cell-sub">${esc(this._br(d.publicadoEm) || d.publicadoEm)}</span>`
      : '<span class="badge badge-muted">não publicado</span>';
    this.container.innerHTML = `
      <div class="page-actions">
        <button class="btn btn-ghost" onclick="Selecao.back()">← Voltar</button>
        ${w ? `<button class="btn btn-ghost btn-xs" onclick="Selecao.openSelecao('${d.ID}')">✏️ Editar processo</button>` : ''}
        ${w ? `<button class="btn btn-primary btn-xs" id="sel-pub-btn" onclick="Selecao.publicar('${d.ID}')">📤 Publicar no portal</button>` : ''}
        ${w && d.publicadoEm ? `<button class="btn btn-ghost btn-xs" onclick="Selecao.despublicar('${d.ID}')">Despublicar</button>` : ''}
        ${w ? `<button class="btn btn-ghost btn-xs" id="sel-sync-btn" onclick="Selecao.sincronizar()">🔄 Sincronizar inscrições</button>` : ''}
      </div>
      <h2 style="margin:6px 0 2px">${esc(d.Nome)} <span class="badge ${d.Status === 'Aberta' ? 'badge-ok' : 'badge-muted'}">${esc(d.Status)}</span></h2>
      <div class="detail-grid" style="margin:8px 0 12px">
        <div><span class="dk">Vagas ofertadas</span><span class="dv">${vagas.length} vaga(s) · ${totalVagas} posição(ões)</span></div>
        <div><span class="dk">Inscritos</span><span class="dv">${d.totalInscritos || 0}</span></div>
        <div><span class="dk">Máx. por aluno</span><span class="dv">${esc(String(d.maxVagasAluno || 1))}</span></div>
        <div><span class="dk">Portal</span><span class="dv">${pub}</span></div>
        <div><span class="dk">Situação dos inscritos</span><span class="dv">${situChips}</span></div>
      </div>
      ${grupos}`;
  },

  publicar(id) {
    const btn = document.getElementById('sel-pub-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Publicando…'; }
    (async () => {
      try {
        const r = await API.publicarSelecao(id);
        toast('Publicado no portal (' + (r && r.vagas || 0) + ' vaga(s)).', 'success');
        this.detail = await API.getSelecao(id);
        this.renderDetail();
      } catch (e) { toast(e.message, 'error'); if (btn) { btn.disabled = false; btn.textContent = '📤 Publicar no portal'; } }
    })();
  },

  despublicar(id) {
    if (!window.confirm('Tirar este processo do portal do aluno?')) return;
    (async () => {
      try { await API.despublicarSelecao(id); toast('Despublicado.', 'success'); this.detail = await API.getSelecao(id); this.renderDetail(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  },

  sincronizar() {
    const btn = document.getElementById('sel-sync-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando…'; }
    (async () => {
      try {
        const r = await API.sincronizarInscricoes();
        toast(`Sincronizado: ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.cancelados} cancelado(s)` +
          (r.rejeitados ? `, ${r.rejeitados} rejeitado(s)` : '') + (r.naoCadastrados ? `, ${r.naoCadastrados} sem cadastro` : '') + '.', 'success');
        if (this.detail) { this.detail = await API.getSelecao(this.detail.ID); this.renderDetail(); }
      } catch (e) { toast(e.message, 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = '🔄 Sincronizar inscrições'; } }
    })();
  },

  remove(id) {
    if (!window.confirm('Excluir este processo seletivo?')) return;
    (async () => {
      try { await API.deleteSelecao(id); toast('Seleção excluída.', 'success'); this.selecoes = await API.getSelecoes() || []; this.render(); }
      catch (e) { toast(e.message, 'error'); }
    })();
  }
};

window.Selecao = Selecao;
