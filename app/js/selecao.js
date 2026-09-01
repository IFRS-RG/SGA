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

  async mount(container, role) {
    this.container = container;
    this.role = role;
    this.container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Carregando…</p></div>';
    try { this.selecoes = await API.getSelecoes() || []; }
    catch (e) { this.container.innerHTML = emptyState('Erro ao carregar: ' + (e && e.message ? e.message : e)); return; }
    this.render();
  },

  canWrite() { return this.role === 'Admin' || this.role === 'Gestor'; },
  _reqId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  _suggestNome() { const d = new Date(); return 'Seleção ' + d.getFullYear() + '/' + (d.getMonth() < 6 ? 1 : 2); },

  render() {
    const w = this.canWrite();
    const rows = (this.selecoes || []).map(s => {
      const acoes = (s.acoes || []).map(esc).join(', ') || '—';
      const menu = w ? `<td class="col-actions"><details class="row-menu"><summary class="btn btn-ghost btn-xs">Ações ▾</summary><div class="row-menu-list">
        <button onclick="Selecao.view('${s.ID}')">👁 Ver</button>
        <button onclick="Selecao.openSelecao('${s.ID}')">✏️ Editar</button>
        <button class="danger" onclick="Selecao.remove('${s.ID}')">🗑 Excluir</button>
      </div></details></td>` : '';
      return `<tr>
        <td><a href="#" onclick="Selecao.view('${s.ID}');return false;"><strong>${esc(s.Nome || '—')}</strong></a></td>
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
    const body = `
      <div class="form-grid">
        <div class="fg"><label>Nome do processo *</label><input class="input" id="sel-nome" value="${esc(nome)}"></div>
        <div class="fg"><label>Status</label><select class="input" id="sel-status">${statusOpts}</select></div>
      </div>
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
    const vagas = Array.from(document.querySelectorAll('.sel-vaga:checked')).map(i => i.value);
    if (!nome.trim()) { toast('Informe o nome do processo.', 'error'); return; }
    if (!vagas.length) { toast('Escolha ao menos uma vaga.', 'error'); return; }
    setBusy(true);
    try {
      if (id) await API.updateSelecao(id, { nome: nome, vagas: vagas, status: status });
      else await API.addSelecao({ nome: nome, vagas: vagas, status: status }, this._reqId());
      toast(id ? 'Seleção atualizada.' : 'Seleção criada.', 'success');
      closeModal();
      this.selecoes = await API.getSelecoes() || [];
      this.render();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  },

  view(id) {
    const s = (this.selecoes || []).find(x => String(x.ID) === String(id));
    if (!s) return;
    const byAcao = {};
    (s.vagas || []).forEach(v => { (byAcao[v.acaoTitulo || '(sem ação)'] = byAcao[v.acaoTitulo || '(sem ação)'] || []).push(v); });
    const blocks = Object.keys(byAcao).map(ak => `<div class="seg-head" style="margin-top:8px">${esc(ak)}</div>
      <ul style="margin:4px 0 0 18px">${byAcao[ak].map(v => `<li>${v.Tipo === 'Bolsista' ? '🎓' : '🙌'} ${esc(v.Titulo)}</li>`).join('')}</ul>`).join('')
      || '<p class="field-hint">Sem vagas.</p>';
    openModal(s.Nome, `<p class="section-sub"><span class="badge ${s.Status === 'Aberta' ? 'badge-ok' : 'badge-muted'}">${esc(s.Status)}</span> · ${(s.vagas || []).length} vaga(s)</p>${blocks}`,
      null, { hideConfirm: true, cancelLabel: 'Fechar' });
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
